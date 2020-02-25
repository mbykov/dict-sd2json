'use strict'

import _ from 'lodash'
const path = require('path')
const fse = require('fs-extra')
const log = console.log
const util = require('util')
const pako = require('pako')
const decoder = new util.TextDecoder('utf-8')
const sanitizeHtml = require('sanitize-html');

export async function stardict (dictpath) {
  try {
    const fns = await checkDir(dictpath)
    const descr = await parseDescr(fns)
    const indexData = await parseIndex(fns)
    const unzipped = await parseDict(fns)
    const docIterator = genDocs(indexData, unzipped)
    return {descr: descr, iterator: docIterator}
  } catch(err) {
    console.log('STARDICT ERR:', err)
  }
}

// todo: EOL
function * genDocs(indexData, unzipped) {
  let step = 0
  let empty = 0
  let docs = []
  for (const arr of indexData) {
    let offset = arr[1], size = arr[2]
    let unchunk = unzipped.slice(offset, offset + size)
    let decoded = decoder.decode(unchunk)
    decoded = decoded.split('\n').slice(1).join('; ').trim()
    let clean = sanitizeHtml(decoded, {
      allowedTags: [ 'b', 'em', 'strong', 'a', 'abr', 'i' ], // , 'dtrn'
      allowedAttributes: {
        'a': [ 'href' ]
      }
    })
    let trns = _.compact(clean.split(';').map(trn=> { return trn.trim() }))
    if (trns.length) {
      let doc = {dict: arr[0], trns: trns}
      docs.push(doc)
    } else {
      empty++
    }
    if (docs.length > 1000 - 1) {
      step++
      yield docs
      docs = []
    } else if (indexData.length == step*1000 + docs.length + empty) {
      yield docs
    }
  }
}

function parseDict(fns) {
  let dictpath = path.resolve(fns.dirpath, fns.dict)
  return fse.readFile(dictpath)
    .then(gzbuf=>{
      const rawdata = new Uint8Array(gzbuf)
      const unzipped = pako.inflate(rawdata);
      return unzipped
    })
}

function checkDir(dictpath) {
  const dirpath = path.dirname(dictpath)
  let filename = path.basename(dictpath)
  filename = path.parse(filename).name
  const refn = new RegExp(filename)

  return fse.readdir(dirpath)
      .then(fns=> {
        const fn = {dirpath: dirpath}
        const ifoname = _.find(fns, fn=> { return refn.test(fn) && /ifo/.test(fn)})
        if (!ifoname) throw new Error('Not a stardict archive')
        fn.ifo = ifoname
        const idxname = _.find(fns, fn=> { return refn.test(fn) && /idx/i.test(fn)})
        if (!idxname) throw new Error('Not a stardict archive')
        fn.idx = idxname
        const dictname = _.find(fns, fn=> { return refn.test(fn) && /\.dz/i.test(fn)})
        if (!dictname) throw new Error('Not a stardict archive')
        fn.dict = dictname
        return fn
      })
}

function parseDescr(fn) {
  let ifopath = path.resolve(fn.dirpath, fn.ifo)
  return fse.readFile(ifopath)
    .then(ifobuf=> {
      const ifo = ifobuf.toString().split('\n').slice(0,7)
      return ifo
    })
}

// todo .gz - наружу
function parseIndex(fn) {
  const idxpath = path.resolve(fn.dirpath, fn.idx)
  return fse.readFile(idxpath)
    .then(buf=>{

      if (/gz/.test(idxpath)) {
        // console.time('BUFFER-UNGZIP')
        const rawdata = new Uint8Array(buf)
        const uint8Array = pako.inflate(rawdata);
        buf = Buffer.from(uint8Array)
        // console.timeEnd('BUFFER-UNGZIP')
      }

      const indexData = []
      let i = 0
      let index = 0
      while (i < buf.length) {
        let beg = i
        i = buf.indexOf('\x00', beg)
        const word = buf.toString('utf-8', beg, i)
        i++
        const offset = buf.readUInt32BE(i)
        i += 4
        const size = buf.readUInt32BE(i)
        i += 4
        indexData.push([word, offset, size])
        index++
      }
      return indexData
    }).catch(err=>{
      log('__ IDX ERR:', err)
    })
}

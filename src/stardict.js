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
    let fns = await checkDir(dictpath)
    // log('_FNS', fns)
    let ifo = await parseIFO(fns)
    // log('_IFO', ifo)
    let indexData = await parseIndex(fns)
    // indexData = indexData.slice(0, 10)
    let unzipped = await parseDict(fns)
    let docIterator = genDocs(indexData, unzipped)
    return docIterator
  } catch(err) {
    console.log('_FNS', err)
  }
}

function * genDocs(indexData, unzipped) {
  let step = 0
  let empty = 0
  let docs = []
  for (const arr of indexData) {
    // log('__________IDX', arr)
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
      // log('__________DOCS', docs.length)
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
      let rawdata = new Uint8Array(gzbuf)
      let unzipped = pako.inflate(rawdata);
      return unzipped
    })
}

function checkDir(dictpath) {
  let dirpath = path.dirname(dictpath)
  let filename = path.basename(dictpath)
  filename = path.parse(filename).name
  let refn = new RegExp(filename)

  return fse.readdir(dirpath)
      .then(fns=> {
        const fn = {dirpath: dirpath}
        let ifoname = _.find(fns, fn=> { return refn.test(fn) && /ifo/.test(fn)})
        if (!ifoname) throw new Error('Not a stardict archive')
        fn.ifo = ifoname
        let idxname = _.find(fns, fn=> { return refn.test(fn) && /idx/i.test(fn)})
        if (!idxname) throw new Error('Not a stardict archive')
        fn.idx = idxname
        let dictname = _.find(fns, fn=> { return refn.test(fn) && /\.dz/i.test(fn)})
        if (!dictname) throw new Error('Not a stardict archive')
        fn.dict = dictname
        return fn
      })
}

function parseIFO(fn) {
  let ifopath = path.resolve(fn.dirpath, fn.ifo)
  return fse.readFile(ifopath)
    .then(ifobuf=> {
      let ifo = ifobuf.toString().split('\n').slice(0,7)
      return ifo
    })
}

function parseIndex(fn) {
  let idxpath = path.resolve(fn.dirpath, fn.idx)
  return fse.readFile(idxpath)
    .then(buf=>{

      if (/gz/.test(idxpath)) {
        // console.time('BUFFER-UNGZIP')
        let rawdata = new Uint8Array(buf)
        let uint8Array = pako.inflate(rawdata);
        buf = Buffer.from(uint8Array)
        // console.timeEnd('BUFFER-UNGZIP')
      }

      const indexData = []
      let i = 0
      let index = 0
      while (i < buf.length) {
        let beg = i
        i = buf.indexOf('\x00', beg)
        let word = buf.toString('utf-8', beg, i)
        i++
        let offset = buf.readUInt32BE(i)
        i += 4
        let size = buf.readUInt32BE(i)
        i += 4
        indexData.push([word, offset, size])
        index++
      }
      return indexData
    }).catch(err=>{
      log('__ IDX ERR:', err)
    })
}

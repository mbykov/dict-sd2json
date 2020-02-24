'use strict'

import _ from 'lodash'
const path = require('path')
const fse = require('fs-extra')
const log = console.log
const util = require('util')
const pako = require('pako')

let decoder = new util.TextDecoder('utf-8')

const miss = require('mississippi')
const sanitizeHtml = require('sanitize-html');

let unzipped

function streamToString (stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

export async function stardict (dictpath) {
  try {
    let fns = await checkDir(dictpath)
    // log('_FNS', fns)
    let ifo = await parseIFO(fns)
    // log('_IFO', ifo)
    let indexData = await parseIndex(fns)
    // log('_IDX', indexData.length)
    let dict = await parseDict(fns, indexData)
    let docs = []
    let chunk = []

    let stream = miss.pipe(
      rstream(indexData),
      miss.parallel(5, toJson)
    )
    return {ifo: ifo, stream: stream}
  } catch(err) {
    console.log('_FNS', err)
  }
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

function parseDict(fn, indexData) {
  let dictpath = path.resolve(fn.dirpath, fn.dict)
  return fse.readFile(dictpath)
    .then(gzbuf=>{
      let rawdata = new Uint8Array(gzbuf)
      unzipped = pako.inflate(rawdata);
      return unzipped
    })
}

function toJson(chunk, cb) {
  let arr = JSON.parse(chunk)
  let idx = arr.shift()
  let offset = arr[1], size = arr[2]
  let unchunk = unzipped.slice(offset, offset + size)
  let decoded = decoder.decode(unchunk)
  decoded = decoded.split('\n').slice(1).join('; ').trim()
  let clean = sanitizeHtml(decoded, {
    allowedTags: [ 'b', 'em', 'strong', 'a', 'abr', 'i' ], // , 'dtrn'
    allowedAttributes: {
      'a': [ 'href' ]
    }
    // , allowedIframeHostnames: ['www.diglossa.org']
  });
  let json = {dict: arr[0], trns: clean}
  cb(null, json)
}

function rstream(indexData) {
  let idx = 0
  return miss.from(function(size, next) {
    if (idx == _.keys(indexData).length) return next(null, null)
    let item = indexData[idx]
    item.unshift(idx)
    let arr = JSON.stringify(item)
    idx++
    next(null, arr)
  })
}

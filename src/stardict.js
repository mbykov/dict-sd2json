'use strict'

import _ from 'lodash'
const path = require('path')
const fse = require('fs-extra')
const log = console.log
const util = require('util')
const pako = require('pako')
const zlib = require('zlib')
const unzip = zlib.createGunzip()
let decoder = new (util.TextDecoder)('utf-8')
const miss = require('mississippi')
const sanitizeHtml = require('sanitize-html');

function streamToString (stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

export default (dirpath) => {
  return checkDir(dirpath)
    .then(fn=> {
      return Promise.all([
        getIfo(fn),
        parseIDX(fn)
          .then(indexData=> {
            return parseDict(fn, indexData)
          })
      ])
    })
}

function checkDir(dirpath) {
  return fse.readdir(dirpath)
      .then(fns=> {
        const fn = {dirpath: dirpath}
        let ifoname = _.find(fns, fn=> { return /ifo/.test(fn)})
        if (!ifoname) throw new Error('Not a stardict archive')
        fn.ifo = ifoname
        let idxname = _.find(fns, fn=> { return /idx/i.test(fn)})
        if (!idxname) throw new Error('Not a stardict archive')
        fn.idx = idxname
        let dictname = _.find(fns, fn=> { return /\.dict/i.test(fn)})
        if (!dictname) throw new Error('Not a stardict archive')
        fn.dict = dictname
        return fn
      })
}

function getIfo(fn) {
  let ifopath = path.resolve(fn.dirpath, fn.ifo)
  log('______GET IFOPATH__', ifopath)
  return fse.readFile(ifopath)
    .then(ifobuf=> {
      let ifo = ifobuf.toString().split('\n').slice(0,7)
      return ifo
    })
}

function parseIDX(fn) {
  let idxpath = path.resolve(fn.dirpath, fn.idx)
  log('_________idxpath', idxpath)
  return fse.readFile(idxpath)
    .then(buf=>{
      // GZIP
      if (/gz/.test(idxpath)) {
        console.time('BUFFER-UNGZIP')
        let rawdata = new Uint8Array(buf)
        let uint8Array = pako.inflate(rawdata);
        buf = Buffer.from(uint8Array)
        // buf = uint8Array
        console.timeEnd('BUFFER-UNGZIP')
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

        // let arr = syns[index]
        // if (arr !== undefined) {
        //   for (let v of arr) indexData.push([v, offset, size])
        // }
        index++
      }
      log('___________________indexData', indexData.slice(0, 3))
      return indexData
      // parseDict(dictpath, indexData)
    }).catch(err=>{
      log('__ IDX ERR:', err)
    })
}

// let rawdata = new Uint8Array(buffer)
function parseDict(fn, indexData) {
  let dictpath = path.resolve(fn.dirpath, fn.dict)
  log('__dictpath:', dictpath)
  return fse.readFile(dictpath)
    .then(gzbuf=>{

      // get_chunks - работает (без R&A), чанки можно достать. Но зачем - это чанки для отдельной статьи
      // let gzip_header = read_gzip_header(buffer)
      // let chunks = get_chunks(gzip_header)

      log('___________________SIZE:', gzbuf.length)
      let rawdata = new Uint8Array(gzbuf)
      log('___________________rawdata:', rawdata.length)
      // let unzipped = Buffer.from(uint8Array)
      let unzipped = pako.inflate(rawdata);

      function toJson(chunk, cb) {
        let arr = JSON.parse(chunk)
        let idx = arr.shift()
        let offset = arr[1], size = arr[2];
        let unchunk = unzipped.slice(offset, offset + size)
        let decoded = decoder.decode(unchunk)
        decoded = decoded.split('\n').slice(1).join('; ').trim()
        let clean = sanitizeHtml(decoded, {
          allowedTags: [ 'b', 'i', 'em', 'strong', 'a', 'abr' ],
          allowedAttributes: {
            'a': [ 'href' ]
          }
          // , allowedIframeHostnames: ['www.youtube.com']
        });
        let json = {dict: arr[0], trns: clean}
        cb(null, json)
      }


      // return rstream(indexData)
      return miss.pipe(
        rstream(indexData),
        miss.parallel(5, toJson)
      )

      // return miss.pipe(
      //   rstream(indexData),
      //   miss.parallel(5, toJson),
      //   miss.through.obj(function (row, enc, next) {
      //     // log('FINISH', JSON.stringify(row))
      //     ws.write(row)
      //     next()
      //   }, function(cb) {
      //     ws.end()
      //   })
      // )

    })
}

function rstream(indexData) {
  let idx = 0
  return miss.from(function(size, next) {
    if (idx == _.keys(indexData).length) return next(null, null)
    let item = indexData[idx]
    item.unshift(idx)
    let arr = JSON.stringify(item) // [0] //+ '\n'
    idx++
    next(null, arr)
  })
}

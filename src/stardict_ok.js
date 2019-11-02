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

function checkFns(dirname) {
  const dps = {}
  const dictspath = path.resolve(__dirname, '../', dirname)
  let fns = fse.readdirSync(dictspath)
  let ifoname = _.find(fns, fn=> { return /ifo/.test(fn)})
  if (!ifoname) return
  dps['ifo'] = path.resolve(dictspath, ifoname)
  let idxname = _.find(fns, fn=> { return /idx/i.test(fn)})
  if (!idxname) return
  dps['idx'] = path.resolve(dictspath, idxname)
  let dictname = _.find(fns, fn=> { return /\.dict/i.test(fn)})
  if (!dictname) return
  dps['dict'] = path.resolve(dictspath, dictname)
  return dps
}

function streamToString (stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

export default (dirname) => {
  let dps = checkFns(dirname)
  if (!dps) return
  log('DPs', dps)

  const ifostream = fse.createReadStream(dps.ifo)
  streamToString(ifostream)
    .then(ifo=> {
      let strs = ifo.split('\n')
      log('_IFO', strs.slice(0,7))
      parseIDX(dps.idx, dps.dict)
    })
}

function parseIDX(idxpath, dictpath) {
  log('_________idxpath', idxpath)
  fse.readFile(idxpath)
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
      parseDict(dictpath, indexData)
    }).catch(err=>{
      log('__ IDX ERR:', err)
    })
}

// let rawdata = new Uint8Array(buffer)
function parseDict(dictpath, indexData) {
  log('__dictpath:', dictpath)
  fse.readFile(dictpath)
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
        let json = {dict: arr[0], trns: decoded}
        cb(null, json)
      }

      let jsons = []
      let ws = miss.to.obj(write, flush)

      function write(data, enc, cb) {
        jsons.push(data)
        cb()
      }

      function flush(cb) {
        log('_____________JSONS', jsons.length, jsons.slice(100, 110))
        cb()
      }

      ws.on('finish', function () {
        console.log('finished')
      })

      // rstream(indexData).pipe(process.stdout)
      miss.pipe(
        rstream(indexData),
        miss.parallel(5, toJson),
        // process.stdout
        miss.through.obj(function (row, enc, next) {
          // log('FINISH', JSON.stringify(row))
          ws.write(row)
          next()
        }, function(cb) {
          ws.end()
        })
      )
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


//

function read_gzip_header (buffer) {
  var FTEXT = 1,
    FHCRC = 2,
    FEXTRA = 4,
    FNAME = 8,
    FCOMMENT = 16

  var position = 0,
    view = new Uint8Array(buffer, position, 10),
    header_data = {
      ID1: 0,
      ID2: 0,
      CM: 0,
      FLG: 0,
      MTIME: 0,
      XFL: 0,
      OS: 0,
      FEXTRA: {
        XLEN: 0,
        SUBFIELDS: []
      },
      FNAME: '',
      FCOMMENT: '',
      FHCRC: ''
    }

  log('______________________VIEW0', view[0], view[1])
  if (view[0] != 0x1f || view[1] != 0x8b) throw new Error('Not a gzip header.')
  header_data['ID1'] = view[0]
  header_data['ID2'] = view[1]
  header_data['CM'] = view[2]
  header_data['FLG'] = view[3]
  header_data['MTIME'] = view[4] << 0
  header_data['MTIME'] |= view[5] << 8
  header_data['MTIME'] |= view[6] << 16
  header_data['MTIME'] |= view[7] << 24
  header_data['XFL'] = view[8]
  header_data['OS'] = view[9]
  position += 10

  // FEXTRA
  if ((header_data['FLG'] & FEXTRA) != 0x00) {
    view = new Uint16Array(buffer, position, 2)
    header_data['FEXTRA']['XLEN'] = view[0]
    position += 2

    // FEXTRA SUBFIELDS
    view = new Uint8Array(buffer, position, header_data['FEXTRA']['XLEN'])
    while (true) {
      var len = view[2] + 256 * view[3],
        subfield = {
          SI1: String.fromCharCode(view[0]),
          SI2: String.fromCharCode(view[1]),
          LEN: len,
          DATA: view.subarray(4, 4 + len)
        }
      header_data['FEXTRA']['SUBFIELDS'].push(subfield)
      view = view.subarray(4 + len)
      if (view.length == 0) break
    }
    position += header_data['FEXTRA']['XLEN']
  }

  // FNAME
  if ((header_data['FLG'] & FNAME) != 0x00) {
    header_data['FNAME'] = zero_terminated_string(buffer, position)
    position += header_data['FNAME'].length
  }

  // FCOMMENT
  if ((header_data['FLG'] & FCOMMENT) != 0x00) {
    header_data['FCOMMENT'] = zero_terminated_string(buffer, position)
    length += header_data['FCOMMENT'].length
  }

  // FHCRC
  if ((header_data['FLG'] & FHCRC) != 0x00) {
    view = new Uint16Array(buffer, position, 2)
    header_data['FHCRC'] = view[0]
    position += 2
  }

  header_data['LENGTH'] = position + 1

  return header_data
}

function zero_terminated_string (buffer, offset) {
  var result = ''
  for (var n = 1; true; n++) {
    offset = offset - result.length

    var view = new Uint8Array(buffer.slice(offset, offset + n * 1024)),
        end = Array.prototype.indexOf.call(view, 0)
    if (end == -1) {
      end = view.length
      if (end == 0) throw new Error('Unexpected end of buffer')
    }
    result += intArrayToString(view.subarray(0, end))
    if (end < view.length) break
  }
  return result
}

function intArrayToString (arr) {
  var ret = ''
  for (var i = 0; i < arr.length; i++) {
    ret += String.fromCharCode(arr[i])
  }
  return ret
}

function get_chunks (gzip_header) {
  var ver,
      chlen = 0,
      chcnt = 0,
      chunks = []

  var subfields = gzip_header['FEXTRA']['SUBFIELDS'],
      found = false,
      sf
  for (var i = 0; i < subfields.length; i++) {
    sf = subfields[i]
    log('_____________________SI', sf.SI1, sf.SI2)
    if (sf['SI1'] == 'R' || sf['SI2'] == 'A') {
      found = true
      break
    }
  }
  if (!found && false) {
    throw new Error('Not a dictzip header.')
  } else {
    var b = sf['DATA']
    ver = b[0] + 256 * b[1]
    chlen = b[2] + 256 * b[3]
    chcnt = b[4] + 256 * b[5]
    for (var i = 0, chpos = 0; i < chcnt && 2 * i + 6 < b.length; i++) {
      var tmp_chlen = b[2 * i + 6] + 256 * b[2 * i + 7]
      chunks.push([chpos, tmp_chlen])
      chpos += tmp_chlen
    }
    return { ver: ver, chlen: chlen, chcnt: chcnt, chunks: chunks }
  }
}

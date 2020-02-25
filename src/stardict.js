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
    // const docIterator = genDocs(indexData, unzipped)
    const phrases = genDocs(indexData, unzipped)
    const docs = uniqDocs(phrases)
    descr.size = docs.length
    return {descr: descr, docs: docs}
    // return {descr: descr, docs: docIterator}
  } catch(err) {
    console.log('STARDICT ERR:', err)
  }
}

function uniqDocs(rdocs) {
  let hdocs = Object.create(null)

  for (const rdoc of rdocs) {
    let dict = rdoc.dict
    let doc = {trns: rdoc.trns}
    let hdoc = { _id: dict, docs: [doc] }

    if (!hdocs[dict]) hdocs[dict] = hdoc
    else if (hdocs[dict] && !hdocs[dict].docs) hdocs[dict].docs = [doc]
    else hdocs[dict].docs.push(doc)

    if (dict.split(' ').length > 1) {
      let phdocs = parsePhrase(dict)
      for (const phdoc of phdocs) {
        if (!hdocs[phdoc._id]) hdocs[phdoc._id] = phdoc
        else if (hdocs[phdoc._id] && !hdocs[phdoc._id].refs) hdocs[phdoc._id].refs = [dict]
        else hdocs[phdoc._id].refs.push(dict)
      }
    }
    if (hdocs[dict].refs && hdocs[dict].refs.length) hdocs[dict].refs = _.uniq(hdocs[dict].refs)
  }
  let docs = Object.values(hdocs)
  return docs
}

function parsePhrase(dict) {
  const phdocs = []
  let wfs = dict.split(/[\p{P} ]+/ug).filter(Boolean)
  for (const wf of wfs) {
    if (wf.length < 3) continue
    let phdoc = {_id: wf, refs: [dict] }
    phdocs.push(phdoc)
  }
  return phdocs
}


// todo: EOL
function genDocs(indexData, unzipped) {
  // let step = 0
  // let empty = 0
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
    // } else {
      // empty++
    }

    // if (docs.length > 1000 - 1) {
    //   step++
    //   yield docs
    //   docs = []
    // } else if (indexData.length == step*1000 + docs.length + empty) {
    //   yield docs
    // }
  }
  return docs
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
      let ifo = ifobuf.toString().split('\n').slice(0,7)
      let name = ifo[4] || ''
      name = name.replace('bookname=', '')
      // name = name.replace(/[- )(]/g,'')
      name = name.replace(/[)(]/g,'').replace(/\s/g,'_')
      let total = ifo[2].replace('wordcount=', '')*1 || 10000
      let descr = {type: 'stardict', name: name, size: total, descr: ifo}
      return descr
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

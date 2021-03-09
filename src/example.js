'use strict'

import { sd2js } from "./index";

const log = console.log
const path = require('path')
const fse = require('fs-extra')

let dictpath = process.argv.slice(2)[0] || false

if (!dictpath) {
  let fn = 'ArtDeRu.ifo'
  dictpath = path.resolve(__dirname, '../../../DICTS/_dicts', fn)
}

log('_SOURCE:', dictpath)
let respath = path.resolve(__dirname, '../test/test.json')

sd2js(dictpath)
  .then(res=> {
    log('DESCR', res.descr)
    log('DOCS', res.docs.length)
    fse.writeJsonSync(respath, res.docs, {spaces: 2})
  })

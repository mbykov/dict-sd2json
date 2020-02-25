//
import { stardict } from "./stardict";
import _ from 'lodash'

const log = console.log
const path = require('path')
const fse = require('fs-extra')
const miss = require('mississippi')

let dictpath = process.argv.slice(2)[0] || false

if (!dictpath) {
  const fn = 'ArtDeRu.ifo'
  dictpath = path.resolve(__dirname, '../../../DICTS/_dicts', fn)
}

let docs = []
let chunk = []

stardict(dictpath)
  .then(docIterator=> {
    for (const chunk of docIterator) {
      log('CHUNK', chunk.length)
      if (chunk.length < 1000) log(chunk)
    }
  })

function pouchIt(docs) {
  log('__POUCH-IT', docs.length)
}

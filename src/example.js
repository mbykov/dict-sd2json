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
  .then(res=> {
    log('_______ SAVE IFO', res.ifo)
    miss.pipe(
      res.stream,
      miss.through.obj(function (doc, enc, next) {
        docs.push(doc)
        chunk.push(doc)
        if (chunk.length == 1000) {
          pouchIt(chunk)
          chunk = []
        }
        next()
      }, function(cb) {
        pouchIt(chunk)
        docs = _.filter(docs, doc=> { return doc.dict && doc.trns })
        log('____docs:', docs.slice(-3))
        log('____total json docs:', docs.length)
        fse.writeFileSync('myfile.txt', JSON.stringify(docs.slice(-3)));
        cb()
      })
    )
  })

function pouchIt(docs) {
  log('__POUCH-IT', docs.length)
}

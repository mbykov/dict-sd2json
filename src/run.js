//
import stardict from "./stardict";
import _ from 'lodash'

const log = console.log
const path = require('path')
const fse = require('fs-extra')
const miss = require('mississippi')

let dictpath = process.argv.slice(2)[0] || false

const fn = 'ArtDeRu.ifo'
dictpath = path.resolve(__dirname, '../../../DICTS/_dicts', fn)

let docs = []
let chunk = []

stardict(dictpath)
  .then(arr=>{
    miss.pipe(
      arr[1],
      miss.through.obj(function (doc, enc, next) {
        docs.push(doc)
        // console.log('DOC', JSON.stringify(doc))
        chunk.push(doc)
        if (chunk.length == 1000) {
          pouchIt(chunk)
          chunk = []
        }
        next()
      }, function(cb) {
        pouchIt(chunk)
        docs = _.filter(docs, doc=> { return doc.dict && doc.trns })
        log('__dict-ifo:', arr[0])
        log('____docs:', docs.slice(-3))
        log('____total json docs:', docs.length)
        // fse.writeFileSync('myfile.txt', JSON.stringify(docs.slice(-3)));
        fse.writeFileSync('myfile.txt', JSON.stringify(docs.slice(-3)), {encoding:'utf8'});

        cb()
      })
    )
  })

function pouchIt(docs) {
  log('__POUCH-IT', docs.length)
}

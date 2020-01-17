//
import stardict from "./stardict";
import _ from 'lodash'

const log = console.log
const path = require('path')
// const fse = require('fs-extra')
const miss = require('mississippi')

let dictpath = process.argv.slice(2)[0] || false
const dirname = '_dicts'
dictpath = path.resolve(__dirname, '../../', dirname)

let docs = []
let chunk = []

stardict(dictpath)
  .then(arr=>{
    log('__dict-ifo:', arr[0])
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
        docs = _.filter(docs, doc=> { return doc.dict && doc.trns })
        log('__dict-ifo:', arr[0])
        log('____total json docs:', docs.slice(-10))
        log('____total json docs:', docs.length)
        pouchIt(chunk)
        cb()
      })
    )
  })

function pouchIt(docs) {
  log('__POUCH-IT', docs.length)
}

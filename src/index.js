//
import stardict from "./stardict";
import _ from 'lodash'

const log = console.log
const path = require('path')
const fse = require('fs-extra')
const miss = require('mississippi')

let dictpath = process.argv.slice(2)[0] || false
const dirname = 'dicts1'
dictpath = path.resolve(__dirname, '../', dirname)

let docs = []
let chunk = []

stardict(dictpath)
  .then(arr=>{
    console.log('dict-ifo:', arr[0])
    miss.pipe(
      arr[1],
      miss.through.obj(function (doc, enc, next) {
        docs.push(doc)
        // console.log('FINISH', JSON.stringify(doc))
        chunk.push(doc)
        if (chunk.length == 1000) {
          pouchIT(chunk)
          chunk = []
        }
        next()
      }, function(cb) {
        log('____json-docs:', docs.length)
        pouchIT(chunk)
        cb()
      })
    )
  })

function pouchIT(docs) {
  log('__POUCH-IT', docs.length)
}

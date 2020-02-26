//
import { stardict } from "./stardict";

const log = console.log
const path = require('path')

let dictpath = process.argv.slice(2)[0] || false

if (!dictpath) {
  let fn = 'ArtDeRu.ifo'
  // let fn = 'UniversalDeRu.ifo'
  dictpath = path.resolve(__dirname, '../../../DICTS/_dicts', fn)
  fn = 'Babylon_Spanish_English_dictio.ifo'
  dictpath = path.resolve(__dirname, '../../../DICTS/StarDict/Babylon', fn)
}

let docs = []
let chunk = []

stardict(dictpath)
  .then(res=> {
    log('DESCR', res.descr)
    log('DOCS', res.docs.length)
  })

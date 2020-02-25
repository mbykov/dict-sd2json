//
import { stardict } from "./stardict";

const log = console.log
const path = require('path')

let dictpath = process.argv.slice(2)[0] || false

if (!dictpath) {
  const fn = 'ArtDeRu.ifo'
  // const fn = 'UniversalDeRu.ifo'
  dictpath = path.resolve(__dirname, '../../../DICTS/_dicts', fn)
}

let docs = []
let chunk = []

stardict(dictpath)
  .then(res=> {
    log('DESCR', res.descr)
    log('DOCS', res.docs.length)
    // for (const chunk of res.iterator) {
    //   log('CHUNK', chunk.length)
    // }
  })

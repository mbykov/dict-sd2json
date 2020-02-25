//
import { stardict } from "./stardict";

const log = console.log
const path = require('path')

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
    }
  })

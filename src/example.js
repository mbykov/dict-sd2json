//
import { sd2js } from "./index";

const log = console.log
const path = require('path')

let dictpath = process.argv.slice(2)[0] || false

if (!dictpath) {
  // let fn = 'ArtDeRu.ifo'
  let fn = 'UniversalDeRu.ifo'
  dictpath = path.resolve(__dirname, '../../../DICTS/_dicts', fn)
  // fn = 'Babylon_Spanish_English_dictio.ifo'
  fn = 'Babylon/NEW_Babylon_German_English_dictionary.ifo'
  fn = 'ItRuIt/stardict-PhraseBookRuIt-2.4.2/PhraseBookRuIt.ifo'
  fn = 'ItRuIt/stardict-LawItRu-2.4.2/LawItRu.ifo'
  dictpath = path.resolve(__dirname, '../../../DICTS/StarDict', fn)
}

let docs = []
let chunk = []

sd2js(dictpath)
  .then(res=> {
    log('DESCR', res.descr)
    log('DOCS', res.docs.length)

    // let doc = res.docs.find(doc=> doc._id == 'Внимание!')
    // log('_DOC', doc.docs)

    let rdocs = res.docs.slice(100, 110)
    rdocs = rdocs.filter(rdoc=> rdoc.refs)
    log('RDOC', rdocs)
    // rdocs.forEach(rdoc=> {
      // log('DOC', rdoc)
    // })
  })

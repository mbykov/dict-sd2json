# dict-sd2json

helper module for the **diglossa.js**: https://github.com/mbykov/diglossa.js.git

# Quick start

Make sure you have [Node.js](https://nodejs.org) installed, then type the following commands
```
git clone https://github.com/mbykov/dict-sd2json.git
cd dict-sd2json
yarn install
yarn start
```
...and you have a running example

## API

```json
import { sd2json } from "./dict-sd2json"
let bpath = 'test.ifo'
let respath = test/'test.json'

sd2json(dictpath)
  .then(res=> {
    console.log('DESCR', res.descr)
    console.log('DOCS', res.docs.length)
    fse.writeJsonSync(respath, res.docs, {spaces: 2})
  })
```
Note: no errors, don't know why Github highlights some code in red

## other helper modules for **diglossa.js**:

```json
**books**:

-: https://github.com/mbykov/book-epub2json
-: https://github.com/mbykov/dict-sd2json
-: https://github.com/mbykov/book-md2json
-: https://github.com/mbykov/book-pdf2json

**dicts**:

https://github.com/mbykov/dict-sd2json

dict-dsl2json
```

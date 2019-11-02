import stardict from "./stardict";

const log = console.log
const miss = require('mississippi')

export default (dirname) => {
  log('________________MIDDLE:')
  let stream = stardict(dirname)
  // rstream(indexData).pipe(process.stdout)
}

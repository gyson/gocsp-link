
var fs = require('gocsp-fs')
var link = require('..')

link([
    fs.readChannel(__filename, 'utf8'),
    process.stdout
])(function () {
    console.log('----- done! -----')
})

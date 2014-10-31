
var fs = require('fs')
var link = require('..')
var Channel = require('gocsp-channel')

var channel = new Channel()

link([
    fs.createReadStream(__filename, { encoding: 'utf8' }),
    channel
])(function () {
    console.log('----- DONE -----')
})

channel.take(console.log)

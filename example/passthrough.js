
var co = require('gocsp-co')
var link = require('gocsp-link')
var Channel = require('gocsp-channel')
var PassThrough = require('stream').PassThrough

var stream = new PassThrough({ objectMode: true })
var channel = new Channel()

link([
    stream,
    channel
])(function () {
    console.log('----- DONE -----')
})

channel.each(console.log)

co(function* () {
    stream.write(1)
    yield sleep(1000)
    stream.write(2)
    yield sleep(1000)
    stream.write(3)
    yield sleep(1000)
    stream.end()
})()

function sleep(time) {
    return function (cb) {
        setTimeout(cb, time)
    }
}

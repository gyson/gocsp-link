
module.exports = exports = link

var assert = require('assert')
var thunk = require('gocsp-thunk')
var Channel = require('gocsp-channel')

/*
    link([
        fs.readChannel(),
        fs.writeChannel()
    ])(function () {
        console.log('DONE')
    })
*/

function link(_list, opts) {
    if (!Array.isArray(_list)) {
        throw new TypeError(_list + ' is not array')
    }
    opts = opts || {}

    // append channels with stream
    var list = []

    _list.forEach(function (element) {
        if (isPipeline( element )) {
            if (!isChannel( list[list.length-1] )) {
                list.push(new Channel())
            }
        }
        // check that it must be channel or stream
        list.push(element)
    })

    var head = list[0]
    var tail = list[list.length-1]

    for (var i = 0; i < list.length - 1; i++) {
        if (isPipeline( list[i+1] )) {
            //assert(isChannel( list[i] ))
            //assert(isChannel( list[i+2] ))
            var fn = list[i+1]
            fn(list[i], list[i+2])
            i += 1
        } else {
            pipe(list[i], list[i+1], opts)
        }
    }

    return thunk(function (cb) {

        var count = 0, cleanup

        function onFinish() {
            count += 1
            if (count === 2) {
                cleanup()
                cb()
            }
        }

        function onError(err) {
            if (err) {
                cleanup()
                cb(err)
            } else {
                onFinish()
            }
        }

        if (isReadable(head) && isWritable(tail)) {
            cleanup = function () {
                head.removeListener('end', onFinish)
                head.removeListener('error', onError)
                tail.removeListener('finish', onFinish)
                tail.removeListener('error', onError)
            }
            head.on('end', onFinish)
            head.on('error', onError)
            tail.on('finish', onFinish)
            tail.on('error', onError)
            return
        }

        if (isReadable(head) && isChannel(tail)) {
            cleanup = function () {
                head.removeListener('end', onFinish)
                head.removeListener('error', onError)
            }
            head.on('end', onFinish)
            head.on('error', onError)
            tail.done(onError)
            return
        }

        if (isChannel(head) && isWritable(tail)) {
            cleanup = function () {
                tail.removeListener('finish', onFinish)
                tail.removeListener('error', onError)
            }
            head.done(onError)
            tail.on('error', onError)
            tail.on('finish', onFinish)
            return
        }

        if (isChannel(head) && isChannel(tail)) {
            cleanup = function () {} // noop
            head.done(onError)
            tail.done(onError)
            return
        }

        throw new Error('should not reach here')
    })
}

function flat(args, list) {
    for (var i = 0; i < args.length; i++) {
        if (args[i].length === +args[i].length) {
            flat(args[i], list)
        } else {
            list.push(args[i])
        }
    }
}

function pipe(input, output, opts) {
    if (isChannel(input) && isChannel(output)) {
        pipe_channel_channel(input, output, opts)
        return
    }
    if (isChannel(input) && isWritable(output)) {
        pipe_channel_writable(input, output, opts)
        return
    }
    if (isReadable(input) && isChannel(output)) {
        pipe_readable_channel(input, output, opts)
        return
    }
    if (isReadable(input) && isWritable(output)) {
        pipe_readable_writable(input, output, opts)
        return
    }
    throw new TypeError('Can only link/pipe readable, writable, channel')
}
exports.pipe = pipe

function pipe_channel_channel(input, output, opts) {

    input.take(take)

    function take(obj) {
        if (obj !== null) {
            output.put(obj, put)
        } else {
            input.done(output.close)
        }
    }

    function put(ok) {
        if (ok) {
            input.take(take)
        } else {
            output.done(input.close)
        }
    }
}

function pipe_readable_writable(readable, writable, opts) {
    readable.pipe(writable, opts)
}

// TODO: objectModel ???

function pipe_channel_writable(channel, writable, opts) {
    var encoding = opts.writeEncoding || null

    // check if writable is closed

    channel.take(function take(obj) {
        if (obj !== null) {
            writable.write(obj, encoding, function (error) {
                if (error) {
                    channel.close(error)
                } else {
                    channel.take(take)
                }
            })
        } else {
            channel.done(function (err) {
                if (err) {
                    writable.emit('error', obj)
                } else {
                    writable.end()
                }
            })
        }
    })
}

function pipe_readable_channel(readable, channel, opts) {
    if (opts.readEncoding) {
        readable.setEncoding(opts.readEncoding)
    }

    // check if readable closed / ended ?
    // if (readable._readableState &&
    //     readable._readableState.endEmitted) {
    //     channel.close()
    //     return
    // }

    readable.on('data', onData)
    function onData(data) {
        if (channel.canPutSync()) {
            channel.putSync(data)
        } else {
            readable.pause()
            channel.put(data, function (ok) {
                if (ok) {
                    readable.resume()
                } else {
                    // stop reading
                    cleanup()
                }
            })
        }
    }

    readable.on('close', onClose)
    function onClose() {
        cleanup()
        channel.close()
    }

    readable.on('end', onEnd)
    function onEnd() {
        cleanup()
        channel.close()
    }

    readable.on('error', onError)
    function onError(err) {
        cleanup()
        channel.close(err)
    }

    function cleanup() {
        readable.removeListener('end', onEnd)
        readable.removeListener('data', onData)
        readable.removeListener('close', onClose)
        readable.removeListener('error', onError)
    }
}

// broadcast(src, dests, opts) // return to

function isReadable(stream) {
    return stream && stream.readable
}

function isWritable(stream) {
    return stream && stream.writable
}

function isChannel(chan) {
    return chan
        && typeof chan.take === 'function'
        && typeof chan.put  === 'function'
}

function isPipeline(obj) {
    return typeof obj === 'function' // obj.length === 2 ?
}


// http://blog.cognitect.com/blog/2014/8/6/transducers-are-coming
// http://syssoftware.blogspot.com/2014/03/channels-and-pipes-close-and-errors.html
// http://syssoftware.blogspot.com/2014/03/channels-pipes-connections-and.html
// http://blog.golang.org/pipelines
// https://www.dartlang.org/slides/2013/06/dart-streams-are-the-future.pdf
// http://blog.cognitect.com/blog/2014/8/6/transducers-are-coming
// http://www.infoq.com/presentations/clojure-core-async

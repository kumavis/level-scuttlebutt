require('tape')('test', function (t) {

var levelup = require('levelup')
var rimraf  = require('rimraf')
var delay   = require('delay-stream')
var Model   = require('scuttlebutt/model')
var LevelScuttlebutt = require('../')
var Client  = require('../client')
var mac     = require('macgyver')().autoValidate()

function create(path, cb) {
  rimraf(path, function (err) {
    if(err) return callback(err)
    levelup(path, {createIfMissing: true}, function (err, db) {
      if(err) throw err
      cb(null, db)
    })
  })
}

var A, B

create('/tmp/level-scuttlebutt-test-A', function (err, db) {

  var schema = {
    test: function () {
      return Model()
    }
  }

  LevelScuttlebutt(db, 'test1', schema)

  db.scuttlebutt.addView({
    name: 'all',
    map: function (key, scuttle, emit) { 
      return emit(scuttle.name.split('!'), 1)
    },
    reduce: function (acc, item) {
      return '' + (Number(acc) + Number(item))
    },
    initial: 0
  })

  //open a scuttlebutt, then close the connection to the database,
  //then reopen the connection, then the scuttlebutt should be reconnected.

  var local  = db.scuttlebutt
  var remote = Client(schema, 'test1-client')

  local.open('test!thing1',  mac(function remoteOpen (err, a) {
    if(err) t.fail(err)
    a.set('x', Math.random())
    a.set('y', Math.random())
    a.set('z', Math.random())
  }).once())

  local.open('test!thing2',  mac(function remoteOpen (err, a) {
    if(err) t.fail(err)
    a.set('x', Math.random())
    a.set('y', Math.random())
    a.set('z', Math.random())
  }).once())

  var rv = []
  var lv = []
  var ended = 0
  function onEnd () {
    if(!ended++) return
    t.deepEqual(rv, lv)
    t.end()
  }

  remote.view({
    name: 'all', start: ['test', true]
  }).on('data', function (data) {
    console.log('remote view', data)
    rv.push(data)
    if(rv.length > 1) onEnd()
  })

  local.view({
    name: 'all', start: ['test', true]
  }).on('data', function (data) {
    console.log('local view', data)
    lv.push(data)
    if(lv.length > 1) onEnd()
  })

  var ls = local.createRemoteStream()
  var rs = remote.createStream()

  ls.pipe(rs).pipe(ls)

})

})
var should = require('should')
var helper = require('node-red-node-test-helper')
var pfNode = require('../presence-faker.js')

helper.init(require.resolve('node-red'))

describe('presence-faker Node', function() {
  beforeEach(function(done) {
    helper.startServer(done)
  })

  afterEach(function(done) {
    helper.unload()
    helper.stopServer(done)
  })

  it('should be loaded', function(done) {
    var flow = [{ id: 'n1', type: 'presence-faker', name: 'presence-faker' }]
    helper.load(pfNode, flow, function() {
      var n1 = helper.getNode('n1')
      n1.should.have.property('name', 'presence-faker')
      done()
    })
  })

  it('should emit ON msg when receiving activation msg during ON period', function(done) {
    var flow = [
      {
        id: 'n1',
        type: 'presence-faker',
        name: 'presence-faker',
        onPayload: 'true',
        onPayloadType: 'bool',
        onTopic: 'switch/me/on',
        offPayload: 'false',
        offPayloadType: 'bool',
        offTopic: 'switch/me/off',
        windowBegin: '00:00:01',
        windowEnd: '23:59:58',
        minDurationHours: '23',
        minDurationMinutes: '59',
        minDurationSeconds: '57',
        minDuration: `${23 * 60 * 60 + 59 * 60 + 57}`,
        maxDurationHours: '23',
        maxDurationMinutes: '59',
        maxDurationSeconds: '57',
        maxDuration: `${23 * 60 * 60 + 59 * 60 + 57}`,
        minCount: '1',
        maxCount: '1',
        startupBehavior: 'onMsg',
        actionOnDisable: 'off',
        wires: [['n2']],
      },
      {
        id: 'n2',
        type: 'helper',
        wires: [],
      },
    ]

    helper.load(pfNode, flow, function() {
      var n2 = helper.getNode('n2')
      var n1 = helper.getNode('n1')
      n2.on('input', function(msg) {
        msg.should.have.property('payload', true)
        msg.should.have.property('topic', 'switch/me/on')
        done()
      })
      n1.receive({ payload: 'enable' })
    })
  })
})

const dayjs = require('dayjs')
const random = require('random')

let myIntervalId

function createSchedule (node, config) {
  const now = dayjs()

  const windowBegin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)
  const windowEnd = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowEnd)

  const windowDuration = windowEnd.diff(windowBegin, 'minutes')

  const calcRandomDuration = () =>
    random.int(Number(config.minDuration), Number(config.maxDuration))

  const calcRandomCount = () =>
    random.int(Number(config.minCount), Number(config.maxCount))

  const count = calcRandomCount()
  node.warn('randomCount: ' + count)

  for (let i = 1; i <= count; i++) {
    node.warn(`block ${i}: ` + calcRandomDuration())
  }

  // node.send(msg)

  // myIntervalId = setInterval(
  //   () =>
  //     node.send({
  //       topic: config.onTopic,
  //       payload: config.onPayload,
  //       timestamp: dayjs().format()
  //     }),
  //   5000
  // )
}

function cancelSchedule (node, config) {
  clearInterval(myIntervalId)
  node.send({
    topic: config.offTopic,
    payload: config.offPayload,
    timestamp: dayjs().format()
  })
}

module.exports = function (RED) {
  function PresenceFakerNode (config) {
    RED.nodes.createNode(this, config)
    var node = this
    node.on('input', function (msg) {
      if (msg.payload === true) {
        // activate!
        node.status({
          fill: 'blue',
          shape: 'dot',
          text: 'active'
        })

        createSchedule(node, config)
      } else if (msg.payload === false) {
        // deactivate!
        node.status({
          fill: 'grey',
          shape: 'ring',
          text: 'suspended'
        })

        cancelSchedule(node, config)
      }
    })
  }
  RED.nodes.registerType('presence-faker', PresenceFakerNode)
}

const { createSchedule, stripPastBlocks } = require('./pf')

function cancelSchedule (node, config) {
  node.send({
    topic: config.offTopic,
    payload: config.offPayload,
    timestamp: dayjs().format()
  })
}

module.exports = function (RED) {
  function PresenceFakerNode (config) {
    RED.nodes.createNode(this, config)
    const node = this

    node.on('input', function (msg) {
      if (msg.payload === true) {
        // activate!
        let schedule = stripPastBlocks(createSchedule(node, config))
        node.warn(schedule)
        let currentBlock = schedule[0]

        node.status({
          fill: 'blue',
          shape: currentBlock.isOn ? 'dot' : 'ring',
          text: `active | ${currentBlock.isOn ? 'ON' : 'OFF'} [${
            currentBlock.beginString
          } - ${currentBlock.endString}]`
        })

        let nodeContext = node.context()
        nodeContext.set('schedule', schedule)
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

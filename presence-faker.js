const { createSchedule, stripPastBlocks } = require('./pf')
const CronJob = require('cron').CronJob

function cancelSchedule (node, config) {
  node.send({
    topic: config.offTopic,
    payload: config.offPayload
  })
}

module.exports = function (RED) {
  function PresenceFakerNode (config) {
    RED.nodes.createNode(this, config)
    const node = this

    node.on('input', function (msg) {
      const sendMsg = isOn => {
        node.send({
          topic: isOn ? config.onTopic : config.offTopic,
          payload: isOn ? config.onPayload : config.offPayload
        })
      }

      if (msg.payload === true) {
        // activate!
        let schedule = stripPastBlocks(createSchedule(node, config))

        if (schedule.length === 0) {
          node.status({
            fill: 'grey',
            shape: 'dot',
            text: `schedule completed`
          })
        } else {
          let currentBlock = schedule[0]

          sendMsg(currentBlock.isOn)

          node.status({
            fill: 'yellow',
            shape: currentBlock.isOn ? 'dot' : 'ring',
            text: `${currentBlock.isOn ? 'ON' : 'OFF'} [${
              currentBlock.beginString
            } - ${currentBlock.endString}]`
          })
        }

        // node.warn(schedule)

        let nodeContext = node.context()
        nodeContext.set('schedule', schedule)
      } else if (msg.payload === false) {
        // deactivate!
        node.status({
          fill: 'red',
          shape: 'ring',
          text: 'suspended'
        })

        cancelSchedule(node, config)
      }
    })

    node.on('close', function () {
      // tidy up
    })
  }

  RED.nodes.registerType('presence-faker', PresenceFakerNode)
}

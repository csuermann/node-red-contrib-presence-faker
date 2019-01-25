const { createSchedule, stripPastBlocks } = require('./pf')
const CronJob = require('cron').CronJob
const dayjs = require('dayjs')

function cancelSchedule(node, config) {
  node.send({
    topic: config.offTopic,
    payload: config.offPayload
  })
}

module.exports = function(RED) {
  function PresenceFakerNode(config) {
    RED.nodes.createNode(this, config)
    const node = this

    node.on('input', function(msg) {
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
          const scheduleNextMessage = function() {
            let nextBlock = schedule.shift()
            sendMsg(nextBlock.isOn)

            const when = dayjs()
              .add(2, 'second')
              .toDate()
            // const when = nextBlock.begin.toDate()

            const job = new CronJob({
              cronTime: when, // nextBlock.begin.toDate()
              onTick: scheduleNextMessage
            })

            job.start()

            node.status({
              fill: 'yellow',
              shape: nextBlock.isOn ? 'dot' : 'ring',
              text: `${nextBlock.isOn ? 'ON' : 'OFF'} [${
                nextBlock.beginString
              } - ${nextBlock.endString}]`
            })
          }

          scheduleNextMessage()
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

    node.on('close', function() {
      // tidy up
    })
  }

  RED.nodes.registerType('presence-faker', PresenceFakerNode)
}

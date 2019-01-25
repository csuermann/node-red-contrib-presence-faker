const { createSchedule, stripPastBlocks } = require('./pf')
const CronJob = require('cron').CronJob
const dayjs = require('dayjs')

module.exports = function (RED) {
  function PresenceFakerNode (config) {
    RED.nodes.createNode(this, config)

    const node = this
    let schedule = []
    let msgCron

    const scheduleNextMessage = function () {
      let nextBlock = schedule.shift()

      if (nextBlock) {
        sendMsg(nextBlock.isOn)

        const when = dayjs()
          .add(2, 'second')
          .toDate()
        // const when = nextBlock.begin.toDate()

        msgCron = new CronJob({
          cronTime: when, // nextBlock.begin.toDate()
          onTick: scheduleNextMessage
        })

        msgCron.start()

        node.status({
          fill: 'yellow',
          shape: nextBlock.isOn ? 'dot' : 'ring',
          text: `${nextBlock.isOn ? 'ON' : 'OFF'} [${nextBlock.beginString} - ${
            nextBlock.endString
          }]`
        })
      } else {
        node.status({
          fill: 'grey',
          shape: 'dot',
          text: 'suspended'
        })
      }
    }

    const sendMsg = isOn => {
      node.send({
        topic: isOn ? config.onTopic : config.offTopic,
        payload: isOn ? config.onPayload : config.offPayload
      })
    }

    let now = dayjs()
    begin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)

    const fakeCronTime = dayjs()
      .add(5, 'second')
      .toDate()

    let rescheduleCron = new CronJob({
      // cronTime: `0 ${begin.minute()} ${begin.hour()} * * *`, // sec min hour dom month dow
      cronTime: fakeCronTime,
      onTick: () => {
        schedule = createSchedule(config)
        scheduleNextMessage()
      }
    })

    rescheduleCron.start()

    node.on('input', function (msg) {
      if (msg.payload === true) {
        // activate!
        schedule = stripPastBlocks(createSchedule(config))

        scheduleNextMessage()

        // let nodeContext = node.context()
        // nodeContext.set('schedule', schedule)
      } else if (msg.payload === false) {
        // deactivate!
        node.status({
          fill: 'red',
          shape: 'ring',
          text: 'inactive'
        })

        if (msgCron) {
          msgCron.stop()
        }
      }
    })

    node.on('close', function () {
      rescheduleCron.stop()

      if (msgCron) {
        msgCron.stop()
      }
    })
  }

  RED.nodes.registerType('presence-faker', PresenceFakerNode)
}

const { createSchedule, stripPastBlocks } = require('./pf')
const CronJob = require('cron').CronJob
const dayjs = require('dayjs')

module.exports = function (RED) {
  function PresenceFakerNode (config) {
    RED.nodes.createNode(this, config)

    const node = this
    let schedule = []
    let rescheduleCron
    let msgCron
    let isActive = false

    ;(function () {
      node.status({
        fill: 'red',
        shape: 'ring',
        text: 'inactive upon load'
      })
    })()

    const activateDailyCron = function () {
      stopCrons()
      isActive = true
      let now = dayjs()
      let begin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)

      // const fakeCronTime = dayjs()
      //   .add(5, 'second')
      //   .toDate()

      rescheduleCron = new CronJob({
        cronTime: `0 ${begin.minute()} ${begin.hour()} * * *`, // sec min hour dom month dow
        // cronTime: fakeCronTime,
        onTick: () => {
          schedule = createSchedule(config)
          scheduleNextMessage()
        }
      })

      rescheduleCron.start()

      node.warn(`crontab set up for ${begin.format('HH:mm')}`)
    }

    const stopCrons = function () {
      isActive = false
      if (rescheduleCron) {
        rescheduleCron.stop()
        node.warn(`daily crontab deleted`)
      }

      if (msgCron) {
        msgCron.stop()
        node.warn(`schedule crontab deleted`)
      }
    }

    const scheduleNextMessage = function () {
      let nextBlock = schedule.shift()

      if (nextBlock) {
        sendMsg(nextBlock.isOn)

        // let cronTime = dayjs()
        //   .add(2, 'second')
        //   .toDate()
        let cronTime = nextBlock.begin.toDate()

        // avoid scheduling a cronjob for the past
        if (nextBlock.begin.isBefore(dayjs())) {
          if (schedule[0]) {
            cronTime = schedule[0].begin.toDate()
          } else {
            cronTime = null
          }
        }

        if (cronTime) {
          msgCron = new CronJob({
            cronTime: cronTime,
            onTick: scheduleNextMessage
          })

          msgCron.start()
        }

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

    node.on('input', function (msg) {
      if (msg.payload === true) {
        // activate!
        activateDailyCron()
        schedule = stripPastBlocks(createSchedule(config))
        scheduleNextMessage()
      } else if (msg.payload === false) {
        // deactivate!
        stopCrons()

        node.status({
          fill: 'red',
          shape: 'ring',
          text: 'inactive'
        })
      }
    })

    node.on('close', function () {
      stopCrons()
    })
  }

  RED.nodes.registerType('presence-faker', PresenceFakerNode)
}

const { createSchedule, stripPastBlocks } = require('./pf')
const CronJob = require('cron').CronJob
const dayjs = require('dayjs')

module.exports = function (RED) {
  function PresenceFakerNode (config) {
    RED.nodes.createNode(this, config)

    const node = this
    let windowBeginCron
    let windowEndCron
    let msgCrons = []

    const setNodeStatusForBlock = function (block) {
      node.status({
        fill: 'yellow',
        shape: block.isOn ? 'dot' : 'ring',
        text: `${block.isOn ? 'ON' : 'OFF'} [${block.beginString} - ${
          block.endString
        }]`
      })
    }

    const setNodeStatus = function (text) {
      node.status({
        fill: 'grey',
        shape: 'dot',
        text: text
      })
    }

    const isNowWithinWindow = function () {
      const now = dayjs()
      const begin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)
      const end = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowEnd)

      return (
        (now.isAfter(begin) && now.isBefore(end)) ||
        now.isSame(begin) ||
        now.isSame(begin)
      )
    }

    const scheduleWindowCrons = function () {
      stopCrons()

      const now = dayjs()
      const begin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)
      const end = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowEnd)
      const windowBeginCronCallback = function () {
        const schedule = stripPastBlocks(createSchedule(config))
        const currentBlock = schedule.shift()
        sendMsg(currentBlock.isOn)
        setNodeStatusForBlock(currentBlock)
        scheduleMsgCrons(schedule)
      }

      if (isNowWithinWindow()) {
        windowBeginCronCallback()
      } else {
        setNodeStatus(`next cycle: ${begin.format('HH:mm')}`)
      }

      windowBeginCron = new CronJob({
        cronTime: `0 ${begin.minute()} ${begin.hour()} * * *`, // sec min hour dom month dow
        onTick: windowBeginCronCallback
      })
      windowBeginCron.start()

      windowEndCron = new CronJob({
        cronTime: `0 ${end.minute()} ${end.hour()} * * *`, // sec min hour dom month dow
        // cronTime: fakeCronTime,
        onTick: () => {
          setNodeStatus('cycle completed')
        }
      })
      windowEndCron.start()

      node.warn(
        `window crontabs set up for ${begin.format('HH:mm')} and ${end.format(
          'HH:mm'
        )}`
      )
    }

    const scheduleMsgCrons = function (schedule) {
      msgCrons = schedule.map(block => {
        const cron = new CronJob({
          cronTime: block.begin.toDate(),
          onTick: () => {
            sendMsg(block.isOn)
            setNodeStatusForBlock(block)
          }
        })

        cron.start()
        return cron
      })
    }

    const stopCrons = function () {
      if (windowBeginCron) {
        windowBeginCron.stop()
        windowEndCron.stop()
        node.warn(`window crons deleted`)
      }

      if (msgCrons.length > 0) {
        msgCrons.forEach(cron => {
          cron.stop()
        })

        node.warn(`${msgCrons.length} message crons deleted`)
        msgCrons = []
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
        scheduleWindowCrons()
      } else if (msg.payload === false) {
        // deactivate!
        stopCrons()
        setNodeStatus('inactive')
      }
    })

    node.on('close', function () {
      stopCrons()
    })
    ;(function () {
      setNodeStatus('inactive upon load')
    })()
  }

  RED.nodes.registerType('presence-faker', PresenceFakerNode)
}

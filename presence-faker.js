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
    let isEnabled = false

    const debug = function (debugMsg) {
      if (RED.settings.presenceFakerDebug) {
        node.warn(debugMsg)
      }
    }

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
        now.isSame(end)
      )
    }

    const scheduleWindowCrons = function () {
      stopCrons()

      const now = dayjs()
      const begin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)
      const end = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowEnd)
      const windowBeginCronCallback = function () {
        const schedule = stripPastBlocks(createSchedule(config))
        debug(schedule)
        const currentBlock = schedule.shift()
        executeBlock(currentBlock)
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

      debug(
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
            executeBlock(block)
          }
        })

        try {
          cron.start()
        } catch (e) {
          debug(e)
        }

        return cron
      })
    }

    const stopCrons = function () {
      if (windowBeginCron) {
        windowBeginCron.stop()
        windowEndCron.stop()
        debug(`window crons deleted`)
      }

      if (msgCrons.length > 0) {
        msgCrons.forEach(cron => {
          cron.stop()
        })

        debug(`${msgCrons.length} message crons deleted`)
        msgCrons = []
      }
    }

    const executeBlock = block => {
      ejectMsg(block.isOn)
      setNodeStatusForBlock(block)
    }

    const ejectMsg = function (isOn, sendHandler) {
      const castPayload = (payload, payloadType) => {
        if (payloadType === 'num') {
          return Number(payload)
        } else if (payloadType === 'bool') {
          return payload === 'true'
        } else if (payloadType === 'json') {
          return JSON.parse(payload)
        } else {
          return payload
        }
      }

      let payload = isOn ? config.onPayload : config.offPayload
      let payloadType = isOn ? config.onPayloadType : config.offPayloadType
      let msgToSend = {
        topic: isOn ? config.onTopic : config.offTopic,
        payload: castPayload(payload, payloadType)
      }

      if (sendHandler) {
        sendHandler(msgToSend)
      } else {
        node.send(msgToSend)
      }
    }

    node.on('input', function (msg, send, done) {
      send =
        send ||
        function () {
          node.send.apply(node, arguments)
        }

      if (
        msg.payload === true ||
        msg.payload === 'true' ||
        msg.payload === 'enable' ||
        msg.payload === 'activate'
      ) {
        // activate!
        isEnabled = true
        scheduleWindowCrons()
      } else if (
        msg.payload === false ||
        msg.payload === 'false' ||
        msg.payload === 'disable' ||
        msg.payload === 'deactivate'
      ) {
        // deactivate!
        isEnabled = false
        stopCrons()
        if (isNowWithinWindow() && config.actionOnDisable !== 'none') {
          ejectMsg(config.actionOnDisable === 'on', send)
        }
        setNodeStatus('inactive')
      } else if (typeof msg.payload === 'object') {
        // config object received as msg.payload
        debug(`!!!! CONFIG OBJECT RECEIVED !!!`)
        if (msg.payload.windowBegin) {
          debug(`new windowBegin: ${msg.payload.windowBegin}`)
          config.windowBegin = msg.payload.windowBegin
        }
        if (msg.payload.windowEnd) {
          debug(`new windowEnd: ${msg.payload.windowEnd}`)
          config.windowEnd = msg.payload.windowEnd
        }
        if (msg.payload.minDuration) {
          debug(`new minDuration: ${msg.payload.minDuration}`)
          config.minDuration = Number(msg.payload.minDuration)
        }
        if (msg.payload.maxDuration) {
          debug(`new maxDuration: ${msg.payload.maxDuration}`)
          config.maxDuration = Number(msg.payload.maxDuration)
        }
        if (msg.payload.minCount) {
          debug(`new minCount: ${msg.payload.minCount}`)
          config.minCount = Number(msg.payload.minCount)
        }
        if (msg.payload.maxCount) {
          debug(`new maxCount: ${msg.payload.maxCount}`)
          config.maxCount = Number(msg.payload.maxCount)
        }

        // force re-scheduling
        if (isEnabled) {
          node.emit('input', { payload: true })
        }
      }

      if (done) {
        done()
      }
    })

    node.on('close', function () {
      stopCrons()
    })
    ;(function () {
      // on startup:
      if (config.startupBehavior === 'onStartup') {
        node.emit('input', { payload: true })
      } else {
        setNodeStatus('inactive upon load')
      }
    })()
  }

  RED.nodes.registerType('presence-faker', PresenceFakerNode)
}

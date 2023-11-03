const { createSchedule, stripPastBlocks, setDebugFn } = require('./pf')
const CronJob = require('cron').CronJob
const dayjs = require('dayjs')

module.exports = function (RED) {
  function PresenceFakerNode(config) {
    RED.nodes.createNode(this, config)

    const node = this
    let windowBeginCron
    let windowEndCron
    let msgCrons = []
    let isEnabled = false

    const debug = function (debugMsg) {
      if (config.isLoggingEnabled) {
        node.warn(debugMsg)
      }
    }

    setDebugFn(debug)

    const setNodeStatusForBlock = function (block) {
      const text = `${block.isOn ? 'ON' : 'OFF'} [${block.beginString} - ${
        block.endString
      }]`

      node.status({
        fill: 'yellow',
        shape: block.isOn ? 'dot' : 'ring',
        text,
      })
      debug(`new node status: ${text}`)
    }

    const setNodeStatus = function (text) {
      node.status({
        fill: 'grey',
        shape: 'dot',
        text: text,
      })
      debug(`new node status: ${text}`)
    }

    const isNowWithinWindow = function () {
      const now = dayjs()
      let begin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)
      let end = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowEnd)

      const duration = end.diff(begin, 'seconds')

      // handle special case of windowBegin > windowEnd, i.e. windows spanning two days
      if (duration < 0) {
        if (now.isBefore(end)) {
          begin = begin.subtract(1, 'day')
        } else if (now.isAfter(begin)) {
          end = end.add(1, 'day')
        }
      }

      const result =
        (now.isAfter(begin) && now.isBefore(end)) ||
        now.isSame(begin) ||
        now.isSame(end)

      debug(`isNowWithinWindow? ${result ? 'Yes' : 'No'}`)

      return result
    }

    const scheduleWindowCrons = function () {
      stopCrons()

      const now = dayjs()
      const begin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)
      const end = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowEnd)
      const windowBeginCronCallback = function () {
        debug('executing windowBeginCronCallback')
        const schedule = stripPastBlocks(createSchedule(config))
        debug('created new schedule: ' + JSON.stringify(schedule))
        if (schedule.length > 0) {
          const currentBlock = schedule.shift()
          executeBlock(currentBlock)
        }
        scheduleMsgCrons(schedule)
      }

      if (isNowWithinWindow()) {
        windowBeginCronCallback()
      } else {
        setNodeStatus(`next cycle: ${begin.format('HH:mm')}`)
      }

      windowBeginCron = CronJob.from({
        cronTime: `0 ${begin.minute()} ${begin.hour()} * * *`, // sec min hour dom month dow
        onTick: windowBeginCronCallback,
      })
      windowBeginCron.start()

      windowEndCron = CronJob.from({
        cronTime: `0 ${end.minute()} ${end.hour()} * * *`, // sec min hour dom month dow
        // cronTime: fakeCronTime,
        onTick: () => {
          setNodeStatus('cycle completed')
        },
      })
      windowEndCron.start()

      debug(
        `window crontabs set up for ${begin.format('HH:mm')} and ${end.format(
          'HH:mm'
        )}`
      )
    }

    const scheduleMsgCrons = function (schedule) {
      msgCrons = schedule.map((block) => {
        const cron = CronJob.from({
          cronTime: block.begin.toDate(),
          onTick: () => {
            executeBlock(block)
          },
        })

        try {
          cron.start()
        } catch (e) {
          debug(e)
        }

        return cron
      })

      debug(`installed crons for ${schedule.length} blocks`)
    }

    const stopCrons = function () {
      if (windowBeginCron) {
        windowBeginCron.stop()
        windowEndCron.stop()
        debug(`window crons deleted`)
      }

      let deletedCronsCount = 0

      if (msgCrons.length > 0) {
        msgCrons.forEach((cron) => {
          cron.stop()
          deletedCronsCount++
        })

        msgCrons = []
      }

      debug(`${deletedCronsCount} message crons deleted`)
    }

    const executeBlock = (block) => {
      debug('executing block: ' + JSON.stringify(block))
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
        payload: castPayload(payload, payloadType),
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
          this.context().set('windowBegin', config.windowBegin)
        }
        if (msg.payload.windowEnd) {
          debug(`new windowEnd: ${msg.payload.windowEnd}`)
          config.windowEnd = msg.payload.windowEnd
          this.context().set('windowEnd', config.windowEnd)
        }
        if (msg.payload.minDuration) {
          debug(`new minDuration: ${msg.payload.minDuration}`)
          config.minDuration = Number(msg.payload.minDuration)
          this.context().set('minDuration', config.minDuration)
        }
        if (msg.payload.maxDuration) {
          debug(`new maxDuration: ${msg.payload.maxDuration}`)
          config.maxDuration = Number(msg.payload.maxDuration)
          this.context().set('maxDuration', config.maxDuration)
        }
        if (msg.payload.minCount) {
          debug(`new minCount: ${msg.payload.minCount}`)
          config.minCount = Number(msg.payload.minCount)
          this.context().set('minCount', config.minCount)
        }
        if (msg.payload.maxCount) {
          debug(`new maxCount: ${msg.payload.maxCount}`)
          config.maxCount = Number(msg.payload.maxCount)
          this.context().set('maxCount', config.maxCount)
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
        setNodeStatus('starting up...')

        setTimeout(() => setNodeStatus('inactive upon load'), 1000)
      }
    })()
  }

  RED.nodes.registerType('presence-faker', PresenceFakerNode)
}

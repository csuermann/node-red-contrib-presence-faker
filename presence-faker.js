const dayjs = require('dayjs')
const random = require('random')

let myIntervalId

function createSchedule (node, config) {
  // const now = dayjs()

  // const windowBegin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)
  // const windowEnd = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowEnd)

  // const windowDuration = windowEnd.diff(windowBegin, 'minutes')

  // const calcRandomDuration = () =>
  //   random.int(Number(config.minDuration), Number(config.maxDuration))

  // const calcRandomCount = () =>
  //   random.int(Number(config.minCount), Number(config.maxCount))

  // const count = calcRandomCount()
  // node.warn('randomCount: ' + count)

  const onBlocks = []
  const offBlocks = []

  // for (let i = 1; i <= count; i++) {
  //   let block = {
  //     on: true,
  //     duration: calcRandomDuration()
  //   }

  //   onBlocks.push(block)
  // }

  // let sumOnDurations = onBlocks.reduce((prev, curr) => prev + curr.duration, 0)
  // node.warn(`SUM ON: ${sumOnDurations} minutes`)

  // REMOVE
  count = 4
  sumOnDurations = 10
  windowDuration = 60

  const calcDeviation = avgDeviation => {
    return random.int(-1 * avgDeviation, avgDeviation)
  }

  // how much time is left for OFF blocks?
  let sumOffDurations = windowDuration - sumOnDurations
  sumOffDurations < 0 ? 0 : sumOffDurations

  let avgOffDuration = Math.ceil(sumOffDurations / count + 1)
  let deviation = Math.floor(avgOffDuration * 0.1)
  let lastDeviation = 0

  for (let i = count + 1; i > 0; i--) {
    let currentDeviation = i > 1 ? calcDeviation(deviation) : 0
    let block = {
      on: false,
      duration: avgOffDuration + currentDeviation + -1 * lastDeviation
    }

    offBlocks.push(block)
    node.warn(block)

    lastDeviation = currentDeviation
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

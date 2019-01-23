const random = require('random')
const dayjs = require('dayjs')

function createSchedule (node, config) {
  const now = dayjs()

  const windowBegin = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowBegin)
  const windowEnd = dayjs(now.format('YYYY-MM-DD') + 'T' + config.windowEnd)

  const windowDuration = windowEnd.diff(windowBegin, 'seconds')

  const calcRandomDuration = () =>
    random.int(Number(config.minDuration), Number(config.maxDuration))

  const calcRandomCount = () =>
    random.int(Number(config.minCount), Number(config.maxCount))

  const count = calcRandomCount()
  node.warn('ON count: ' + count)

  const onBlocks = []
  const offBlocks = []

  for (let i = 1; i <= count; i++) {
    let OnBlock = {
      isOn: true,
      duration: calcRandomDuration()
    }

    onBlocks.push(OnBlock)
  }

  let sumOnDurations = onBlocks.reduce((prev, curr) => prev + curr.duration, 0)
  node.warn(`SUM ON: ${sumOnDurations} seconds`)

  const calcDeviation = avgDeviation => {
    return random.int(-1 * avgDeviation, avgDeviation)
  }

  // how much time is left for OFF blocks?
  let sumOffDurations = windowDuration - sumOnDurations
  sumOffDurations < 0 ? 0 : sumOffDurations
  node.warn(`SUM OFF: ${sumOffDurations} seconds`)

  let avgOffDuration = Math.ceil(sumOffDurations / (count + 1))
  let deviation = Math.floor(avgOffDuration * 0.4)
  let lastDeviation = 0

  for (let i = count + 1; i > 0; i--) {
    let currentDeviation = i > 1 ? calcDeviation(deviation) : 0
    let offBlock = {
      isOn: false,
      duration: avgOffDuration + currentDeviation + -1 * lastDeviation
    }

    offBlocks.push(offBlock)

    lastDeviation = currentDeviation
  }

  let schedule = _combineBlocks(offBlocks, onBlocks)
  return _calcScheduleTimes(schedule, windowBegin)
}

function _combineBlocks (offBlocks, onBlocks) {
  let schedule = []

  for (let i = 0; i < offBlocks.length; i++) {
    schedule.push(offBlocks[i])

    if (onBlocks[i]) {
      schedule.push(onBlocks[i])
    }
  }

  return schedule
}

function _calcScheduleTimes (schedule, start) {
  schedule.forEach(block => {
    block.beginString = start.format('HH:mm:ss')
    let end = start.add(block.duration, 'second')
    block.endString = end.format('HH:mm:ss')
    block.begin = start
    start = end
  })

  return schedule
}

function stripPastBlocks (blocks) {
  const now = dayjs()
  return blocks.filter(block => {
    let end = block.begin.add(block.duration, 'second')
    return now.isBefore(end)
  })
}

module.exports = { createSchedule, stripPastBlocks }
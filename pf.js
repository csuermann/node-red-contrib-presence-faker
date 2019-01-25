const random = require('random')
const dayjs = require('dayjs')

function createSchedule({
  windowBegin,
  windowEnd,
  minDuration,
  maxDuration,
  minCount,
  maxCount
}) {
  const now = dayjs()

  windowBegin = dayjs(now.format('YYYY-MM-DD') + 'T' + windowBegin)
  windowEnd = dayjs(now.format('YYYY-MM-DD') + 'T' + windowEnd)

  const windowDuration = windowEnd.diff(windowBegin, 'seconds')

  const calcRandomDuration = () =>
    random.int(Number(minDuration), Number(maxDuration))

  const calcRandomCount = () => random.int(Number(minCount), Number(maxCount))

  const sumDurations = blocks =>
    blocks.reduce((prev, curr) => prev + curr.duration, 0)

  const count = calcRandomCount()

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

  const calcRandomDeviation = avgDeviation => {
    return random.int(-1 * avgDeviation, avgDeviation)
  }

  // how much time is left for OFF blocks?
  let sumOffDurations = windowDuration - sumOnDurations

  let avgOffDuration = Math.floor(sumOffDurations / (count + 1))
  let deviation = Math.floor(avgOffDuration * 0.4)
  let lastDeviation = 0

  // add OFF blocks (except final one)
  for (let i = count + 1; i > 1; i--) {
    let currentDeviation = calcRandomDeviation(deviation)
    let offBlock = {
      isOn: false,
      duration: Math.round(
        avgOffDuration + currentDeviation + lastDeviation * -1,
        0
      )
    }

    offBlocks.push(offBlock)

    lastDeviation = currentDeviation
  }

  // add final OFF block with remaining time to fit the whole window
  offBlocks.push({
    isOn: false,
    isLastBlock: true,
    duration: sumOffDurations - sumDurations(offBlocks)
  })

  let schedule = _combineBlocks(offBlocks, onBlocks)
  return _calcScheduleTimes(schedule, windowBegin)
}

function _combineBlocks(offBlocks, onBlocks) {
  let schedule = []

  for (let i = 0; i < offBlocks.length; i++) {
    schedule.push(offBlocks[i])

    if (onBlocks[i]) {
      schedule.push(onBlocks[i])
    }
  }

  return schedule
}

function _calcScheduleTimes(schedule, start) {
  schedule.forEach(block => {
    block.beginString = start.format('HH:mm:ss')
    let end = start.add(block.duration, 'second')
    block.endString = end.format('HH:mm:ss')
    block.begin = start
    start = end
  })

  return schedule
}

function stripPastBlocks(blocks) {
  const now = dayjs()
  return blocks.filter(block => {
    let end = block.begin.add(block.duration, 'second')
    return now.isBefore(end)
  })
}

module.exports = { createSchedule, stripPastBlocks }

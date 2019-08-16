const random = require('random')
const dayjs = require('dayjs')

function createSchedule({
  windowBegin,
  windowEnd,
  minDuration,
  maxDuration,
  minCount,
  maxCount,
}) {
  const now = dayjs()

  windowBegin = dayjs(now.format('YYYY-MM-DD') + 'T' + windowBegin)
  windowEnd = dayjs(now.format('YYYY-MM-DD') + 'T' + windowEnd)

  const windowDuration = windowEnd.diff(windowBegin, 'seconds')

  const calcRandomDuration = () =>
    random.int(Number(minDuration), Number(maxDuration))

  const calcRandomCount = () =>
    calcRandomNumber(Number(minCount), Number(maxCount))

  const calcRandomNumber = (min, max) => random.int(min, max)

  const sumDurations = blocks =>
    blocks.reduce((prev, curr) => prev + curr.duration, 0)

  const randomCount = calcRandomCount()

  const onBlocks = []
  const offBlocks = []

  for (let i = 1; i <= randomCount; i++) {
    onBlocks.push({
      isOn: true,
      duration: calcRandomDuration(),
    })
  }

  // remove as many blocks as needed to fit the time window
  while (sumDurations(onBlocks) >= windowDuration) {
    onBlocks.shift()
  }

  // add one block if none was left:
  if (onBlocks.length == 0) {
    onBlocks.push({
      isOn: true,
      duration: Math.floor(windowDuration * 0.9), // spans 90% of the window
    })
  }

  let sumOnDurations = sumDurations(onBlocks)

  // how much time is left for OFF blocks?
  let sumOffDurations = windowDuration - sumOnDurations

  const offBlockCount = onBlocks.length + 1

  for (let i = 0; i < offBlockCount; i++) {
    offBlocks.push({
      isOn: false,
      random: calcRandomNumber(1, 10),
    })
  }

  const sumOfRandom = offBlocks.reduce((acc, curr) => acc + curr.random, 0)

  offBlocks.map(block => {
    const factor = block.random / sumOfRandom
    block.duration = Math.floor(sumOffDurations * factor)
    delete block.random
  })

  //do off-durations match sumOffDurations?
  const diff = sumOffDurations - sumDurations(offBlocks)

  //apply diff to 1st off-block
  offBlocks[0].duration += diff

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

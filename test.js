const { createSchedule, stripPastBlocks } = require('./pf')

let config = {
  onPayload: 'on',
  onTopic: '',
  offPayload: 'off',
  offTopic: '',
  windowBegin: '00:00:00',
  windowEnd: '00:59:59',
  minDuration: 1,
  maxDuration: 30,
  minCount: 1,
  maxCount: 20
}

// let schedule = stripPastBlocks(createSchedule(config))
let schedule = createSchedule(config)

let schedulePrint = schedule.map(el => ({
  begin: el.beginString,
  end: el.endString
}))
console.log(schedulePrint)

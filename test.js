const { createSchedule, stripPastBlocks } = require('./pf')

let node = {
  warn: msg => console.log(msg),
  send: msg => console.log('send():', msg)
}

let config = {
  onPayload: 'on',
  onTopic: '',
  offPayload: 'off',
  offTopic: '',
  windowBegin: '07:30',
  windowEnd: '23:59',
  minDuration: 60,
  maxDuration: 180,
  minCount: 8,
  maxCount: 10
}

let schedule = stripPastBlocks(createSchedule(node, config))

console.log(schedule)

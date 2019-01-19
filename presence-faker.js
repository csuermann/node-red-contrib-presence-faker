module.exports = function (RED) {
  function PresenceFakerNode (config) {
    RED.nodes.createNode(this, config)
    var node = this
    node.on('input', function (msg) {
      msg.payload = msg.payload.toLowerCase()
      msg.cron = config.cron
      node.send(msg)
    })
  }
  RED.nodes.registerType('presence-faker', PresenceFakerNode)
}

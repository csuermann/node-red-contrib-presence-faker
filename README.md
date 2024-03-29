# Presence Faker

Node-RED node to simulate home occupancy by intermittently activating and deactivating devices (e.g. lights) at random intervals.

You can configure a time window during which the node should eject random ON / OFF messages (e.g. 07:00 - 14:30), the duration of ON times (min / max) as well as how many ON times (min / max) should be randomly scheduled.

## Example Flow

![example](docs/example.png)

## Properties Configuration

Properties can be configured statically using the editor or dynamically by injecting a message with a config object.

### Static Configuration

![example](docs/node-props.png)

### Dynamic Configuration

You can overwrite the static configuration at runtime by passing a config object as `msg.payload` to the presence-faker node. All attributes are optional. `minDuration` and `maxDuration` are expressed in seconds.

```javascript
{
    "windowBegin": "00:00",
    "windowEnd": "23:59:59",
    "minDuration": 60,
    "maxDuration": 600,
    "minCount": 10,
    "maxCount": 25
}
```

If the presence-faker node is currently enabled, this will instantly create a new schedule with the new configuration being applied. Otherwise the changes will take effect as soon as the presence-faker node gets enabled.

### Combining presence-faker with suncron

You can combine the presence-faker node with the suncron node in order to dynamically set `windowBegin` and/or `windowEnd` based on the position of the sun:

[Example](https://gist.github.com/csuermann/604f846f4b7bc3a518dc6385c16e3a48)

## Contributions and Suggestions

... are always welcome! Just file a GitHub [issue](https://github.com/csuermann/presence-faker/issues) or [pull request](https://github.com/csuermann/presence-faker/pulls)!

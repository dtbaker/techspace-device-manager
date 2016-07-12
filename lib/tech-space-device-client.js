import mqtt from 'mqtt'
import nedb from 'nedb'
import debug from 'debug'

const CODES = {
  'invalid-device': 0,
  'invalid-key': 1,
  'expired-key': 2,
  'expiring-key': 3,
  'valid-key': 4
}

export default class TechSpaceDeviceClient {
  constructor(options) {
    this.log = debug('TechSpaceDeviceClient')

    this.config = options.tsdClient
    this.db = new nedb(options.nedb)

    this.client = new mqtt.connect(options.mqtt)
    this.client.on('connect', ::this.onMqttConnect)
    this.client.on('message', ::this.onMqttMessage)
  }

  sendDeviceResponse(deviceId, code) {
    this.log('sendDeviceResponse', deviceId, code)

    this.client.publish(
      `${this.config.namespace}/${deviceId}`,
      `${CODES[code]}`
    )
  }

  onMqttConnect() {
    this.log('onMqttConnect')

    this.client.subscribe(`${this.config.namespace}`)
  }

  onMqttMessage(topic, message) {
    this.log('onMqttMessage', topic, message.toString())

    const [deviceId, rfid] = message.toString().split(';')
    const responceFn = code => this.sendDeviceResponse(deviceId, code)

    if ((deviceId && deviceId.length !== 0) && (rfid && rfid.length !== 0)) {
      const query = {
        rfid
      }

      query[`access.${deviceId}`] = {
        $exists: true
      }

      this.db.findOne(
        query,
        (err, member) => this.handleMemberResponse(responceFn, err, member)
      )
    } else {
      responceFn('invalid-device')
    }
  }

  handleMemberResponse(responceFn, err, member) {
    this.log('handleMemberResponse', err, member)

    if (member) {
      const { membership_expiry_days } = member

      if (membership_expiry_days === 0) {
        responceFn('expired-key')
      } else if (membership_expiry_days <= 7) {
        responceFn('expiring-key')
      } else {
        responceFn('valid-key')
      }
    } else {
      responceFn('invalid-key')
    }
  }
}

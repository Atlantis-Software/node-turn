const crypto = require('crypto');
const CONSTANTS = require('./constants');
const Data = require('./data');
const Address = require('./address');

  /*
  * STUN Attributes https://tools.ietf.org/html/rfc5389#section-15
  *
  *     0                   1                   2                   3
  *     0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
  *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  *    |         Type                  |            Length             |
  *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  *    |                         Value (variable)                ....
  *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  */

var attribute = function(msg, name, value) {
  if (!msg) {
    throw new Error('Attribute constructor need a parent Message Object as first argument');
  }
  this.msg = msg;
  this.name = name || null;
  this.type = null;
  this.length = 0;
  this.value = null;
  this.padding = 0;

  if (name) {

    var attributeName = name.replace(/-/g, '_').toUpperCase();
    this.type = CONSTANTS.ATTR[attributeName];

    if (!this.type) {
      throw new Error('invalid attribute name: ' + name);
    }
  
    this.value = value;

    switch(this.type) {
      case CONSTANTS.ATTR.MAPPED_ADDRESS:
        this.length = 8;
        if (this.value.family === CONSTANTS.TRANSPORT.FAMILY.IPV6) {
          this.length = 20;
        }
        break;
  
      case CONSTANTS.ATTR.USERNAME:
        this.length = this.value.length;
        break;
  
      case CONSTANTS.ATTR.MESSAGE_INTEGRITY:
        this.length = 20;
        break;
  
      case CONSTANTS.ATTR.ERROR_CODE:
        this.length = 4 + this.value.reason.length;
        break;
  
      case CONSTANTS.ATTR.UNKNOWN_ATTRIBUTES:
        break;
  
      case CONSTANTS.ATTR.REALM:
        this.length = this.value.length;
        break;
      
      case CONSTANTS.ATTR.NONCE:
        this.length = this.value.length;
        break;
  
      case CONSTANTS.ATTR.XOR_MAPPED_ADDRESS:
      case CONSTANTS.ATTR.XOR_PEER_ADDRESS:
      case CONSTANTS.ATTR.XOR_RELAYED_ADDRESS:
        this.length = 8;
        if (this.value.family === CONSTANTS.TRANSPORT.FAMILY.IPV6) {
          this.length = 20;
        }
        break;
  
      // Comprehension-optional range (0x8000-0xFFFF)
      case CONSTANTS.ATTR.SOFTWARE:
        this.length = this.value.length;
        break;
  
      case CONSTANTS.ATTR.ALTERNATE_SERVER:
        break;
  
      case CONSTANTS.ATTR.FINGERPRINT:
        break;
  
      // https://tools.ietf.org/html/rfc5766#section-6.2
      case CONSTANTS.ATTR.CHANNEL_NUMBER:
        this.length = 4;
        break;
  
      case CONSTANTS.ATTR.LIFETIME:
        this.length = 4;
        break;
  
      case CONSTANTS.ATTR.DATA:
        this.length = this.value.length;
        break;
  
      case CONSTANTS.ATTR.EVEN_PORT:
        this.length = 1;
        break;
  
      case CONSTANTS.ATTR.REQUESTED_TRANSPORT:
        this.length = 4;
        break;
  
      case CONSTANTS.ATTR.DONT_FRAGMENT:
        this.length = 0;
        break;
  
      case CONSTANTS.ATTR.RESERVATION_TOKEN:
        this.length = 8;
        break;

      default:
        throw new Error('invalid type ' + name);
        break;
    }
  }

  this.padding = this.length % 4 ? 4 - (this.length % 4) : 0;
};

attribute.prototype.read = function(data) {
  var self = this;
  this.type = data.readUIntBE(0, 2);
  this.length = data.readUIntBE(2, 2);
  this.padding = this.length % 4 ? 4 - (this.length % 4) : 0;
  switch(this.type) {
    case CONSTANTS.ATTR.ALTERNATE_SERVER:
      this.value = data.readUIntBE(4, this.length);
      break;
    case CONSTANTS.ATTR.CHANNEL_NUMBER:
      this.value = data.readUIntBE(4, 2);
      break;
    case CONSTANTS.ATTR.DATA:
      this.value = data.slice(4, this.length + 4);
      break;
    case CONSTANTS.ATTR.DONT_FRAGMENT:
      this.value = true;
      break;
    case CONSTANTS.ATTR.ERROR_CODE:
      this.value = data.readUIntBE(4, this.length);
      break;
    case CONSTANTS.ATTR.EVEN_PORT:
      /*
      *      0
      *      0 1 2 3 4 5 6 7
      *     +-+-+-+-+-+-+-+-+
      *     |R|    RFFU     |
      *     +-+-+-+-+-+-+-+-+
      */
      this.value = data.readBit(32);
      break;
    case CONSTANTS.ATTR.FINGERPRINT:
      this.value = data.readUIntBE(4, this.length);
      break;
    case CONSTANTS.ATTR.LIFETIME:
      this.value = data.readUIntBE(4, this.length);
      break;
    case CONSTANTS.ATTR.MAPPED_ADDRESS:
      this.value = data.readUIntBE(4, this.length);
      break;
    case CONSTANTS.ATTR.MESSAGE_INTEGRITY:
      this.value = data.toString('hex', 4, 4 + this.length);
      break;
    case CONSTANTS.ATTR.NONCE:
      this.value = data.toString('utf8', 4, 4 + this.length);
      break;
    case CONSTANTS.ATTR.REALM:
      this.value = data.toString('utf8', 4, 4 + this.length);
      break;
    case CONSTANTS.ATTR.REQUESTED_TRANSPORT:
      this.value = data.readUIntBE(4, 1);
      break;
    case CONSTANTS.ATTR.RESERVATION_TOKEN:
      this.value = data.readUIntBE(4, this.length);
      break;
    case CONSTANTS.ATTR.SOFTWARE:
      this.value = data.toString('utf8', 4, 4 + this.length);
      break;
    case CONSTANTS.ATTR.UNKNOWN_ATTRIBUTES:
      this.value = data.readUIntBE(4, this.length);
      break;
    case CONSTANTS.ATTR.USERNAME:
      this.value = data.toString('utf8', 4, 4 + this.length);
      break;
    case CONSTANTS.ATTR.XOR_MAPPED_ADDRESS:
    case CONSTANTS.ATTR.XOR_PEER_ADDRESS:
    case CONSTANTS.ATTR.XOR_RELAYED_ADDRESS:
      var family = data.readUIntBE(5, 1);
      var xport = data.readUIntBE(6, 2);
      var port = xport ^ (this.msg.magicCookie >> 16);
      var xaddress = data.readUIntBE(8, 4);
      var addressVal = xaddress ^ this.msg.magicCookie;
      var address = [];
      address.push(parseInt(addressVal / Math.pow(2, 24)));
      address.push(parseInt((addressVal % Math.pow(2, 24))/ Math.pow(2, 16)));
      address.push(parseInt((addressVal % Math.pow(2, 16))/ Math.pow(2, 8)));
      address.push(addressVal % Math.pow(2, 8));
      address = address.join('.');
      this.value = new Address(family, address, port);
      break;
    default:
      throw new Error('Invalid Attribute type ' + this.type.toString(16));
      break;
  }

  Object.keys(CONSTANTS.ATTR).forEach(function(name) {
    if (CONSTANTS.ATTR[name] === self.type) {
      self.name = name.replace(/_/g, '-').toLowerCase();
    }
  });
};

attribute.prototype.toBuffer = function() {
  var attrValue = Data.alloc(this.length);
  switch(this.type) {
    case CONSTANTS.ATTR.MAPPED_ADDRESS:
      /*
      * MAPPED-ADDRESS https://tools.ietf.org/html/rfc5389#section-15.1
      *      0                   1                   2                   3
      *      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
      *      +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      *      |0 0 0 0 0 0 0 0|    Family     |           Port                |
      *      +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      *      |                                                               |
      *      |                 Address (32 bits or 128 bits)                 |
      *      |                                                               |
      *      +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      */

      // value: Address Object

      // write family
      attrValue.writeUIntBE(this.value.family, 1, 1);
      // write port
      attrValue.writeUIntBE(this.value.port, 2, 2);
      // write address
      if (this.value.family === CONSTANTS.TRANSPORT.FAMILY.IPV4) {
        var ip = this.value.address.split('.');
        attrValue.writeIntBE(parseInt(ip[0]), 4, 1);
        attrValue.writeIntBE(parseInt(ip[1]), 5, 1);
        attrValue.writeIntBE(parseInt(ip[2]), 6, 1);
        attrValue.writeIntBE(parseInt(ip[3]), 7, 1);
      } else {
        // TODO encode IPV6 address
      }
      break;

    case CONSTANTS.ATTR.USERNAME:
      // value: string (username)
      attrValue.write(value);
      break;

    case CONSTANTS.ATTR.MESSAGE_INTEGRITY:
      /*
      *  value: void 0
      */
      if (!this.msg.hmacInput || !this.msg.hmacInput.length) {
        throw new Error('Invalid Message for MESSAGE_INTEGRITY attribute');
      }
      if (!this.msg.user) {
        throw new Error('MESSAGE_INTEGRITY attribute require an Auth User');
      }
      if (!this.msg.user.hmacKey || !this.msg.user.hmacKey.length) {
        throw new Error('Invalid Message User for MESSAGE_INTEGRITY attribute');
      }

      attrValue = crypto.createHmac('sha1', this.msg.user.hmacKey).update(this.msg.hmacInput).digest();
      this.value = attrValue.toString('hex');
      break;

    case CONSTANTS.ATTR.ERROR_CODE:
      /*
      * ERROR-CODE https://tools.ietf.org/html/rfc5389#section-15.6
      *  
      *     0                   1                   2                   3
      *     0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
      *     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      *     |           Reserved, should be 0         |Class|     Number    |
      *     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      *     |      Reason Phrase (variable)                                ..
      *     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      */

      /*
      *   value: Object
      *     code: integer (in range of 300 to 699)
      *     reason: string (length < 128)
      */

      // ensure code is in the range of 300 to 699
      if (this.value.code < 300 || this.value.code > 699) {
        throw new Error('invalid code argument for error-code attribute, code MUST be in range of 300 to 699');
      }
      // ensure reason length is lower than 128
      if (this.value.reason.length > 128) {
        throw new Error('invalid reason argument for error-code attribute, reason MUST be shorter than 128 characters');
      }
      var errorClass = parseInt(this.value.code / 100);
      var errorNumber = this.value.code % 100;

      attrValue.writeUncontiguous(errorClass, [21, 22, 23]);
      attrValue.writeIntBE(errorNumber, 3, 1);
      attrValue.write(this.value.reason, 4);
      break;

    case CONSTANTS.ATTR.UNKNOWN_ATTRIBUTES:
      break;

    case CONSTANTS.ATTR.REALM:
      attrValue.write(this.value);
      break;
    
    case CONSTANTS.ATTR.NONCE:
      attrValue.write(this.value);
      break;

    case CONSTANTS.ATTR.XOR_MAPPED_ADDRESS:
    case CONSTANTS.ATTR.XOR_PEER_ADDRESS:
    case CONSTANTS.ATTR.XOR_RELAYED_ADDRESS:
      /*    
      * XOR-MAPPED-ADDRESS https://tools.ietf.org/html/rfc5389#section-15.2
      *
      *       0                   1                   2                   3
      *       0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
      *      +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      *      |x x x x x x x x|    Family     |         X-Port                |
      *      +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      *      |                X-Address (Variable)
      *      +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      */

      // value: Transport Object

      // write family
      attrValue.writeUIntBE(this.value.family, 1, 1);
      // write X-Port (the mapped port XOR'ing it with the most significant 16 bits of the magic cookie)
      attrValue.writeUIntBE((this.value.port ^ (this.msg.magicCookie >> 16)), 2, 2);
      // write X-Address
      if (this.value.family === CONSTANTS.TRANSPORT.FAMILY.IPV4) {
        var ip = this.value.address.split('.');
        var address = parseInt(ip[0]) * Math.pow(2, 24);
        address += parseInt(ip[1]) * Math.pow(2, 16);
        address += parseInt(ip[2]) * Math.pow(2, 8);
        address += parseInt(ip[3]);
        var xorAddress = address ^ this.msg.magicCookie;
        attrValue.writeUIntBE(xorAddress, 4, 4);
      } else {
        // TODO encode IPV6 address
      }
      break;

    // Comprehension-optional range (0x8000-0xFFFF)
    case CONSTANTS.ATTR.SOFTWARE:
      attrValue.write(this.value);
      break;

    case CONSTANTS.ATTR.ALTERNATE_SERVER:
      break;

    case CONSTANTS.ATTR.FINGERPRINT:
      break;

    // https://tools.ietf.org/html/rfc5766#section-6.2
    case CONSTANTS.ATTR.CHANNEL_NUMBER:
      break;

    case CONSTANTS.ATTR.LIFETIME:
      // value: integer (number of seconds remaining until expiration.)
      attrValue.writeUIntBE(this.value, 0, 4);
      break;

    case CONSTANTS.ATTR.DATA:
      // value: Buffer
      attrValue = this.value;
      break;

    case CONSTANTS.ATTR.EVEN_PORT:
      // value: Boolean
      if (this.value) {
        attrValue.writeIntBE(0x80, 0, 1);
      }
      break;

    case CONSTANTS.ATTR.REQUESTED_TRANSPORT:
      // value: CONSTANTS.TRANSPORT.PROTOCOL
      attrValue.writeIntBE(this.value, 0, 1);
      break;

    case CONSTANTS.ATTR.DONT_FRAGMENT:
      // nothing to do
      break;

    case CONSTANTS.ATTR.RESERVATION_TOKEN:
      // 0 - String: token value
      attrValue.write(this.value);
      break;
    
    default:
      throw new Error('invalid type ' + this.type);
      break;
  }

  var attrHeader = Buffer.alloc(4);
  attrHeader.writeUIntBE(this.type, 0, 2);
  attrHeader.writeUIntBE(this.length, 2, 2);
  return Buffer.concat([attrHeader, attrValue, Buffer.alloc(this.padding)]);
};

module.exports = attribute;

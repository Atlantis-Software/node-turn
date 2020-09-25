const crypto = require('crypto');
const Data = require('./data');
const Attribute = require('./attribute');
const CONSTANTS = require('./constants');
const crc = require('crc');

const STATE_WAITING   = 0;
const STATE_RESOLVED  = 1;
const STATE_REJECTED  = 2;
const STATE_DISCARDED = 3;
const STATE_INCOMMING = 4;

/*
 * The most significant 2 bits of every STUN message MUST be zeroes
 *
 *
 *        0                   1                   2                   3
 *        0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |0 0|     STUN Message Type     |         Message Length        |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                         Magic Cookie                          |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                                                               |
 *        |                     Transaction ID (96 bits)                  |
 *        |                                                               |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *
 * STUN Message Type:
 *
 *         0                 1
 *         2  3  4 5 6 7 8 9 0 1 2 3 4 5
 *
 *        +--+--+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |M |M |M|M|M|C|M|M|M|C|M|M|M|M|
 *        |11|10|9|8|7|1|6|5|4|0|3|2|1|0|
 *        +--+--+-+-+-+-+-+-+-+-+-+-+-+-+
 */


var message = function(server, transport) {
  this.server = server;
  this.transport = transport;
  this.allocation = null;
  this.class = null;
  this.method = null;
  this.useFingerprint = false;
  this.length = 0;
  this.raw = Buffer.alloc(0);
  this.attributes = [];
  this.magicCookie = CONSTANTS.MAGIC_COOKIE;
  this.transactionID = null;
  this.user = null;
  this.hmacInput = null;
  this._state = STATE_WAITING;
  this.debugLevel = server.debugLevel;
  this.debug = server.debug.bind(server);
};

message.prototype.read = function(udpMessage) {

  this._state = STATE_INCOMMING;

  if (!udpMessage) {
    return false;
  }

  udpMessage = new Data(udpMessage);

  var firstBit = udpMessage.readBit(0);
  var secondBit = udpMessage.readBit(1);

  // The most significant 2nd bits of every TURN message MUST be zeroes.
  if (firstBit || secondBit) {
    return false;
  }

  // read class C1 7th bit and C0 11th bit
  this.class = udpMessage.readUncontiguous([7, 11]);

  // read method from M11 to M0
  this.method = udpMessage.readUncontiguous([2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15]);

  var messageLength = udpMessage.readInt16BE(2);

  // check message length
  if (messageLength + 20 > udpMessage.length) {
    throw new Error('invalid STUN message length');
  }

  this.magicCookie = udpMessage.readUInt32BE(4);

  // check magic cookie
  if (this.magicCookie != CONSTANTS.MAGIC_COOKIE) {
    return false;
  }

  this.transactionID = udpMessage.toString('hex', 8, 20);

  // read attributes
  var attributes = udpMessage.slice(20);


  while (attributes.length >= 4) {
    var attribute = new Attribute(this);
    attribute.read(attributes);


    if (attribute.type === CONSTANTS.ATTR.MESSAGE_INTEGRITY) {
      let hmacInput = udpMessage.slice(0, 20 + this.length);
      let username = this.getAttribute('username');
      if (!username) {
        this.debug('DEBUG', 'no username sent');
        attribute.value = false;
      } else {
        let password = this.server.authentification.credentials[username];
        if (!password) {
          this.debug('DEBUG', 'invalid user');
          attribute.value = false;
        } else {
          let hmacKey = crypto.createHash('md5').update(username + ':' + this.server.realm  + ':' + password).digest();
          // update message length to compute hmac
          let previousLength = hmacInput.readInt16BE(2);
          hmacInput.writeInt16BE(this.length + 24, 2);
          let hmac = crypto.createHmac('sha1', hmacKey).update(hmacInput).digest('hex');
          // reset message length for fingerprint
          hmacInput.writeInt16BE(previousLength, 2);
          if (hmac !== attribute.value) {
            this.debug('DEBUG', 'invalid message-integrity, should be ' + hmac + ' instead of ' + attribute.value);
            attribute.value = false;
          }
        }
      }
    }
    if (attribute.type === CONSTANTS.ATTR.FINGERPRINT) {
      this.useFingerprint = true;
      let toHash = udpMessage.slice(0, 20 + this.length);
      let fingerprint = Buffer.alloc(4);
      fingerprint.writeUIntBE(crc.crc32(toHash), 0, 4);
      let xor = Buffer.alloc(4);
      xor.writeUIntBE(0x5354554e, 0, 4);
      fingerprint.forEach(function(byte, i) {
        fingerprint[i] = (parseInt(byte, 10) & 0xff) ^ xor[i];
      });
      if (fingerprint.readUIntBE(0,4) !== attribute.value) {
        // fingerprint is invalid
        attribute.value = false;
      }
    }
    this.attributes.push(attribute);
    this.length += 4 + attribute.length + attribute.padding;
    attributes = attributes.slice(4 + attribute.length + attribute.padding);
  }

  // all tests passed so this is a valid STUN message
  return true;
};

message.prototype.reply = function() {
  var replyMsg = new message(this.server, this.transport.revert());
  replyMsg.class = this.class;
  replyMsg.method = this.method;
  replyMsg.magicCookie = this.magicCookie;
  replyMsg.transactionID = this.transactionID;
  replyMsg.useFingerprint = this.useFingerprint;
  return replyMsg;
};

message.prototype.getMethodName = function() {
  var self = this;
  var method = "unknown-method";
  Object.keys(CONSTANTS.METHOD).forEach(function(methodName) {
    if (self.method === CONSTANTS.METHOD[methodName]) {
      method = methodName.toLowerCase();
    }
  });
  return method;
};

message.prototype.getClassName = function() {
  var self = this;
  var _class = "unknown-class";
  Object.keys(CONSTANTS.CLASS).forEach(function(className) {
    if (self.class === CONSTANTS.CLASS[className]) {
      _class = className.toLowerCase();
    }
  });
  return _class;
};

message.prototype.setUser = function(user) {
  this.user = user;
};

message.prototype.addAttribute = function(name, value) {
  if (!name) {
    throw new Error('addAttribute require a name as first argument');
  }
  // skip message-integrity when no user is registered
  if (name === 'message-integrity' && !this.user) {
    return;
  }
  var attribute = new Attribute(this, name, value);
  this.attributes.push(attribute);
  // update length
  this.length += 4 + attribute.length + attribute.padding;
};

message.prototype.getAttribute = function(name) {
  var attributeName = name.replace(/-/g, '_').toUpperCase();
  var type = CONSTANTS.ATTR[attributeName];
  var attribute = null;
  this.attributes.forEach(function(attr) {
    if (attr.type === type) {
      attribute = attribute || attr;
    }
  });
  if (attribute && attribute.value !== void 0) {
    return attribute.value;
  }
  return void 0;
};

message.prototype.getAttributes = function(name) {
  var attributeName = name.replace(/-/g, '_').toUpperCase();
  var type = CONSTANTS.ATTR[attributeName];
  var attributes = [];
  this.attributes.forEach(function(attr) {
    if (attr.type === type) {
      attributes.push(attr.value);
    }
  });
  return attributes;
};

message.prototype.toBuffer = function() {
  var self = this;

  // add fingerprint if it was used
  if (this.useFingerprint) {
    this.addAttribute('fingerprint');
  }

  var header = new Data(Buffer.alloc(20));
  // write two first bits to 0
  header.writeBit(0, 0);
  header.writeBit(0, 1);
  // write method in header
  header.writeUncontiguous(this.method, [2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15]);
  // write success class in header
  header.writeUncontiguous(this.class, [7, 11]);

  // write message length
  header.writeUInt16BE(this.length, 2);

  // write Magic Cookie
  header.writeUInt32BE(this.magicCookie, 4);

  // write transactionID
  header.write(this.transactionID, 8, 20, 'hex');

  this.raw = header;

  this.attributes.forEach(function(attribute) {
    self.raw = Buffer.concat([self.raw, attribute.toBuffer()]);
  });

  return this.raw;

};

message.prototype.resolve = function() {
  var self = this;

  if (this._state !== STATE_WAITING) {
    return;
  }

  this.class = CONSTANTS.CLASS.SUCCESS;

  var msg = this.toBuffer();

  this._state = STATE_RESOLVED;

  this.transport.socket.send(msg, this.transport.dst.port, this.transport.dst.address, function(err) {
    if (err) {
      self.debug('FATAL', 'Fatal error while responding to ' + self.transport.dst + ' TransactionID: ' + self.transactionID + '\n' + self);
      self.debug('FATAL', err);
      return;
    }
    self.debug('DEBUG', 'Sending ' + self);
  });
};

message.prototype.reject = function(code, reason) {
  var self = this;

  if (this._state !== STATE_WAITING) {
    return;
  }

  this.class = CONSTANTS.CLASS.ERROR;
  this.addAttribute('error-code', {
    code: code,
    reason: reason
  });
  this._state = STATE_REJECTED;
  var msg = this.toBuffer();
  this.transport.socket.send(msg, this.transport.dst.port, this.transport.dst.address, function(err) {
    if (err) {
      self.debug('FATAL', 'Fatal error while responding to ' + self.transport.dst + ' TransactionID: ' + self.transactionID  + '\n' + self);
      self.debug('FATAL', err);
      return;
    }
    self.debug('DEBUG', 'Sending ' + self);
  });
};

message.prototype.discard = function() {
  if (this._state !== STATE_WAITING) {
    return;
  }
  this._state = STATE_DISCARDED;
  this.debug('DEBUG', 'Discarding ' + this);
};

message.prototype.data = function(data) {
  if (this._state !== STATE_WAITING) {
    return;
  }
  var self = this;
  this._state = STATE_RESOLVED;
  this.class = CONSTANTS.CLASS.INDICATION;
  this.method = CONSTANTS.METHOD.DATA;
  this.addAttribute('data', data);
  // generate a transactionID
  crypto.randomBytes(12, function(err, buf) {
    if (err) {
      self.debug('FATAL', 'Fatal error while generating TransactionID, indicating to ' + self.transport.dst  + '\n' + self);
      self.debug('FATAL', err);
      return;
    }
    self.transactionID = buf.toString('hex');
    var msg = self.toBuffer();
    self.transport.socket.send(msg, self.transport.dst.port, self.transport.dst.address, function(err) {
      if (err) {
        self.debug('FATAL', 'Fatal error while indicating to ' + self.transport.dst + ' TransactionID: ' + self.transactionID  + '\n' + self);
        self.debug('FATAL', err);
        return;
      }
      self.debug('DEBUG', 'Sending ' + self);
    });
  });
};

message.prototype.toString = function() {
  var self = this;
  var str = '';

  if (this.debugLevel <= CONSTANTS.DEBUG_LEVEL.DEBUG) {
    str = this.transport + ' ' + this.getMethodName() + ' ' + this.getClassName() + ' TransactionID: ' + this.transactionID;
    var indent = '  ';
    this.attributes.forEach(function(attribute) {
      if (Buffer.isBuffer(attribute.value)) {
        if (self.debugLevel <= CONSTANTS.DEBUG_LEVEL.TRACE) {
          str += '\n' + indent + attribute.name + ': ';
          attribute.value.toString('hex').match(/.{1,32}/g).forEach(function(bin) {
            str += '\n' + indent + indent + bin;
          });
          return;
        }
        str += '\n' + indent + attribute.name + ': [ Binary data length: ' + attribute.value.length + ' ]';
        return;
      } else if (attribute.name === 'error-code') {
        str += '\n' + indent + attribute.name + ": " + attribute.value.code + ' ' + attribute.value.reason;
        return;
      }
      str += '\n' + indent + attribute.name + ": " + attribute.value;
    });
  }
  return str;
};

module.exports = message;

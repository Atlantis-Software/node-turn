const crypto = require('crypto');
const dgram = require('dgram');
const CONSTANTS = require('../constants');
const Allocation = require('../allocation');

var allocate = function(server) {
  var self = this;
  this.server = server;
  this.lastRelayIp = this.server.relayIps[0];

  this.server.on('allocate', function(msg, reply) {
    self.allocate(msg, reply);
  });
};

allocate.prototype.allocate = function(msg, reply) {
  var self = this;
  if (msg.allocation) {
    // check if it's a retransmission
    if (msg.allocation.transactionID === msg.transactionID) {
      msg.allocation.update();
      reply.addAttribute('xor-relayed-address', msg.allocation.relayedTransportAddress);
      reply.addAttribute('lifetime', msg.allocation.lifetime);
      reply.addAttribute('xor-mapped-address', msg.allocation.mappedAddress);
      reply.addAttribute('software', self.server.software);
      reply.addAttribute('message-integrity');
      return reply.resolve();
    }
    return reply.reject(437, 'Allocation Mismatch');
  }
  if (!msg.getAttribute('requested-transport')) {
    return reply.reject(400, 'Bad Request');
  } else if (msg.getAttribute('requested-transport') !== CONSTANTS.TRANSPORT.PROTOCOL.UDP) {
    return reply.reject(442, 'Unsupported Transport Protocol');
  }
  if (msg.getAttribute('dont-fragment')) {
    // TODO
    // send UDP datagrams with the DF bit set to 1
  }
  if (msg.getAttribute('reservation-token')) {
    if (msg.getAttribute('even-port')) {
      return reply.reject(400, 'Bad Request');
    }
    if (!this.checkToken(msg.getAttribute('reservation-token'))) {
      return reply.reject(508, 'Insufficient Capacity');
    }
  }

  if (msg.getAttribute('even-port') !== void 0) {
    // server checks that it can satisfy the request
    if (!1) {
      return reply.reject(508, 'Insufficient Capacity');
    }
  }

  if (!this.checkQuota(msg.getAttribute('username'))) {
    return reply.reject(486, 'Allocation Quota Reached');
  }

  var allocatedSockets = null;
  // chooses a relayed transport address for the allocation.
  if (msg.getAttribute('reservation-token')) {
    // uses the previously reserved transport address corresponding to the included token
    allocatedSockets = new Promise(function(resolve, reject) {
      resolve(this.server.reservations[msg.getAttribute('reservation-token')].socket);
    });
  } else if (msg.getAttribute('even-port') !== void 0) {
    // R bit set to 0
    if (!msg.getAttribute('even-port')) {
      // allocate a relayed transport address with an even port number
      allocatedSockets = this.allocateUdpEven(msg, false);
    } else {
      // R bit set to 1
      // look for a pair of port numbers N and N+1 on the same IP address, where N is even
      allocatedSockets = this.allocateUdpEven(msg, true);
    }
  } else {
    // allocates any available relayed transport address from the range 49152 - 65535
    allocatedSockets = this.allocateUdp(msg);
  }

  allocatedSockets.then(function(sockets) {
    try {
      // determine the initial value of the time-to-expiry
      var lifetime = self.server.defaultAllocatetLifetime;

      if (msg.getAttribute('liftetime')) {
        lifetime = Math.min(msg.getAttribute('liftetime'), self.server.maxAllocateLifetime);
      }

      if (lifetime < self.server.defaultAllocatetLifetime) {
        lifetime = self.server.defaultAllocatetLifetime;
      }

      msg.allocation = new Allocation(msg, sockets, lifetime);

      reply.addAttribute('xor-relayed-address', msg.allocation.relayedTransportAddress);
      reply.addAttribute('lifetime', msg.allocation.lifetime);
      reply.addAttribute('xor-mapped-address', msg.allocation.mappedAddress);
      reply.addAttribute('software', self.server.software);
      reply.addAttribute('message-integrity');
      reply.resolve();

    } catch(e) {
      msg.debug('FATAL', e);
      reply.reject(500, 'Server Error');
    }
  }, function(err) {
    reply.reject(508, 'Insufficient Capacity');
  });
};

// returns a 32-bit pseudo-random unsigned integer number
var random = function(cb) {
  return crypto.randomBytes(4, function(err, buf) {
    if (err) {
      return cb(err);
    }
    cb(null, buf.readUInt32BE(0, true));
  });
};

/*  https://tools.ietf.org/html/draft-ietf-tsvwg-port-randomization-09#section-3.3.2

    // Ephemeral port selection function 
    num_ephemeral = max_ephemeral - min_ephemeral + 1;
    next_ephemeral = min_ephemeral + (random() % num_ephemeral);
    count = num_ephemeral;

    do {
        if(check_suitable_port(port))
                return next_ephemeral;

        next_ephemeral = min_ephemeral + (random() % num_ephemeral);
        count--;
    } while (count > 0);

    return ERROR;
*/

allocate.prototype.allocateUdp = function(msg) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var num_ephemeral = self.server.maxPort - self.server.minPort + 1;
    random(function(err, rand) {
      if (err) {
        return reject(err);
      }
      var next_ephemeral = self.server.minPort + (rand % num_ephemeral);
      var count = num_ephemeral;
      const udpSocket = dgram.createSocket('udp4');
      (function _alloc() {
        udpSocket.on('listening', function() {
          udpSocket.removeAllListeners();
          resolve([udpSocket]);
        });
        udpSocket.on('error', function(err) {
          udpSocket.removeAllListeners();
          random(function(err, rand) {
            if (err) {
              reject(err);
            }
            next_ephemeral = self.server.minPort + (rand % num_ephemeral);
            count--;
            if (count > 0) {
              return _alloc();
            }
            udpSocket.close();
            reject(new Error('no available port in range'));
          });
        });
        udpSocket.bind({
          address: self.getRelayIp(msg),
          port: next_ephemeral,
          exclusive: true
        });
      })();
    });
  });
};

allocate.prototype.allocateUdpEven = function(msg, evenPortRBit) {
  var port1 = msg.transport.src.port;
  var self = this;
  return new Promise(function(resolve, reject) {
    var sock1 = null;
    var sock2 = null;

    if (port1 < self.server.minPort) {
      return reject(new Error('no available port in range'));
    }
    const udpSocket1 = dgram.createSocket('udp4');
    udpSocket1.on('listening', function() {
      udpSocket1.removeAllListeners();
      sock1 = udpSocket1;
      if (sock2) {
        return resolve([sock1, sock2]);
      }
      if (!evenPortRBit) {
        return resolve([sock1]);
      }
    });
    udpSocket1.on('error', function(err) {
      udpSocket1.removeAllListeners();
      udpSocket1.close();
      if (sock2) {
        sock2.close();
      }
      reject(err);
    });
    udpSocket1.bind({
      address: self.getRelayIp(msg),
      port: port1,
      exclusive: true
    });

    // R Bit = 1
    if (evenPortRBit) {
      var port2 = port1 + 1;
      if (port2 > self.server.maxPort) {
        return reject(new Error('no available port in range'));
      }
      const udpSocket2 = dgram.createSocket('udp4');
      udpSocket2.on('listening', function() {
        udpSocket2.removeAllListeners();
        sock2 = udpSocket2;
        if (sock1) {
          return resolve([sock1, sock2]);
        }
      });
      udpSocket2.on('error', function(err) {
        udpSocket2.removeAllListeners();
        udpSocket2.close();
        if (sock1) {
          sock1.close();
        }
        reject(err);
      });
      udpSocket2.bind({
        address: self.getRelayIp(msg),
        port: port2,
        exclusive: true
      });
    }
  });
};

allocate.prototype.getRelayIp = function(msg) {
  if (!this.server.relayIps || this.server.relayIps.length === 0) {
    return msg.transport.dst.address;
  }
  var i = this.server.relayIps.indexOf(this.lastRelayIp) + 1;
  if (i >= this.server.relayIps.length) {
    i = 0;
  }
  this.lastRelayIp = this.server.relayIps[i];
  return this.lastRelayIp;
};

allocate.prototype.checkToken = function(token) {
  return this.server.reservations[token] !== void 0;
};

allocate.prototype.checkQuota = function(username) {
  // TODO
  return true;
};

module.exports = allocate;

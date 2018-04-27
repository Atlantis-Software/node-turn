const CONSTANTS = require('./constants');
const Address = require('./address');
const Message = require('./message');
const ChannelMsg = require('./channelMessage');

var allocation = function(msg, sockets, lifetime) {
  var self = this;
  // track transactionID for Retransmissions
  this.transactionID = msg.transactionID;
  this.transport = msg.transport.revert();
  this.fiveTuple = msg.transport.get5Tuple();
  this.user = msg.user;
  this.server = msg.server;
  this.debug = msg.debug;
  this.sockets = sockets;
  var relayed = sockets[0].address();
  this.relayedTransportAddress = new Address(CONSTANTS.TRANSPORT.FAMILY.IPV4, relayed.address, relayed.port);
  this.lifetime = lifetime;
  this.mappedAddress = msg.transport.src;
  this.permissions = {};
  this.channelBindings = {};
  this.timeToExpiry = Date.now() + (this.lifetime * 1000);
  this.server.allocations[this.fiveTuple] = this;
  this.timer = setTimeout(function() {
    delete self.server.allocations[self.fiveTuple];
  }, this.lifetime * 1000);


  this.sockets.forEach(function(socket) {
    socket.on('message', function(data, rinfo) {
      // check permisson
      var permisson = self.permissions[rinfo.address];
      const from = new Address(CONSTANTS.TRANSPORT.FAMILY.IPV4, rinfo.address, rinfo.port);

      if (!permisson || permisson < Date.now()) {
        var socketAddress = socket.address();
        self.debug('TRACE', 'permission fail for ' + from + ' at ' +  socketAddress.address + ':' + socketAddress.port);
        return;
      }

      // check channel
      var channelNumber = self.getPeerChannelNumber(from);

      var channelMsg = new ChannelMsg();
      if (channelMsg.read(data)) {
        if (!channelNumber) {
          return;
        }
        if (channelNumber !== channelMsg.channelNumber) {
          return;
        }
        data = channelMsg.data;
      }

      if (channelNumber !== void 0) {

        var msg = new ChannelMsg(channelNumber, data);
        // The ChannelData message is then sent on the 5-tuple associated with the allocation
        return self.transport.socket.send(msg.write(), self.transport.dst.port, self.transport.dst.address, function(err) {
          if (err) {
            return self.debug('ERROR', err);
          }
          self.debug('TRACE', 'relaying data from' + from + ' over channelNumber ' + channelNumber + ' to ' + self.transport.dst);
        });
      }

      // if no channel bound to the peer
      var DataIndication = new Message(self.server, self.transport);

      // XOR-PEER-ADDRESS attribute is set to the source transport address of the received UDP datagram
      DataIndication.addAttribute('xor-peer-address', from);
      DataIndication.data(data);
    });
  });
};

allocation.prototype.update = function(lifetime) {
  var self = this;
  clearTimeout(this.timer);
  if (lifetime) {
    this.debug('TRACE', 'updateting allocation ' + this.relayedTransportAddress + ' lifetime: ' + lifetime);
    this.timer = setTimeout(function() {
      delete self.server.allocations[self.fiveTuple];
    }, lifetime * 1000);
    return this.timeToExpiry = Date.now() + (lifetime * 1000);
  }
  this.debug('TRACE', 'updateting allocation ' + this.relayedTransportAddress + ' lifetime: ' + this.lifetime);
  this.timer = setTimeout(function() {
    delete self.server.allocations[self.fiveTuple];
  }, lifetime * 1000);
  this.timeToExpiry = Date.now() + (this.lifetime * 1000);
};

allocation.prototype.permit = function(address) {
  this.debug('TRACE', 'add permission for ' + address + ' to allocation ' + this.relayedTransportAddress);
  this.permissions[address] = Date.now() + 300000; // 5 minutes
};

allocation.prototype.getPeerChannelNumber = function(peer) {
  var self = this;
  var channelNumber = void 0;
  var peerAddress = peer.toString();
  Object.keys(self.channelBindings).forEach(function(chanNumber) {
    var channel = self.channelBindings[chanNumber];
    if (channel && channel.toString() === peerAddress) {
      channelNumber = parseInt(chanNumber);
    }
  });
  return channelNumber;
};

module.exports = allocation;
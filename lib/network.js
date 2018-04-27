const dgram = require('dgram');
const Message = require('./message');
const Transport = require('./transport');
const Address = require('./address');
const CONSTANTS = require('./constants');

var network = function(server) {
  this.sockets = [];
  this.server = server;
  this.listeningIps = server.listeningIps;
  this.listeningPort = server.listeningPort;
  this.debug = server.debug.bind(server);
  this.debugLevel = server.debugLevel;
};

network.prototype.start = function() {
  var self = this;
  this.listeningIps.forEach(function(ip) {
    const udpSocket = dgram.createSocket('udp4');
    const dst = new Address(CONSTANTS.TRANSPORT.FAMILY.IPV4, ip, self.listeningPort);

    udpSocket.on('error', function(err) {
      self.debug('FATAL', err);
    });

    udpSocket.on('message', function(udpMessage, rinfo) {
      // shoud detect destination address for dst but https://github.com/nodejs/node/issues/1649
      const src = new Address(CONSTANTS.TRANSPORT.FAMILY.IPV4, rinfo.address, rinfo.port);
      const transport = new Transport(CONSTANTS.TRANSPORT.PROTOCOL.UDP, src, dst, udpSocket);
      var msg = new Message(self.server, transport);
      if (msg.read(udpMessage)) {
        self.server.emit('message', msg);
      }
    });

    udpSocket.on('listening', function() {
      self.debug('INFO', 'Server is listening on ' + ip + ':' + self.listeningPort);
    });

    udpSocket.on('close', function() {
      self.debug('INFO', 'Server is no more listening on ' + ip + ':' + self.listeningPort);
    });

    udpSocket.bind({
      address: ip,
      port: self.listeningPort,
      exclusive: true
    });

    self.sockets.push(udpSocket);

  });
};

network.prototype.stop = function() {
  this.sockets.forEach(function(socket) {
    socket.close();
  });
};

module.exports = network;

var send = function(server) {
  var self = this;
  this.server = server;

  this.server.on('send', function(msg, reply) {
    self.send(msg, reply);
  });
};

send.prototype.send = function(msg) {
  var self = this;
  // the destination transport address is taken from the XOR-PEER-ADDRESS attribute
  var dst = msg.getAttribute('xor-peer-address');
  var data = msg.getAttribute('data');
  // var dontFragment = msg.getAttribute('dont-fragment');

  if (!dst || !data) {
    msg.debug('TRACE', 'Invalid attribute for ' + msg);
    return;
  }

  var permission = msg.allocation.permissions[dst.address];

  if (!permission || permission < Date.now()) {
    msg.debug('TRACE', 'No permission for ' + msg);
    return;
  }

  msg.allocation.sockets[0].send(data, dst.port, dst.address, function(err) {
    if (err) {
      return msg.debug('ERROR', err);
    }
    msg.debug('TRACE', 'relaying data from transactionID ' + msg.transactionID + ' to ' + dst);
  });
};

module.exports = send;

var channelBind = function(server) {
  var self = this;
  this.server = server;

  this.server.on('channel_bind', function(msg, reply) {
    self.channelBind(msg, reply);
  });
};

channelBind.prototype.channelBind = function(msg, reply) {
  var channelNumber = msg.getAttribute('channel-number');
  var peer = msg.getAttribute('xor-peer-address');

  // The request contains both a CHANNEL-NUMBER and an XOR-PEER-ADDRESS attribute
  if (!channelNumber || !peer) {
    msg.debug('TRACE', 'transactionID' + msg.transactionID + ' The request MUST contains both a CHANNEL-NUMBER and an XOR-PEER-ADDRESS attribute');
    return reply.reject(400, 'Bad Request');
  }

  // The channel number is in the range 0x4000 through 0x7FFE (inclusive)
  if (channelNumber < 0x4000 || channelNumber > 0x7FFE) {
    msg.debug('TRACE', 'transactionID' + msg.transactionID + ' The channel number MUST be in the range 0x4000 through 0x7FFE (inclusive)');
    return reply.reject(400, 'Bad Request');
  }

  var boundChannelNumber = msg.allocation.getPeerChannelNumber(peer);

  // The channel number is not currently bound to a different transport address (same transport address is OK)
  var channel = msg.allocation.channelBindings[channelNumber];
  if (channel && boundChannelNumber !== channelNumber) {
    msg.debug('TRACE', 'transactionID' + msg.transactionID + ' The channel number is currently bound to a different transport address');
    return reply.reject(400, 'Bad Request');
  }

  // The transport address is not currently bound to a different channel number
  if (boundChannelNumber && boundChannelNumber !== channelNumber) {
    msg.debug('TRACE', 'transactionID' + msg.transactionID + ' The transport address is currently bound to a different channel number');
    return reply.reject(400, 'Bad Request');
  }

  // If a value in the XOR-PEER-ADDRESS attribute is not allowed, the server rejects the request with a 403 (Forbidden) error.
  // TODO
  if (0) { // eslint-disable-line no-constant-condition
    return reply.reject(403, 'Forbidden');
  }

  // If the server is unable to fulfill the request, the server replies with a 508 (Insufficient Capacity) error.
  // TODO
  if (0) { // eslint-disable-line no-constant-condition
    return reply.reject(508, 'Insufficient Capacity');
  }

  msg.allocation.permit(peer.address);
  msg.allocation.channelBindings[channelNumber] = peer;

  reply.resolve();
};

module.exports = channelBind;

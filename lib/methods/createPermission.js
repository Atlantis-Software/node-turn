var createPermission = function(server) {
  var self = this;
  this.server = server;

  this.server.on('create_permission', function(msg, reply) {
    self.createPermission(msg, reply);
  });

};

createPermission.prototype.createPermission = function(msg, reply) {
  var xorPeerAddresses = msg.getAttributes('xor-peer-address');
  if (xorPeerAddresses.length === 0) {
    return reply.reject(400, 'Bad Request');
  }
  var badRequest = false;
  var permissions = [];
  xorPeerAddresses.forEach(function(xorPeerAddress) {
    if (!xorPeerAddress.address) {
      badRequest = true;
    }
    permissions.push(xorPeerAddress.address);
  });

  if (badRequest) {
    return reply.reject(400, 'Bad Request');
  }

  permissions.forEach(function(address) {
    msg.allocation.permit(address);
  });
  reply.addAttribute('software', this.server.software);
  reply.addAttribute('message-integrity');
  reply.resolve();
};

module.exports = createPermission;

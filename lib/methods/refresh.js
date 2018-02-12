var refresh = function(server) {
  var self = this;
  this.server = server;

  this.server.on('refresh', function(msg, reply) {
    self.refresh(msg, reply);
  });
};

refresh.prototype.refresh = function(msg, reply) {
  var desiredLifetime = this.server.defaultLifetime;
  var lifetime = msg.getAttribute('lifetime');
  if (lifetime !== void 0) {
    if (lifetime === 0) {
      desiredLifetime = 0;
    } else {
      desiredLifetime = Math.min(lifetime, this.server.maxAllocateTimeout);
    }
  }

  if (desiredLifetime === 0) {
    delete this.server.allocations[msg.transport.get5Tuple()];
  } else {
    msg.allocation.update(desiredLifetime);
  }
  reply.addAttribute('lifetime', desiredLifetime);
  reply.addAttribute('software', this.server.software);
  reply.addAttribute('message-integrity');
  reply.resolve();
};

module.exports = refresh;

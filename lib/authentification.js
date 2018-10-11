const CONSTANTS = require('./constants');
const User = require('./user');

var authentification = function(server) {
  this.server = server;
  this.nonces = {};
  this.credentials = server.staticCredentials || {};
};

// username and password MUST have been processed using SASLprep
authentification.prototype.addUser = function(username, password) {
  this.credentials[username] = password;
};

authentification.prototype.removeUser = function(username) {
  delete this.credentials[username];
};

authentification.prototype.auth = function(msg, cb) {
  if (this.server.authMech === 'none') {
    return cb(null, msg.reply());
  }
  if (this.server.authMech === 'short-term') {
    this.shortTerm(msg, cb);
  } else if (this.server.authMech === 'long-term') {
    this.longTerm(msg, cb);
  } else {
    cb(new Error('Invalid Auth Mechanism ' + this.server.authMech));
  }
};

authentification.prototype.shortTerm = function(msg, cb) {
  var username = msg.getAttribute('username');
  var reply = msg.reply();

  if (!username || !msg.getAttribute('message-integrity')) {
    if (msg.class === CONSTANTS.CLASS.REQUEST) {
      // reject the request with an error response. This response MUST use an error code of 400 (Bad Request).
      reply.reject(400, 'Bad Request');
      return cb(new Error('Bad Request'));

    } else if (msg.class === CONSTANTS.CLASS.INDICATION) {
      // silently discard the indication
      reply.discard();
      return cb(new Error('silently discard the indication'));
    }
  } else if (!this.credentials[username]) {
    if (msg.class === CONSTANTS.CLASS.REQUEST) {
      // reject the request with an error response. This response MUST use an error code of 401 (Unauthorized).
      reply.reject(401, 'Unauthorized');
      return cb(new Error('Unauthorized'));

    } else if (msg.class === CONSTANTS.CLASS.INDICATION) {
      // silently discard the indication
      reply.discard();
      return cb(new Error('silently discard the indication'));
    }
  } else {
    var password = this.credentials[username];
    if (password && (msg.getAttribute('message-integrity') !== false)) {
      // message should be processed
      var user = new User(username, password);
      msg.setUser(user);
      reply.setUser(user);
      return cb(null, reply);
    } else {
      if (msg.class === CONSTANTS.CLASS.REQUEST) {
        // reject the request with an error response. This response MUST use an error code of 401 (Unauthorized).
        reply.reject(401, 'Unauthorized');
        return cb(new Error('Unauthorized'));
      } else if (msg.class === CONSTANTS.CLASS.INDICATION) {
        // silently discard the indication
        reply.discard();
        return cb(new Error('silently discard the indication'));
      }
    }
  }
};

authentification.prototype.longTerm = function(msg, cb) {
  var username = msg.getAttribute('username');
  var reply = msg.reply();

  if (!msg.getAttribute('message-integrity')) {
    // generate an error response with an error code of 401 (Unauthorized).
    // include a REALM value.
    reply.addAttribute('realm', this.server.realm);
    // include a NONCE
    reply.addAttribute('nonce', this.generateNonce());
    // The response SHOULD NOT contain a USERNAME or MESSAGE-INTEGRITY attribute.
    reply.reject(401, 'Unauthorized');
    return cb(new Error('Unauthorized'));
  }
  if (!username || !msg.getAttribute('realm') || !msg.getAttribute('nonce')) {
    // generate an error response with an error code of 400 (Bad Request).
    // This response SHOULD NOT include a USERNAME, NONCE, REALM, or MESSAGE-INTEGRITY attribute.
    reply.reject(400, 'Bad Request');
    return cb(new Error('Bad Request'));
  }
  if (!this.checkNonce(msg.getAttribute('nonce'))) {
    // generate an error response with an error code of 438 (Stale Nonce).
    // This response MUST include NONCE and REALM attributes
    reply.addAttribute('realm', this.server.realm);
    reply.addAttribute('nonce', this.generateNonce());
    // and SHOULD NOT include the USERNAME or MESSAGE-INTEGRITY attribute.
    // Servers can invalidate nonces in order to provide additional security.
    reply.reject(438, 'Stale Nonce');
    return cb(new Error('Stale Nonce'));
  }
  var password = this.credentials[username];
  if (!password) {
    // generate an error response with an error code of 401 (Unauthorized).
    // This response MUST include a REALM value.
    // The response MUST include a NONCE.
    reply.addAttribute('realm', this.server.realm);
    reply.addAttribute('nonce', this.generateNonce());
    // The response SHOULD NOT contain a USERNAME or MESSAGE-INTEGRITY attribute.
    reply.reject(401, 'Unauthorized');
    return cb(new Error('Unauthorized'));
  }

  if (msg.getAttribute('message-integrity') === false) {
    // generate an error response with an error code of 401 (Unauthorized).
    // It MUST include REALM and NONCE attributes
    reply.addAttribute('realm', this.server.realm);
    reply.addAttribute('nonce', this.generateNonce());
    // and SHOULD NOT include the USERNAME or MESSAGE-INTEGRITY attribute.
    reply.reject(401, 'Unauthorized');
    return cb(new Error('Unauthorized'));
  }

  // https://tools.ietf.org/html/rfc5766#section-4
  if (msg.allocation && msg.allocation.user.username !== username) {
    reply.reject(441, 'Wrong Credentials');
    return cb(new Error('Wrong Credentials'));
  }

  var user = new User(username, password);

  msg.setUser(user);
  reply.setUser(user);
  return cb(null, reply);
};

authentification.prototype.generateNonce = function() {
  var self = this;
  var sessionTime = 3600000; // 1 hour
  function gen4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  var nonce = gen4() + gen4() + gen4() + gen4() + gen4() + gen4() + gen4() + gen4();
  this.nonces[nonce] = {
    ttl: new Date().getTime() + sessionTime
  };
  setTimeout(function() {
    delete self.nonces[nonce];
  }, sessionTime);
  return nonce;
};

authentification.prototype.checkNonce = function(nonce) {
  if (!this.nonces[nonce]) {
    return false;
  }
  if (this.nonces[nonce].ttl < Date.now()) {
    return false;
  }
  return true;
};

module.exports = authentification;

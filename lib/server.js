const EventEmitter = require('events');
const inherits = require('util').inherits;
const CONSTANTS = require('./constants');

const Allocate = require('./methods/allocate');
const Refresh = require('./methods/refresh');
const CreatePermission = require('./methods/createPermission');
const Send = require('./methods/send');
const ChannelBind = require('./methods/channelBind');


const Authentification = require('./authentification');
const Network = require('./network');
const os = require('os');

var server = function(config) {
  config = config || {};
  EventEmitter.call(this);
  var self = this;

  this.software = "node-turn";

  // create default config
  this.listeningIps = config.listeningIps || ['0.0.0.0'];
  // should only use 0.0.0.0 but https://github.com/nodejs/node/issues/1649
  if (!config.listeningIps) {
    this.listeningIps = [];
    var ifaces = os.networkInterfaces();
    Object.keys(ifaces).forEach(function(ifaceName) {
      var iface = ifaces[ifaceName];
      iface.forEach(function(network, i) {
        if (network.family === 'IPv6' && network.address.startsWith('fe80:')) {
          return;
        } else {
          self.listeningIps.push(network.address);
        }
      });
    });
  }

  this.relayIps = config.relayIps || [];
  this.externalIps = config.externalIps || null;
  this.listeningPort = config.listeningPort || 3478;
  this.minPort = config.minPort || 49152;
  this.maxPort = config.maxPort || 65535;
  this.maxAllocateLifetime = config.maxAllocateLifetime || 3600; // 1 hour
  this.defaultAllocatetLifetime = config.defaultAllocatetLifetime || 600;
  this.authMech = config.authMech || 'none';
  this.realm = config.realm || 'atlantis-software.net';
  this.staticCredentials = config.credentials || {};

  this.log = config.log || console.log; // eslint-disable-line no-console

  if (config.debug) {
    this.debug = config.debug.bind(config);
  }

  this.debugLevel = CONSTANTS.DEBUG_LEVEL.FATAL;
  if (config.debugLevel && config.debugLevel.toUpperCase) {
    this.debugLevel = CONSTANTS.DEBUG_LEVEL[config.debugLevel.toUpperCase()];
  }

  this.allocations = {};
  this.reservations = {};

  this.authentification = new Authentification(this, config);
  this.network = new Network(this);

  // Methods
  this.allocate = new Allocate(this);
  this.refresh = new Refresh(this);
  this.createPermission = new CreatePermission(this);
  this.send = new Send(this);
  this.channelBind = new ChannelBind(this);

  this.on('message', function(msg) {
    self.debug('DEBUG','Receiving ' + msg);

    // check fingerprint
    if (msg.getAttribute('fingerprint') === false) {
      let reply = msg.reply();
      return reply.discard();
    }

    // STUN Binding needn't auth
    if (msg.class === CONSTANTS.CLASS.REQUEST && msg.method === CONSTANTS.METHOD.BINDING) {
      return this.emit('binding', msg, msg.reply());
    }

    // https://tools.ietf.org/html/rfc5766#section-4
    if (msg.class !== CONSTANTS.CLASS.REQUEST || msg.method !== CONSTANTS.METHOD.ALLOCATE) {
      var allocation = this.allocations[msg.transport.get5Tuple()];
      if (!allocation) {
        let reply = msg.reply();
        if (msg.class === CONSTANTS.CLASS.INDICATION) {
          return reply.discard();
        }
        return reply.reject(437, 'Allocation Mismatch');
      }
      msg.allocation = allocation;
    }

    // Indication can't be authentified
    if (msg.class === CONSTANTS.CLASS.INDICATION) {
      let reply = msg.reply();
      switch (msg.method) {
        case CONSTANTS.METHOD.SEND:
          this.emit('send', msg, reply);
          break;
        default:
          reply.discard();
          break;
      }
      return;
    }

    self.authentification.auth(msg, function(err, reply) {
      if (err) {
        self.debug('DEBUG', 'authentification failled for TransactionID: ' + msg.transactionID);
        self.debug('TRACE', err);
        return;
      }
      self.emit(msg.getMethodName(), msg, reply);
    });

  });

  this.on('binding', function(msg, reply) {
    // add a XOR-MAPPED-ADDRESS attribute
    reply.addAttribute('xor-mapped-address', msg.transport.src);
    reply.resolve();
  });
};

server.prototype.debug = function(level, msg) {
  level = CONSTANTS.DEBUG_LEVEL[level] || 0;
  if (level >= this.debugLevel) {
    this.log(msg);
  }
};

server.prototype.start = function() {
  this.network.start();
};

server.prototype.stop = function() {
  this.network.stop();
};

server.prototype.addUser = function(username, password) {
  this.authentification.addUser(username, password);
};

server.prototype.removeUser = function(username) {
  this.authentification.removeUser(username);
};

inherits(server, EventEmitter);

module.exports = server;

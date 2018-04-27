const CONSTANTS = require('./constants');

var transport = function(protocol, src, dst, socket) {
  this.protocol = protocol;
  this.src = src;
  this.dst = dst;
  this.socket = socket;
};

transport.prototype.get5Tuple = function() {
  var fiveTuple = '';

  switch (this.protocol) {
    case CONSTANTS.TRANSPORT.PROTOCOL.UDP:
      fiveTuple += 'UDP';
      break;
  }

  switch (this.family) {
    case CONSTANTS.TRANSPORT.FAMILY.IPV4:
      fiveTuple += '4';
      break;
    case CONSTANTS.TRANSPORT.FAMILY.IPV6:
      fiveTuple += '6';
      break;
  }

  fiveTuple += '://' + this.src.address + ':' + this.src.port + '>' + this.dst.address + ':' + this.dst.port;

  return fiveTuple;
};

transport.prototype.toString = function() {
  var str = '';
  switch (this.protocol) {
    case CONSTANTS.TRANSPORT.PROTOCOL.UDP:
      str += 'UDP';
      break;
    default:
      str += 'UNKNOWN PROTOCOL';
  }
  str += ': from ' + this.src + ' to ' + this.dst;
  return str;
},

transport.prototype.revert = function() {
  return new transport(this.protocol, this.dst, this.src, this.socket);
};

module.exports = transport;

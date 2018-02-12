const CONSTANTS = require('./constants');

var address = function(family, address, port) {
  this.family = family;
  this.address = address;
  this.port = port;
};

address.prototype.UintAddress = function() {
  var ip = this.address.split('.');
  var address = parseInt(ip[0]) * Math.pow(2, 24);
  address += parseInt(ip[1]) * Math.pow(2, 16);
  address += parseInt(ip[2]) * Math.pow(2, 8);
  address += parseInt(ip[3]);
  return address;
};

address.prototype.toString = function() {
  var str = '';
  switch(this.family) {
    case CONSTANTS.TRANSPORT.FAMILY.IPV4:
      str += 'IPV4://';
      break;
    case CONSTANTS.TRANSPORT.FAMILY.IPV6:
      str += 'IPV6://';
  }
  str += this.address + ':' + this.port;
  return str;
};

module.exports = address;
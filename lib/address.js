const CONSTANTS = require('./constants');

var ipv4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
var ipv6Regex =
    /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;

var address = function(address, port) {
  if (typeof address !== 'string') {
    throw new Error('address must be a string instead of ' + typeof address + ' ' + JSON.stringify(address));
  }

  // remove interface name for ipv6
  address = address.split('%')[0];

  if (ipv4Regex.test(address)) {
    this.family = CONSTANTS.TRANSPORT.FAMILY.IPV4;
    this.address = address;
  } else if (ipv6Regex.test(address)) {
    this.family = CONSTANTS.TRANSPORT.FAMILY.IPV6;
    if (address.indexOf("::") == -1) {
      this.address = address;
    } else {
      var sides = address.split('::');
      var left = sides[0].split(':');
      if (left[0] === '') {
        left[0] = '0';
      }
      var right = sides[1].split(':');
      var digits = [].concat(left);
      for (var i = left.length; i <= (8 - left.length - right.length); i++) {
        digits.push('0');
      }
      digits = digits.concat(right);
      this.address = digits.join(':');
    }
  } else {
    throw new Error('invalid ip address');
  }
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
  switch (this.family) {
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
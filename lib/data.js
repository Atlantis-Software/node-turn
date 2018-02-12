var data = function(buffer) {
  Object.setPrototypeOf(buffer, data.prototype);
  return buffer;
};

Object.setPrototypeOf(data.prototype, Buffer.prototype);
Object.setPrototypeOf(data, Buffer);

data.alloc = function(size) {
  return new data(new Buffer.alloc(size));
};

data.prototype.readBit = function(index) {
  var byte = index >> 3;
  var bit = index & 7;
  return !!(this[byte] & (128 >> bit));
};

data.prototype.writeBit = function(value, index) {
  var byte = index >> 3;
  var bit = index & 7;
  var mask = 128 >> bit;

  var currentByte = this[byte];
  var newByte = value ? currentByte | mask : currentByte & ~mask;

  if (currentByte === newByte) {
    return false;
  }

  this[byte] = newByte;
  return true;
};

data.prototype.readUncontiguous = function(indexArray) {
  var self = this;
  var value = 0;
  indexArray.forEach(function(bitIndex, i) {
    let weight = Math.pow(2, indexArray.length -1 - i);
    if (self.readBit(bitIndex)) {
      value += weight;
    }
  });
  return value;
};

data.prototype.writeUncontiguous = function(value, indexArray) {
  var bits = Array.from(value.toString(2));
  if (bits.length > indexArray.length) {
    throw new Error('value is larger than specified data size');
  }
  for (var i = 0; i < indexArray.length; i++) {
    var pos = indexArray[indexArray.length - 1 - i];
    var bit = 0;
    if (i < bits.length) {
      bit = bits[bits.length -1 - i] === "1" ? 1 : 0;
    }
    this.writeBit(bit, pos);
  }
};

data.prototype.writeWord = function(offset, length) {
  var value = 0;
  for (var i = 0; i < length; i++) {
    var pos  = offset + length - i - 1;
    let weight = Math.pow(2, indexArray.length -1 - i);
    if (self.readBit(pos)) {
      value += weight;
    }
  }
};

data.prototype.writeWord = function(value, offset, length) {
  var bits = Array.from(value.toString(2));
  if (bits.length > length) {
    throw new Error('value is larger than specified data size');
  }
  for (var i = 0; i < length; i++) {
    var pos  = offset + length - i - 1;
    var bit = 0;
    if (i < bits.length) {
      bit = bits[bits.length -1 - i] === "1" ? 1 : 0;
    }
    this.writeBit(bit, pos);
  }
};

module.exports = data;

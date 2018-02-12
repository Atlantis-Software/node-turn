var channelMsg = function(channelNumber, data) {
  this.channelNumber = channelNumber;
  this.length = 0;
  this.data = null;
  this.padding = 0;
  if (data) {
    this.data = data;
    this.length = data.length;
    this.padding = this.length % 4 ? 4 - (this.length % 4) : 0;
  }
};

channelMsg.prototype.read = function(data) {
  this.channelNumber = data.readUInt16BE(0);
  if (this.channelNumber < 0x4000 || this.channelNumber > 0x7FFE) {
    return false;
  }
  this.length = data.readUInt16BE(2);
  if (this.length > (data.length - 4)) {
    return false;
  }
  this.padding = data.length - this.length - 4;
  if (this.padding > 3) {
    return false;
  }
  this.data = data.slice(4, this.length + 4);
  return true;
};

channelMsg.prototype.write = function() {
  if (!this.channelNumber) {
    throw new Error('Channel Message require a channelNumber');
  }
  if (!this.data || !Buffer.isBuffer(this.data)) {
    throw new Error('Channel Message require a data buffer');
  }
  var header = Buffer.alloc(4);
  header.writeUInt16BE(this.channelNumber, 0);
  header.writeUInt16BE(this.length, 2);
  this.padding = this.length % 4 ? 4 - (this.length % 4) : 0;
  return Buffer.concat([header, this.data, Buffer.alloc(this.padding)]);
};

module.exports = channelMsg;
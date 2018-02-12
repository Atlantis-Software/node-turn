var user = function(username, hmacKey) {
  this.username = username;
  this.hmacKey = hmacKey;
};

module.exports = user;
# Node-turn

[![npm version](https://badge.fury.io/js/node-turn.svg)](https://www.npmjs.com/node-turn)
[![Build Status](https://travis-ci.org/Atlantis-Software/node-turn.svg?branch=master)](https://travis-ci.org/Atlantis-Software/node-turn)
[![Coverage Status](https://coveralls.io/repos/github/Atlantis-Software/node-turn/badge.svg?branch=master)](https://coveralls.io/github/Atlantis-Software/node-turn?branch=master)
[![Dependencies Status](https://david-dm.org/Atlantis-Software/node-turn.svg)](https://david-dm.org/Atlantis-Software/node-turn)

Node-turn is a STUN/TURN server for Node.JS

Supported RFCs:

https://tools.ietf.org/html/rfc5389
https://tools.ietf.org/html/rfc5766


## Installation

Install from NPM.

```bash
$ npm install node-turn
```

## Use Node-turn as a standalone server

```bash
$ cd ./node_modules/node-turn
$ su
# mkdir /etc/node-turn
# cp ./sample-config.conf /etc/node-turn/node-turn.conf
# chmod 640 /etc/node-turn/node-turn.conf
# touch /var/log/node-turn.log
# chmod 640 /var/log/node-turn.log
# exit
$ vi /etc/node-turn/node-turn.conf
$ npm run start
```

## Use Node-turn as a library

```javascript
var Turn = require('node-turn');
var server = new Turn({
  // set options
  authMech: 'long-term',
  credentials: {
    username: "password"
  }
});
server.start();
```

## available options

Option                    | Type            | Description
------------------------- | --------------- | ---------------
listeningPort             | Integer         | TURN listener port for UDP (Default: 3478).
listeningIps              | Array           | Listener IP address of relay server. Multiple listeners can be specified.If no IP(s) specified in the config, then all system IPs will be used for listening.
relayIps                  | Array           | Relay address (the local IP address that will be used to relay the packets to the peer). Multiple relay addresses may be used.The same IP(s) can be used as both listening IP(s) and relay IP(s). If no relay IP(s) specified, then the turnserver will apply the default policy: it will decide itself which relay addresses to be used, and it will always be using the client socket IP address as the relay IP address of the TURN session (if the requested relay address family is the same as the family of the client socket).
externalIps               | Object          | External IP addres for relay address allocations. This is necessary if running the relay server behind a NAT. By default, the local relay IP is used, if externalIps is a string, then all allocations will use that address for the relayed address, if it's an object, then it takes the form of {"local ip 1": "external ip 1", "local ip 2": "external ip 2", default: "default external IP"} to specify an external IP per local relay IP. A special 'default' key can be set for use with any relay addresses that aren't listed in the object.
minPort                   | Integer         | Lower bound of the UDP relay endpoints (Default: 49152).
maxPort                   | Integer         | Upper bound of the UDP relay endpoints (Default: 65535).
authMech                  | String          | TURN credential mechanism. cf authentification mechanism table lower. By default no credentials mechanism is used (any user allowed).
credentials               | Object          | User accounts for credentials mechanisms. username are object keys containing the password string.
realm                     | String          | The realm to be used for the users with long-term credentials mechanism. (Default: 'atlantis-software.net').
debugLevel                | String          | Server log verbose level. cf debug level table lower (Default: 'ERROR').
maxAllocateLifetime       | Integer         | the max lifetime, in seconds, allowed for allocations (Default: 3600).
defaultAllocatetLifetime  | Integer         | the default allocation lifetime in seconds (Default: 600).
debug                     | Function        | Synchronous function used to log debug information that take debugLevel as first argument and string message as second.

### Authentification mechanism

Auth mechanism            | Description
------------------------- | ---------------
'none'                    | disable authentification
'short-term'              | to use short-term mechanism (cf https://tools.ietf.org/html/rfc5389#section-10.1)
'long-term'               | to use long-term mechanism (cf https://tools.ietf.org/html/rfc5389#section-10.2)

### debug level

Debug level               | Description
------------------------- | ---------------
'OFF'                     | nothing is logged
'FATAL'                   | fatal errors are logged
'ERROR'                   | errors are logged
'WARN'                    | warnings are logged
'INFO'                    | infos are logged
'DEBUG'                   |	debug infos are logged
'TRACE'                   | traces are logged
'ALL'                     | everything is logged

### Library methods

Method                    | arguments                            | Description
------------------------- | ------------------------------------ | ---------------
start                     | none                                 | start the server.
stop                      | none                                 | stop the server.
addUser                   | username (String), password (String) | add a user to credential mechanism.
removeUser                | username (String)                    | remove a user from credential mechanism.

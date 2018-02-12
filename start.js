const Server = require('./lib/server');
const yaml = require('js-yaml');
const fs = require('fs');
const log4js = require('log4js');
const os = require('os');


try {
  var logFile;
  var configFile;

  switch(os.platform()) {
    case 'win32':
      logFile = 'c:\\Windows\\Logs\\node-turn.log';
      configFile = 'C:\\ProgramData\\node-turn.conf';
      break;
    default:
      logFile = '/var/log/node-turn.log';
      configFile = '/etc/node-turn/node-turn.conf';
      break;
  }

  var appenders = {};
  var hostname = os.hostname();
  appenders[hostname] = { type: 'file', filename: logFile };

  if (!fs.existsSync(logFile)) {
    appenders[hostname] = { type: 'console'};
    console.log('Using STDOUT for logging');
    console.log('Please create a the log file ' + logFile + ' with correct permission');
  }

  if (!fs.existsSync(configFile)) {
    console.log('Using sample-config.conf');
    console.log('Please copy with correct permission and modify sample-config.conf to ' + configFile);
    configFile = 'sample-config.conf';
  }

  var config = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'));

  log4js.configure({
    appenders: appenders,
    categories: { default: { appenders: [hostname], level: config['debug-level'] || 'ERROR' } }
  });

  const logger = log4js.getLogger(hostname);
  var debug = function(level, message) {
    level = level.toLowerCase();
    logger[level](message);
  };

  config.debug = debug;

  var server = new Server(config);
  server.start();
} catch (e) {
  console.log(e);
}

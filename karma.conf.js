const Server = require('./lib/server');

module.exports = function (config) {
  const server = new Server({
    debugLevel: 'OFF',
    authMech: 'long-term',
    credentials: {
      username: "password"
    }
  });

  server.start();

  config.set({
    basePath: '',
    frameworks: ['mocha'],
    logLevel: config.LOG_INFO,
    files: [
      './test/test.js'
    ],

    browsers : ['Chrome'],

    singleRun: true,

    autoWatch: true,
    autoWatchBatchDelay: 5000,

    reporters: ['mocha'],
    port: 9876,
    colors: true,
    concurrency: 1
  });
};
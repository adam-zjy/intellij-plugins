var intellijParameters = require('./karma-intellij-parameters')
  , intellijUtil = require('./intellijUtil')
  , REMOTE_DEBUGGING_PORT = '--remote-debugging-port';

function getRemoteDebuggingPortFromCustomLauncherFlags(config, browserName) {
  const customLaunchers = config.customLaunchers;
  if (customLaunchers != null) {
    var launcher = customLaunchers[browserName];
    if (launcher != null) {
      var flags = launcher.flags;
      if (Array.isArray(flags)) {
        const prefix = REMOTE_DEBUGGING_PORT + '=';
        var value = flags.find(element => intellijUtil.isString(element) && element.indexOf(prefix) === 0);
        if (value != null) {
          const port = parseInt(value.substring(prefix.length), 10);
          if (!isNaN(port) && port > 0) {
            return port;
          }
        }
      }
    }
  }
  return -1;
}

function isBrowserWithPreconfiguredRemoteDebuggingPort(browserName) {
  return browserName === 'ChromeHeadless' ||
         browserName === 'ChromeCanaryHeadless' ||
         browserName === 'ChromiumHeadless';
}

exports.configureBrowsers = function (config) {
  let newBrowsers = config.browsers;
  if (intellijUtil.isString(config.browserForDebugging)) {
    newBrowsers = [config.browserForDebugging];
  }
  if (!Array.isArray(newBrowsers)) {
    console.info('intellij: config.browsers is not an array');
    newBrowsers = [];
  }

  const headless = newBrowsers.find(browserName => {
    return isBrowserWithPreconfiguredRemoteDebuggingPort(browserName) ||
      getRemoteDebuggingPortFromCustomLauncherFlags(config, browserName) > 0;
  });

  let remoteDebuggingPort = -1;
  if (headless != null) {
    remoteDebuggingPort = getRemoteDebuggingPortFromCustomLauncherFlags(config, headless);
    if (remoteDebuggingPort < 0 && isBrowserWithPreconfiguredRemoteDebuggingPort(headless)) {
      remoteDebuggingPort = 9222;
    }
  }
  newBrowsers = remoteDebuggingPort > 0 ? [headless] : [];

  config.browsers = newBrowsers;
  if (config.browsers.length === 0) {
    console.info('intellij: a browser for tests debugging will be captured automatically');
  }
  else {
    console.info('intellij: config.browsers: ' + JSON.stringify(config.browsers) +
      ' with ' + REMOTE_DEBUGGING_PORT + '=' + remoteDebuggingPort);
  }
  return remoteDebuggingPort > 0 ? {'--remote-debugging-port': remoteDebuggingPort} : undefined;
};

exports.configureTimeouts = (injector) => {
  // Execute on next tick to resolve circular dependency! (Resolving: webServer -> reporter -> webServer)
  if (intellijParameters.isDebug()) {
    process.nextTick(() => {
      var webServer = injector.get('webServer');
      if (webServer) {
        // IDE posts http '/run' request to trigger tests (see intellijRunner.js).
        // If a request executes more than `httpServer.timeout`, it will be timed out.
        // Disable timeout, as by default httpServer.timeout=120 seconds, not enough for suspended execution.
        webServer.timeout = 0;
      }
      var socketServer = injector.get('socketServer');
      if (socketServer) {
        // Disable socket.io heartbeat (ping) to avoid browser disconnecting when debugging tests,
        // because no ping requests are sent when test execution is suspended on a breakpoint.
        // Default values are not enough for suspended execution:
        //    'heartbeat timeout' (pingTimeout) = 60000 ms
        //    'heartbeat interval' (pingInterval) = 25000 ms
        socketServer.set('heartbeat timeout', 24 * 60 * 60 * 1000);
        socketServer.set('heartbeat interval', 24 * 60 * 60 * 1000);
      }
    });
  }
};

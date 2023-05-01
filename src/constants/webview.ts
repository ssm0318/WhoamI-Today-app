export const WEB_VIEW_DEBUGGING_SCRIPT = `
const consoleLog = (type, log) => window.ReactNativeWebView.postMessage(JSON.stringify({'actionType': 'CONSOLE', 'data': log}));
console = {
  log: (log) => consoleLog('log', log),
  debug: (log) => consoleLog('debug', log),
  info: (log) => consoleLog('info', log),
  warn: (log) => consoleLog('warn', log),
  error: (log) => consoleLog('error', log),
};
`;

export const WEB_VIEW_URL = {
  DEV: 'http://localhost:3000',
  PROD: 'https://diivers.world',
};

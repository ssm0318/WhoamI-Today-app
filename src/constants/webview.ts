export const WEB_VIEW_DEBUGGING_SCRIPT = `
const meta = document.createElement('meta');
meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
meta.setAttribute('name', 'viewport');
document.head.appendChild(meta);
const consoleLog = (type, log) => window.ReactNativeWebView.postMessage(JSON.stringify({'actionType': 'CONSOLE', 'data': log}));
console = {
  log: (log) => consoleLog('log', log),
  debug: (log) => consoleLog('debug', log),
  info: (log) => consoleLog('info', log),
  warn: (log) => consoleLog('warn', log),
  error: (log) => consoleLog('error', log),
};
`;

// dev 환경에서 설정하는 hostname
// NOTE
// 로컬에서 개발할 때는 이 hostname을 사용해야 함
// 실제 archive 할때는 PROD로 변경해야 함
export const WEB_VIEW_DEV_HOSTNAME = '192.168.0.105';

export const WEB_VIEW_URL = {
  DEV: `http://${WEB_VIEW_DEV_HOSTNAME}:3000`,
  PROD: 'https://diivers.world',
};

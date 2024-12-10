export const WEB_VIEW_DEBUGGING_SCRIPT = `
const meta = document.createElement('meta');
meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
meta.setAttribute('name', 'viewport');
document.head.appendChild(meta);

const consoleLog = (type, log) => window.ReactNativeWebView.postMessage(JSON.stringify({'actionType': 'CONSOLE', 'data': log}));
console.log = (log) => consoleLog('log', log);
console.debug = (log) => consoleLog('debug', log);
console.info = (log) => consoleLog('info', log);
console.warn = (log) => consoleLog('warn', log);
console.error = (log) => consoleLog('error', log);

// 네비게이션 상태 변경 감지
(function() {
    function wrap(fn) {
      return function wrapper() {
        var res = fn.apply(this, arguments);
        window.ReactNativeWebView.postMessage('navigationStateChange');
        return res;
      }
    }

    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', function() {
      window.ReactNativeWebView.postMessage('navigationStateChange');
    });
})();

`;

export const WEB_VIEW_DEBUGGING_SCRIPT = `
const meta = document.createElement('meta');
meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
meta.setAttribute('name', 'viewport');
document.head.appendChild(meta);

const consoleLog = (type, ...args) => {
    const processArg = (arg) => {
        try {
            if (typeof arg === 'object') {
                return JSON.stringify(arg);
            }
            return String(arg);
        } catch (error) {
            return '[Circular]';
        }
    };

    const logMessage = args.map(processArg).join(' ');
    window.ReactNativeWebView.postMessage(JSON.stringify({
        'actionType': 'CONSOLE',
        'data': logMessage
    }));
};

console.log = (...args) => consoleLog('log', ...args);
console.debug = (...args) => consoleLog('debug', ...args);
console.info = (...args) => consoleLog('info', ...args);
console.warn = (...args) => consoleLog('warn', ...args);
console.error = (...args) => consoleLog('error', ...args);

// Detect navigation state changes
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

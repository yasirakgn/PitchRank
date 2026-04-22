(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.HSNetwork = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function toQuery(params) {
    return Object.keys(params || {}).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
  }

  function withTimeout(promise, timeoutMs) {
    if (!timeoutMs) return promise;
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('Request timeout after ' + timeoutMs + 'ms'));
        }, timeoutMs);
      })
    ]);
  }

  function requestWithRetry(requestFn, opts) {
    var retries = (opts && typeof opts.retries === 'number') ? opts.retries : 2;
    var attempt = 0;

    function run() {
      return Promise.resolve()
        .then(requestFn)
        .catch(function (err) {
          if (attempt >= retries) throw err;
          attempt += 1;
          return run();
        });
    }

    return run();
  }

  function fetchJsonWithRetry(url, opts) {
    var options = opts || {};
    return requestWithRetry(function () {
      var req = fetch(url, options.fetchOptions || {}).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        return res.json();
      });
      return withTimeout(req, options.timeoutMs);
    }, options);
  }

  function fetchTextWithRetry(url, opts) {
    var options = opts || {};
    return requestWithRetry(function () {
      var req = fetch(url, options.fetchOptions || {}).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        return res.text();
      });
      return withTimeout(req, options.timeoutMs);
    }, options);
  }

  return {
    toQuery: toQuery,
    fetchJsonWithRetry: fetchJsonWithRetry,
    fetchTextWithRetry: fetchTextWithRetry
  };
});

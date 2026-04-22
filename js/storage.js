(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.HSStorage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch (_) {
      return fallback;
    }
  }

  function getJSON(key, fallback) {
    var raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return safeParse(raw, fallback);
  }

  function setJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function setJSONWithTTL(key, value, ttlMs) {
    var expiresAt = Date.now() + ttlMs;
    setJSON(key, { value: value, expiresAt: expiresAt });
  }

  function getJSONWithTTL(key, fallback) {
    var payload = getJSON(key, null);
    if (!payload || typeof payload !== 'object' || !payload.expiresAt) return fallback;
    if (Date.now() > payload.expiresAt) {
      localStorage.removeItem(key);
      return fallback;
    }
    return payload.value;
  }

  return {
    safeParse: safeParse,
    getJSON: getJSON,
    setJSON: setJSON,
    setJSONWithTTL: setJSONWithTTL,
    getJSONWithTTL: getJSONWithTTL
  };
});


(function () {
  'use strict';

  const API_BASE_URL =
    'https://script.google.com/macros/s/AKfycbyhwDVzr8FjIKVxmvuu4UnMMkmtOKK4NPIGhMHG7A6mBgwv-XB1jT2IkVyT31SXtOoJSw/exec';

  const TOKEN_KEY = 'pms_api_token';

  let memoryToken = null;
  let authExpiredNotified = false;

  const syncState = {
    status: 'idle',
    activeRequests: 0,
    lastUpdated: null,
    lastError: null,
    cachedDisplayed: false,
    batchHadError: false
  };

  function notifySyncStatus() {
    try {
      if (typeof window.CustomEvent !== 'function') return;

      window.dispatchEvent(
        new CustomEvent('pms:sync-status', {
          detail: {
            status: syncState.status,
            activeRequests: syncState.activeRequests,
            lastUpdated: syncState.lastUpdated,
            lastError: syncState.lastError,
            cachedDisplayed: syncState.cachedDisplayed
          }
        })
      );
    } catch (error) {}
  }

  function startTrackedRequest() {
    if (syncState.activeRequests === 0) {
      syncState.batchHadError = false;
      syncState.lastError = null;
    }

    syncState.activeRequests += 1;
    syncState.status = syncState.cachedDisplayed
      ? 'cached-refreshing'
      : 'fetching';

    notifySyncStatus();
  }

  function finishTrackedRequest(success, error) {
    if (syncState.activeRequests > 0) {
      syncState.activeRequests -= 1;
    }

    if (!success) {
      syncState.batchHadError = true;
      syncState.lastError =
        error && error.message
          ? error.message
          : 'خطا در ارتباط با سرور.';
    }

    if (syncState.activeRequests > 0) {
      syncState.status = syncState.cachedDisplayed
        ? 'cached-refreshing'
        : 'fetching';

      notifySyncStatus();
      return;
    }

    if (syncState.batchHadError) {
      syncState.status = 'error';
    } else {
      syncState.status = 'updated';
      syncState.lastUpdated = Date.now();
      syncState.lastError = null;
    }

    syncState.cachedDisplayed = false;
    notifySyncStatus();
  }

  function isAuthError(error) {
    if (!error) return false;

    const code = String(error.code || '').toUpperCase();
    const message = String(error.message || '');

    return (
      error.status === 401 ||
      error.status === 403 ||
      code === 'UNAUTHORIZED' ||
      code === 'AUTH_REQUIRED' ||
      code === 'SESSION_EXPIRED' ||
      /نشست کاربر معتبر نیست|نشست.*منقضی|احراز هویت الزامی است/.test(message)
    );
  }

  function notifyAuthExpired() {
    Api.clearToken();

    if (authExpiredNotified) return;
    authExpiredNotified = true;

    try {
      window.dispatchEvent(
        new CustomEvent('pms:auth-expired', {
          detail: {
            message: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.'
          }
        })
      );
    } catch (error) {}
  }

  const Api = {
    setToken: function (token) {
      memoryToken = token || null;

      if (memoryToken) {
        authExpiredNotified = false;

        try {
          localStorage.setItem(TOKEN_KEY, memoryToken);
        } catch (error) {}
      } else {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch (error) {}
      }
    },

    getToken: function () {
      if (memoryToken) return memoryToken;

      try {
        return localStorage.getItem(TOKEN_KEY) || null;
      } catch (error) {
        return null;
      }
    },

    clearToken: function () {
      memoryToken = null;

      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (error) {}
    },

    getSyncStatus: function () {
      return {
        status: syncState.status,
        activeRequests: syncState.activeRequests,
        lastUpdated: syncState.lastUpdated,
        lastError: syncState.lastError,
        cachedDisplayed: syncState.cachedDisplayed
      };
    },

    markCacheShown: function () {
      syncState.cachedDisplayed = true;

      syncState.status = syncState.activeRequests > 0
        ? 'cached-refreshing'
        : 'cached';

      notifySyncStatus();
    },

    request: async function (method, path, options) {
      options = options || {};

      const actualMethod = String(method || 'GET').toUpperCase();
      const tracked =
        actualMethod === 'GET' || actualMethod === 'HEAD';

      if (tracked) startTrackedRequest();

      try {
        const params = new URLSearchParams();
        params.set('path', path || '/');

        const token = this.getToken();

        if (token) params.set('token', token);

        const usePostOverride =
          actualMethod === 'PUT' || actualMethod === 'DELETE';

        if (usePostOverride) {
          params.set('_method', actualMethod);
        }

        const url = API_BASE_URL + '?' + params.toString();

        const fetchOptions = {
          method: usePostOverride ? 'POST' : actualMethod,
          redirect: 'follow'
        };

        if (
          actualMethod !== 'GET' &&
          actualMethod !== 'HEAD'
        ) {
          fetchOptions.headers = {
            'Content-Type': 'text/plain;charset=utf-8'
          };

          fetchOptions.body = JSON.stringify(options.body || {});
        }

        const response = await fetch(url, fetchOptions);

        let data = null;

        try {
          data = await response.json();
        } catch (error) {
          data = null;
        }

        if (!response.ok) {
          throw this.createApiError(response.status, data);
        }

        if (data && data.success === false) {
          throw this.createApiError(response.status, data);
        }

        if (tracked) finishTrackedRequest(true);

        return data;

      } catch (error) {
        if (isAuthError(error)) {
          notifyAuthExpired();
        }

        if (tracked) finishTrackedRequest(false, error);

        throw error;
      }
    },

    get: function (path, options) {
      return this.request('GET', path, options);
    },

    post: function (path, body, options) {
      options = options || {};
      options.body = body;

      return this.request('POST', path, options);
    },

    put: function (path, body, options) {
      options = options || {};
      options.body = body;

      return this.request('PUT', path, options);
    },

    delete: function (path, options) {
      return this.request('DELETE', path, options);
    },

    getCached: async function (path, cacheKey, options) {
      options = options || {};

      const cached =
        window.PMS && window.PMS.Cache
          ? window.PMS.Cache.get(cacheKey)
          : null;

      const freshPromise = this.get(path, options);

      if (cached !== null) {
        this.markCacheShown();

        freshPromise
          .then(function (response) {
            const data = Api.extractData(response);

            if (window.PMS && window.PMS.Cache) {
              window.PMS.Cache.set(cacheKey, data);
            }

            if (typeof options.onRefresh === 'function') {
              options.onRefresh(data, response);
            }
          })
          .catch(function (error) {
            // نشست نامعتبر است؛ از تکرار پیام خطا جلوگیری می‌کنیم.
            if (isAuthError(error)) return;

            console.warn('Background refresh failed:', error);

            if (typeof options.onError === 'function') {
              options.onError(error, true);
            }
          });

        return {
          data: cached,
          cached: true,
          refreshing: true
        };
      }

      const response = await freshPromise;
      const data = this.extractData(response);

      if (window.PMS && window.PMS.Cache) {
        window.PMS.Cache.set(cacheKey, data);
      }

      return {
        data: data,
        cached: false,
        refreshing: false,
        response: response
      };
    },

    getFresh: async function (path, cacheKey, options) {
      const response = await this.get(path, options);
      const data = this.extractData(response);

      if (window.PMS && window.PMS.Cache) {
        window.PMS.Cache.set(cacheKey, data);
      }

      return data;
    },

    getCachedData: function (cacheKey) {
      if (!window.PMS || !window.PMS.Cache) return null;
      return window.PMS.Cache.get(cacheKey);
    },

    extractData: function (response) {
      if (
        response &&
        response.success === true &&
        Object.prototype.hasOwnProperty.call(response, 'data')
      ) {
        return response.data;
      }

      return response;
    },

    invalidate: function (cacheKey) {
      if (window.PMS && window.PMS.Cache) {
        window.PMS.Cache.remove(cacheKey);
      }
    },

    invalidateMany: function (cacheKeys) {
      if (!Array.isArray(cacheKeys)) return;

      cacheKeys.forEach(function (key) {
        Api.invalidate(key);
      });
    },

    createApiError: function (status, response) {
      const error = new Error(
        response &&
        response.error &&
        response.error.message
          ? response.error.message
          : 'خطا در ارتباط با سرور.'
      );

      error.status = status;
      error.code =
        response &&
        response.error &&
        response.error.code
          ? response.error.code
          : 'API_ERROR';
      error.response = response;

      return error;
    }
  };

  window.PMS = window.PMS || {};
  window.PMS.Api = Api;
})();

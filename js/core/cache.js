(function () {
  'use strict';

  const STORAGE_PREFIX = 'PMS_CACHE_';
  const CACHE_VERSION = '1.0.0';

  const Cache = {

    version: CACHE_VERSION,

    /**
     * ذخیره اطلاعات در Cache
     */
    set: function (key, data, options) {
      options = options || {};

      const now = Date.now();

      const item = {
        version: CACHE_VERSION,
        key: key,
        data: data,
        cachedAt: now,
        expiresAt: options.ttl
          ? now + options.ttl
          : null
      };

      try {
        localStorage.setItem(
          STORAGE_PREFIX + key,
          JSON.stringify(item)
        );

        return true;

      } catch (error) {

        console.warn(
          'PMS Cache: ذخیره اطلاعات انجام نشد.',
          error
        );

        return false;
      }
    },

    /**
     * دریافت اطلاعات از Cache
     */
    get: function (key) {

      try {

        const raw = localStorage.getItem(
          STORAGE_PREFIX + key
        );

        if (!raw) {
          return null;
        }

        const item = JSON.parse(raw);

        if (!item || item.version !== CACHE_VERSION) {
          this.remove(key);
          return null;
        }

        if (
          item.expiresAt &&
          Date.now() > item.expiresAt
        ) {
          this.remove(key);
          return null;
        }

        return item.data;

      } catch (error) {

        console.warn(
          'PMS Cache: خواندن اطلاعات انجام نشد.',
          error
        );

        return null;
      }
    },

    /**
     * دریافت اطلاعات به همراه زمان Cache
     */
    getMeta: function (key) {

      try {

        const raw = localStorage.getItem(
          STORAGE_PREFIX + key
        );

        if (!raw) {
          return null;
        }

        const item = JSON.parse(raw);

        if (!item || item.version !== CACHE_VERSION) {
          return null;
        }

        return {
          cachedAt: item.cachedAt,
          expiresAt: item.expiresAt,
          age: Date.now() - item.cachedAt
        };

      } catch (error) {

        return null;
      }
    },

    /**
     * بررسی وجود Cache
     */
    has: function (key) {

      return this.get(key) !== null;
    },

    /**
     * حذف یک Cache
     */
    remove: function (key) {

      try {

        localStorage.removeItem(
          STORAGE_PREFIX + key
        );

        return true;

      } catch (error) {

        return false;
      }
    },

    /**
     * حذف تمام Cacheهای نرم‌افزار
     */
    clear: function () {

      try {

        const keys = [];

        for (let i = 0; i < localStorage.length; i++) {

          const key = localStorage.key(i);

          if (
            key &&
            key.indexOf(STORAGE_PREFIX) === 0
          ) {
            keys.push(key);
          }
        }

        keys.forEach(function (key) {
          localStorage.removeItem(key);
        });

        return true;

      } catch (error) {

        console.warn(
          'PMS Cache: پاک‌سازی انجام نشد.',
          error
        );

        return false;
      }
    },

    /**
     * حذف Cacheهای منقضی‌شده
     */
    clearExpired: function () {

      try {

        const keys = [];

        for (let i = 0; i < localStorage.length; i++) {

          const key = localStorage.key(i);

          if (
            key &&
            key.indexOf(STORAGE_PREFIX) === 0
          ) {
            keys.push(key);
          }
        }

        keys.forEach(function (storageKey) {

          try {

            const raw = localStorage.getItem(storageKey);

            if (!raw) {
              return;
            }

            const item = JSON.parse(raw);

            if (
              item &&
              item.expiresAt &&
              Date.now() > item.expiresAt
            ) {
              localStorage.removeItem(storageKey);
            }

          } catch (error) {

            localStorage.removeItem(storageKey);
          }

        });

        return true;

      } catch (error) {

        return false;
      }
    },

    /**
     * گرفتن تمام اطلاعات Cache
     * برای Debug و مدیریت سیستم
     */
    getAll: function () {

      const result = {};

      try {

        for (let i = 0; i < localStorage.length; i++) {

          const storageKey = localStorage.key(i);

          if (
            !storageKey ||
            storageKey.indexOf(STORAGE_PREFIX) !== 0
          ) {
            continue;
          }

          const key = storageKey.replace(
            STORAGE_PREFIX,
            ''
          );

          const raw = localStorage.getItem(storageKey);

          if (!raw) {
            continue;
          }

          try {

            const item = JSON.parse(raw);

            result[key] = item;

          } catch (error) {

            // Cache خراب را نادیده می‌گیریم.
          }
        }

      } catch (error) {

        console.warn(
          'PMS Cache: دریافت اطلاعات Cache انجام نشد.',
          error
        );
      }

      return result;
    },

    /**
     * نام‌گذاری استاندارد Cacheها
     */
    keys: {
      CURRENT_USER: 'currentUser',

      PROJECTS: 'projects',
      PROJECT: 'project',

      EVENTS: 'events',
      PROJECT_EVENTS: 'projectEvents',

      WORKFLOWS: 'workflows',
      WORKFLOW: 'workflow',
      WORKFLOW_STEPS: 'workflowSteps',

      EVENT_TYPES: 'eventTypes',
      EVENT_TYPE: 'eventType',
      EVENT_FIELDS: 'eventFields',

      USERS: 'users',
      USER: 'user',

      DEPARTMENTS: 'departments',

      ROLES: 'roles',
      PERMISSIONS: 'permissions',

      ATTACHMENTS: 'attachments',
      PROJECT_ATTACHMENTS: 'projectAttachments',

      DASHBOARD: 'dashboard',

      REPORTS: 'reports'
    }
  };

  window.PMS = window.PMS || {};
  window.PMS.Cache = Cache;

  // پاک‌سازی Cacheهای منقضی‌شده هنگام شروع برنامه
  Cache.clearExpired();

})();
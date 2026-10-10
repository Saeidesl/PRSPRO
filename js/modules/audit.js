(function () {
  'use strict';

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  const Audit = {
    records: [],
    search: '',

    init: function () {
      const searchInput = document.getElementById('audit-search');
      const refreshButton = document.getElementById('audit-refresh');

      if (searchInput) {
        searchInput.oninput = function () {
          Audit.search = this.value.trim().toLowerCase();
          Audit.render();
        };
      }

      if (refreshButton) {
        refreshButton.onclick = function () {
          Audit.load();
        };
      }

      try {
        const cached = window.PMS.Cache?.get('audit');
        if (Array.isArray(cached)) {
          Audit.records = cached;
          Audit.render();
        }
      } catch (error) {
        console.warn('خواندن حافظه گزارش‌ها ناموفق بود.', error);
      }

      Audit.load();
    },

    load: async function () {
      const body = document.getElementById('audit-table-body');
      const message = document.getElementById('audit-message');

      if (body && Audit.records.length === 0) {
        body.innerHTML =
          '<tr><td colspan="6">در حال دریافت اطلاعات...</td></tr>';
      }

      try {
        const result = await window.PMS.Api.get('/audit');
        const payload = result?.data ?? result;

        const records = Array.isArray(payload)
          ? payload
          : (payload?.items || payload?.records || payload?.logs || []);

        Audit.records = records;

        try {
          window.PMS.Cache?.set('audit', records);
        } catch (cacheError) {
          console.warn('ذخیره گزارش‌ها در حافظه ناموفق بود.', cacheError);
        }

        Audit.render();

        if (message) message.textContent = '';
      } catch (error) {
        console.error('خطا در دریافت گزارش فعالیت‌ها:', error);

        if (message) {
          message.textContent = Audit.records.length
            ? 'اتصال برقرار نشد؛ اطلاعات ذخیره‌شده نمایش داده می‌شود.'
            : 'دریافت گزارش‌ها ناموفق بود. اتصال API و دسترسی کاربر را بررسی کنید.';
        }

        Audit.render();
      }
    },

    render: function () {
      const body = document.getElementById('audit-table-body');
      if (!body) return;

      const filtered = Audit.records.filter(function (item) {
        const searchable = [
          item.CreatedAt,
          item.UserID,
          item.UserName,
          item.Action,
          item.EntityType,
          item.EntityID,
          item.Reason
        ].join(' ').toLowerCase();

        return searchable.includes(Audit.search);
      });

      if (!filtered.length) {
        body.innerHTML =
          '<tr><td colspan="6">فعالیتی برای نمایش وجود ندارد.</td></tr>';
        return;
      }

      body.innerHTML = filtered.map(function (item) {
        return '<tr>' +
          '<td>' + Audit.escape(item.CreatedAt || '') + '</td>' +
          '<td>' + Audit.escape(item.UserName || item.UserID || '') + '</td>' +
          '<td>' + Audit.escape(item.Action || '') + '</td>' +
          '<td>' + Audit.escape(item.EntityType || '') + '</td>' +
          '<td>' + Audit.escape(item.EntityID || '') + '</td>' +
          '<td>' + Audit.escape(item.Reason || '') + '</td>' +
          '</tr>';
      }).join('');
    },

    escape: function (value) {
      return String(value ?? '').replace(/[&<>"']/g, function (character) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[character];
      });
    }
  };

  window.PMS.Audit = Audit;
  window.PMS.Modules.Audit = Audit;
})();
(function () {
  'use strict';

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  const Api = window.PMS.Api;
  const Cache = window.PMS.Cache;

  const CACHE_KEY = 'permissions';

  const state = {
    permissions: [],
    search: ''
  };

  function normalize(data) {

    if (Array.isArray(data)) {
      return data;
    }

    if (
      data &&
      Array.isArray(data.items)
    ) {
      return data.items;
    }

    if (
      data &&
      Array.isArray(data.permissions)
    ) {
      return data.permissions;
    }

    return [];
  }

  function escapeHtml(value) {

    return String(
      value == null ? '' : value
    )
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function statusLabel(status) {

    if (status === 'ACTIVE') {
      return 'فعال';
    }

    if (status === 'INACTIVE') {
      return 'غیرفعال';
    }

    return status || '-';
  }

  function render() {

    const loading =
      document.getElementById(
        'permissions-loading'
      );

    const error =
      document.getElementById(
        'permissions-error'
      );

    const container =
      document.getElementById(
        'permissions-table-container'
      );

    const empty =
      document.getElementById(
        'permissions-empty'
      );

    if (loading) {
      loading.hidden = true;
    }

    if (error) {
      error.hidden = true;
    }

    if (!container) {
      return;
    }

    let permissions =
      state.permissions || [];

    const search =
      state.search
        .trim()
        .toLowerCase();

    if (search) {

      permissions =
        permissions.filter(
          function (permission) {

            const text =
              [
                permission.ID,
                permission.Code,
                permission.Name,
                permission.Module,
                permission.Description,
                permission.Status
              ]
                .join(' ')
                .toLowerCase();

            return text.indexOf(
              search
            ) !== -1;
          }
        );
    }

    if (!permissions.length) {

      container.hidden = true;

      if (empty) {

        empty.hidden = false;

        empty.textContent =
          search
            ? 'دسترسی مطابق جستجو پیدا نشد.'
            : 'دسترسی‌ای برای نمایش وجود ندارد.';
      }

      return;
    }

    if (empty) {
      empty.hidden = true;
    }

    container.hidden = false;

    let html = '';

    html +=
      '<table class="data-table">';

    html += '<thead>';
    html += '<tr>';

    html += '<th>کد دسترسی</th>';
    html += '<th>نام</th>';
    html += '<th>ماژول</th>';
    html += '<th>توضیحات</th>';
    html += '<th>وضعیت</th>';

    html += '</tr>';
    html += '</thead>';

    html += '<tbody>';

    permissions.forEach(
      function (permission) {

        html += '<tr>';

        html +=
          '<td>' +
          escapeHtml(
            permission.Code
          ) +
          '</td>';

        html +=
          '<td>' +
          escapeHtml(
            permission.Name
          ) +
          '</td>';

        html +=
          '<td>' +
          escapeHtml(
            permission.Module
          ) +
          '</td>';

        html +=
          '<td>' +
          escapeHtml(
            permission.Description
          ) +
          '</td>';

        html +=
          '<td>' +
          escapeHtml(
            statusLabel(
              permission.Status
            )
          ) +
          '</td>';

        html += '</tr>';

      }
    );

    html += '</tbody>';
    html += '</table>';

    container.innerHTML =
      html;
  }

  function showError(message) {

    const loading =
      document.getElementById(
        'permissions-loading'
      );

    const error =
      document.getElementById(
        'permissions-error'
      );

    if (loading) {
      loading.hidden = true;
    }

    if (error) {

      error.textContent =
        message ||
        'خطا در دریافت دسترسی‌ها.';

      error.hidden = false;
    }
  }

  async function load() {

    const loading =
      document.getElementById(
        'permissions-loading'
      );

    if (loading) {
      loading.hidden = false;
    }

    let cached = null;

    if (Cache) {

      cached =
        Cache.get(
          CACHE_KEY
        );
    }

    if (cached) {

      state.permissions =
        normalize(
          cached
        );

      render();
    }

    try {

      const response =
        await Api.get(
          '/permissions'
        );

      const data =
        Api.extractData(
          response
        );

      state.permissions =
        normalize(
          data
        );

      if (Cache) {

        Cache.set(
          CACHE_KEY,
          data
        );
      }

      render();

    } catch (error) {

      if (!cached) {

        showError(
          error.message ||
          'دریافت دسترسی‌ها ناموفق بود.'
        );

      }
    }
  }

  function init() {

    const search =
      document.getElementById(
        'permission-search'
      );

    if (search) {

      search.addEventListener(
        'input',
        function () {

          state.search =
            search.value || '';

          render();

        }
      );
    }

    load();
  }

  window.PMS =
    window.PMS || {};

  window.PMS.Modules =
    window.PMS.Modules || {};

  window.PMS.Permissions = {
    init: init,
    load: load,
    render: render
  };

  window.PMS.Modules.Permissions =
    window.PMS.Permissions;

})();
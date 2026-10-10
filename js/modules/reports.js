(function () {
  'use strict';

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  const Api = window.PMS.Api;
  const Cache = window.PMS.Cache;
  const CACHE_KEY = 'reports';

  const Reports = {
    state: {
      data: null
    },

    init: function () {
      this.bindEvents();
      this.load();
    },

    bindEvents: function () {
      const button = document.getElementById(
        'reports-refresh-button'
      );

      if (button) {
        button.addEventListener('click', () => {
          this.loadFresh();
        });
      }
    },

    load: async function () {
      const cached = Cache
        ? Cache.get(CACHE_KEY)
        : null;

      if (cached !== null) {
        this.state.data = cached;
        this.render();
      } else {
        this.showLoading(true);
      }

      try {
        const response = await Api.get('/dashboard');
        const data = Api.extractData(response);

        this.state.data = data;

        if (Cache) {
          Cache.set(CACHE_KEY, data);
        }

        this.render();
      } catch (error) {
        console.error('Reports Load Error:', error);

        if (cached === null) {
          this.showError(
            error.message || 'دریافت گزارش‌ها ناموفق بود.'
          );
        }
      }
    },

    loadFresh: async function () {
      this.showLoading(true);
      this.hideError();

      try {
        const response = await Api.get('/dashboard');
        const data = Api.extractData(response);

        this.state.data = data;

        if (Cache) {
          Cache.set(CACHE_KEY, data);
        }

        this.render();
      } catch (error) {
        console.error('Reports Refresh Error:', error);

        this.showError(
          error.message || 'بروزرسانی گزارش‌ها ناموفق بود.'
        );

        if (this.state.data) {
          this.render();
        }
      }
    },

    render: function () {
      const data = this.state.data || {};
      const summary = data.summary || {};

      this.setText('reports-projects', summary.projects);
      this.setText(
        'reports-active-projects',
        summary.activeProjects
      );
      this.setText(
        'reports-completed-projects',
        summary.completedProjects
      );
      this.setText('reports-events', summary.events);
      this.setText('reports-attachments', summary.attachments);
      this.setText('reports-users', summary.users);

      this.renderInactiveProjects(
        data.inactivity && data.inactivity.projects
          ? data.inactivity.projects
          : []
      );

      this.renderDepartments(data.departments || []);
      this.renderRecentEvents(data.recentEvents || []);

      const content = document.getElementById(
        'reports-content'
      );

      if (content) {
        content.hidden = false;
      }

      this.showLoading(false);
      this.hideError();
    },

    renderInactiveProjects: function (items) {
      const container = document.getElementById(
        'reports-inactive-projects'
      );

      if (!container) return;

      if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML =
          '<p>پروژه بدون فعالیتی برای نمایش وجود ندارد.</p>';
        return;
      }

      container.innerHTML = this.buildTable(
        ['کد پروژه', 'عنوان', 'وضعیت', 'آخرین بروزرسانی'],
        items.map(item => [
          item.ProjectCode || item.projectCode || '-',
          item.Title || item.title || '-',
          this.statusLabel(item.Status || item.status),
          item.UpdatedAt || item.updatedAt || '-'
        ])
      );
    },

    renderDepartments: function (items) {
      const container = document.getElementById(
        'reports-departments'
      );

      if (!container) return;

      if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML =
          '<p>اطلاعاتی برای نمایش وجود ندارد.</p>';
        return;
      }

      container.innerHTML = this.buildTable(
        ['واحد', 'تعداد'],
        items.map(item => [
          item.Name || item.name || item.DepartmentName || '-',
          item.Count ?? item.count ?? item.Total ?? 0
        ])
      );
    },

    renderRecentEvents: function (items) {
      const container = document.getElementById(
        'reports-recent-events'
      );

      if (!container) return;

      if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML =
          '<p>رویدادی برای نمایش وجود ندارد.</p>';
        return;
      }

      container.innerHTML = this.buildTable(
        ['نوع رویداد', 'توضیحات', 'تاریخ ثبت'],
        items.map(item => [
          item.EventTypeName ||
            item.eventTypeName ||
            item.EventTypeID ||
            '-',
          item.Description || item.description || '-',
          item.CreatedAt || item.createdAt || '-'
        ])
      );
    },

    buildTable: function (headers, rows) {
      const escape = value => this.escapeHtml(value);

      let html = '<table class="data-table"><thead><tr>';

      headers.forEach(header => {
        html += '<th>' + escape(header) + '</th>';
      });

      html += '</tr></thead><tbody>';

      rows.forEach(row => {
        html += '<tr>';

        row.forEach(value => {
          html += '<td>' + escape(value) + '</td>';
        });

        html += '</tr>';
      });

      html += '</tbody></table>';

      return html;
    },

    setText: function (id, value) {
      const element = document.getElementById(id);

      if (element) {
        element.textContent =
          value === undefined || value === null
            ? '۰'
            : value;
      }
    },

    statusLabel: function (value) {
      const labels = {
        ACTIVE: 'فعال',
        COMPLETED: 'تکمیل‌شده',
        ON_HOLD: 'متوقف',
        CANCELLED: 'لغوشده',
        INACTIVE: 'غیرفعال'
      };

      return labels[value] || value || '-';
    },

    showLoading: function (visible) {
      const element = document.getElementById(
        'reports-loading'
      );

      if (element) {
        element.hidden = !visible;
      }
    },

    showError: function (message) {
      const element = document.getElementById(
        'reports-error'
      );

      if (element) {
        element.textContent = message;
        element.hidden = false;
      }
    },

    hideError: function () {
      const element = document.getElementById(
        'reports-error'
      );

      if (element) {
        element.hidden = true;
      }
    },

    escapeHtml: function (value) {
      const element = document.createElement('div');
      element.textContent = String(value ?? '-');
      return element.innerHTML;
    }
  };

  window.PMS.Modules.Reports = Reports;
})();
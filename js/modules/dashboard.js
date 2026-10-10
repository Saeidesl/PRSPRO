(function () {
  'use strict';

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  const CACHE_KEY = window.PMS.Cache.keys.DASHBOARD;

  const Dashboard = {
    lookups: {
      projects: {},
      eventTypes: {}
    },

    projects: [],
    selectedProjectId: null,
    selectedProject: null,
    selectedEvents: [],
    users: [],
    departments: [],
    eventTypes: [],
    eventData: {},
    eventFields: {},
    workflowSteps: [],
    pendingRequests: {},
    loadVersion: 0,

    init: function () {
      this.bindEvents();
      this.ensureExplorer();
      this.loadDashboard();
      this.loadProjects();
      this.loadSharedData();
    },

    bindEvents: function () {
      const refreshButton =
        document.getElementById('dashboard-refresh-button');

      if (refreshButton && !refreshButton.dataset.bound) {
        refreshButton.dataset.bound = '1';

        refreshButton.addEventListener('click', function () {
          Dashboard.refresh();
        });
      }
    },

    loadDashboard: async function () {
      const loading = document.getElementById('dashboard-loading');
      const cached = window.PMS.Cache.get(CACHE_KEY);

      if (cached !== null) {
        this.render(cached, true);
        if (loading) loading.hidden = true;
      } else if (loading) {
        loading.hidden = false;
      }

      try {
        const result = await window.PMS.Api.getCached(
          '/dashboard',
          CACHE_KEY,
          {
            onRefresh: function (data) {
              Dashboard.render(data, false);
              Dashboard.loadLookupData();
              Dashboard.loadProjects();
            },

            onError: function (error, isBackground) {
              if (!isBackground) {
                Dashboard.showError(error);
              }
            }
          }
        );

        if (result && result.data) {
          this.render(result.data, result.cached === true);
        }

        if (loading) loading.hidden = true;
        this.loadLookupData();
      } catch (error) {
        if (loading) loading.hidden = true;

        if (cached === null) {
          this.showError(error);
        }
      }
    },

    refresh: async function () {
      const button =
        document.getElementById('dashboard-refresh-button');

      if (button) {
        button.disabled = true;
        button.textContent = 'در حال بروزرسانی...';
      }

      try {
        const data = await window.PMS.Api.getFresh(
          '/dashboard',
          CACHE_KEY
        );

        this.render(data, false);

        await Promise.all([
          this.loadLookupData(),
          this.loadProjects()
        ]);

        if (this.selectedProjectId) {
          await this.selectProject(this.selectedProjectId, true);
        }
      } catch (error) {
        this.showError(error);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = 'بروزرسانی';
        }
      }
    },

    unwrap: function (data) {
      if (
        data &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        data.data !== undefined
      ) {
        return data.data;
      }

      return data;
    },

    normalizeArray: function (data, keys) {
      data = this.unwrap(data);

      if (Array.isArray(data)) return data;
      if (!data || typeof data !== 'object') return [];

      for (let i = 0; i < keys.length; i++) {
        if (Array.isArray(data[keys[i]])) {
          return data[keys[i]];
        }
      }

      return [];
    },

    loadLookupData: async function () {
      try {
        const results = await Promise.all([
          this.getLookup('/projects', 'dashboard_projects_lookup'),
          this.getLookup('/event-types', 'dashboard_event_types_lookup')
        ]);

        this.lookups.projects = this.toLookup(
          results[0],
          ['ID', 'ProjectID', 'Id', 'id'],
          ['Title', 'Name', 'ProjectCode', 'Code']
        );

        this.lookups.eventTypes = this.toLookup(
          results[1],
          ['ID', 'EventTypeID', 'Id', 'id'],
          ['Name', 'Title', 'Code']
        );

        const cachedDashboard = this.unwrap(
          window.PMS.Cache.get(CACHE_KEY)
        );

        if (cachedDashboard) {
          this.renderProjects(cachedDashboard.recentProjects || []);
          this.renderEvents(cachedDashboard.recentEvents || []);
        }
      } catch (error) {
        console.warn(
          'دریافت نام پروژه‌ها یا رویدادها انجام نشد.',
          error
        );
      }
    },

    getLookup: async function (path, cacheKey) {
      const result = await window.PMS.Api.getCached(
        path,
        cacheKey,
        {
          onRefresh: function (data) {
            if (path === '/projects') {
              Dashboard.projects = Dashboard.normalizeArray(
                data,
                ['projects', 'items', 'Projects', 'Items']
              );

              Dashboard.renderProjectList();
            }

            Dashboard.loadLookupDataFromCache();
          }
        }
      );

      return result ? result.data : null;
    },

    loadLookupDataFromCache: function () {
      const projectData = window.PMS.Cache.get(
        'dashboard_projects_lookup'
      );

      const eventTypeData = window.PMS.Cache.get(
        'dashboard_event_types_lookup'
      );

      if (projectData !== null) {
        this.lookups.projects = this.toLookup(
          projectData,
          ['ID', 'ProjectID', 'Id', 'id'],
          ['Title', 'Name', 'ProjectCode', 'Code']
        );
      }

      if (eventTypeData !== null) {
        this.lookups.eventTypes = this.toLookup(
          eventTypeData,
          ['ID', 'EventTypeID', 'Id', 'id'],
          ['Name', 'Title', 'Code']
        );
      }

      const cachedDashboard = this.unwrap(
        window.PMS.Cache.get(CACHE_KEY)
      );

      if (cachedDashboard) {
        this.renderProjects(cachedDashboard.recentProjects || []);
        this.renderEvents(cachedDashboard.recentEvents || []);
      }
    },

    toLookup: function (response, idFields, nameFields) {
      const lookup = {};

      const items = this.normalizeArray(
        response,
        ['items', 'data', 'projects', 'eventTypes']
      );

      items.forEach(function (item) {
        if (!item) return;

        let id = '';
        let name = '';

        for (let i = 0; i < idFields.length; i++) {
          if (
            item[idFields[i]] !== undefined &&
            item[idFields[i]] !== null &&
            item[idFields[i]] !== ''
          ) {
            id = item[idFields[i]];
            break;
          }
        }

        for (let i = 0; i < nameFields.length; i++) {
          if (item[nameFields[i]]) {
            name = item[nameFields[i]];
            break;
          }
        }

        if (id !== '') {
          lookup[String(id)] = name || String(id);
        }
      });

      return lookup;
    },

    render: function (data, fromCache) {
      data = this.unwrap(data);
      if (!data) return;

      const summary = data.summary || {};

      this.setText('dashboard-projects', summary.projects || 0);
      this.setText('dashboard-active-projects', summary.activeProjects || 0);
      this.setText('dashboard-completed-projects', summary.completedProjects || 0);
      this.setText('dashboard-events', summary.events || 0);
      this.setText('dashboard-attachments', summary.attachments || 0);
      this.setText('dashboard-users', summary.users || 0);

      this.renderProjects(data.recentProjects || []);
      this.renderEvents(data.recentEvents || []);

      const cacheInfo =
        document.getElementById('dashboard-cache-info');

      if (cacheInfo) {
        if (fromCache) {
          const meta = window.PMS.Cache.getMeta(CACHE_KEY);

          if (meta) {
            cacheInfo.textContent =
              'اطلاعات ذخیره‌شده نمایش داده شده است؛ در حال بررسی اطلاعات جدید...';

            cacheInfo.hidden = false;
          }
        } else {
          cacheInfo.textContent = 'اطلاعات به‌روز شد.';
          cacheInfo.hidden = false;
        }
      }
    },

    renderProjects: function (projects) {
      const container =
        document.getElementById('dashboard-recent-projects');

      if (!container) return;

      if (!projects || projects.length === 0) {
        container.innerHTML =
          '<div class="table-empty">پروژه‌ای وجود ندارد.</div>';
        return;
      }

      let html =
        '<div class="table-wrapper">' +
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th>کد پروژه</th>' +
              '<th>عنوان</th>' +
              '<th>وضعیت</th>' +
              '<th>آخرین بروزرسانی</th>' +
            '</tr></thead><tbody>';

      projects.forEach(function (project) {
        const id = project.ID || project.Id || project.id;

        html +=
          '<tr>' +
            '<td>' + Dashboard.escape(project.ProjectCode || '-') + '</td>' +
            '<td>' +
              '<button type="button" class="dashboard-project-link" ' +
                'data-project-id="' + Dashboard.escape(id || '') + '">' +
                Dashboard.escape(project.Title || '-') +
              '</button>' +
            '</td>' +
            '<td>' + Dashboard.escape(Dashboard.statusText(project.Status)) + '</td>' +
            '<td>' + Dashboard.escape(Dashboard.formatDate(project.UpdatedAt)) + '</td>' +
          '</tr>';
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;

      container.querySelectorAll('.dashboard-project-link').forEach(function (button) {
        button.addEventListener('click', function () {
          Dashboard.selectProject(button.getAttribute('data-project-id'));
        });
      });
    },

    renderEvents: function (events) {
      const container =
        document.getElementById('dashboard-recent-events');

      if (!container) return;

      if (!events || events.length === 0) {
        container.innerHTML =
          '<div class="table-empty">رویدادی وجود ندارد.</div>';
        return;
      }

      let html =
        '<div class="table-wrapper">' +
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th>پروژه</th>' +
              '<th>نوع رویداد</th>' +
              '<th>شرح</th>' +
              '<th>زمان</th>' +
            '</tr></thead><tbody>';

      events.forEach(function (event) {
        const projectID = event.ProjectID || '';
        const eventTypeID = event.EventTypeID || '';

        const projectName =
          Dashboard.lookups.projects[String(projectID)] || projectID || '-';

        const eventTypeName =
          Dashboard.lookups.eventTypes[String(eventTypeID)] || eventTypeID || '-';

        html +=
          '<tr>' +
            '<td>' + Dashboard.escape(projectName) + '</td>' +
            '<td>' + Dashboard.escape(eventTypeName) + '</td>' +
            '<td>' + Dashboard.escape(event.Description || '-') + '</td>' +
            '<td>' +
              Dashboard.escape(
                Dashboard.formatDate(event.OccurredAt || event.CreatedAt)
              ) +
            '</td>' +
          '</tr>';
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;
    },

    ensureExplorer: function () {
      if (document.getElementById('dashboard-project-explorer')) return;

      const section = document.querySelector('.page-section');
      if (!section) return;

      const explorer = document.createElement('div');
      explorer.id = 'dashboard-project-explorer';

      explorer.innerHTML =
        '<div class="card dashboard-explorer-card">' +
          '<div class="card-body">' +
            '<div class="dashboard-explorer-heading">' +
              '<div>' +
                '<h3>بررسی پروژه و خط زمانی</h3>' +
                '<p>یک پروژه را انتخاب کن تا اطلاعات پایه و رویدادهای آن نمایش داده شود.</p>' +
              '</div>' +
              '<button type="button" class="btn btn-secondary" id="dashboard-project-close" hidden>' +
                'بستن جزئیات' +
              '</button>' +
            '</div>' +
            '<div class="dashboard-explorer-layout">' +
              '<div class="dashboard-project-list-panel">' +
                '<label for="dashboard-project-search">جستجوی پروژه</label>' +
                '<input type="search" id="dashboard-project-search" class="form-control" placeholder="نام یا کد پروژه...">' +
                '<div id="dashboard-project-list">' +
                  '<div class="table-empty">در حال دریافت پروژه‌ها...</div>' +
                '</div>' +
              '</div>' +
              '<div class="dashboard-project-detail-panel" id="dashboard-selected-project">' +
                '<div class="table-empty">برای مشاهده اطلاعات، یک پروژه را انتخاب کن.</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      const statsGrid = section.querySelector('.dashboard-grid');

      if (statsGrid) {
        statsGrid.insertAdjacentElement('afterend', explorer);
      } else {
        section.appendChild(explorer);
      }

      this.ensureExplorerStyles();

      const search = document.getElementById('dashboard-project-search');

      if (search) {
        search.addEventListener('input', function () {
          Dashboard.renderProjectList(search.value);
        });
      }

      const close = document.getElementById('dashboard-project-close');

      if (close) {
        close.addEventListener('click', function () {
          Dashboard.selectedProjectId = null;
          Dashboard.selectedProject = null;
          Dashboard.selectedEvents = [];

          const detail = document.getElementById('dashboard-selected-project');

          if (detail) {
            detail.innerHTML =
              '<div class="table-empty">برای مشاهده اطلاعات، یک پروژه را انتخاب کن.</div>';
          }

          close.hidden = true;
          Dashboard.renderProjectList();
        });
      }
    },

    /*
     * استایل بخش بررسی پروژه
     * هماهنگ با سیستم طراحی تیره PMS
     */
    ensureExplorerStyles: function () {
      let style = document.getElementById('dashboard-explorer-styles');

      if (!style) {
        style = document.createElement('style');
        style.id = 'dashboard-explorer-styles';
        document.head.appendChild(style);
      }

      style.textContent = `
        #dashboard-project-explorer {
          --explorer-bg: var(--color-surface, #191f29);
          --explorer-panel: var(--color-surface-alt, #202836);
          --explorer-panel-hover: var(--color-surface-hover, #283344);
          --explorer-text: var(--color-text, #e8edf5);
          --explorer-muted: var(--color-text-secondary, #a1adbf);
          --explorer-subtle: var(--color-text-muted, #758399);
          --explorer-border: var(--color-border, #2b3545);
          --explorer-border-light: var(--color-border-light, #354154);
          --explorer-primary: var(--color-primary, #38bdf8);
          --explorer-primary-hover: var(--color-primary-hover, #0ea5e9);
          --explorer-primary-soft: var(--color-primary-soft, rgba(56, 189, 248, 0.13));
          --explorer-radius: var(--radius-lg, 16px);
          --explorer-shadow: var(--shadow-sm, 0 3px 12px rgba(0, 0, 0, 0.16));

          min-width: 0;
          color: var(--explorer-text);
          color-scheme: dark;
        }

        #dashboard-project-explorer,
        #dashboard-project-explorer * {
          box-sizing: border-box;
        }

        #dashboard-project-explorer .dashboard-explorer-card {
          margin-top: 18px;
          overflow: hidden;
          color: var(--explorer-text);
          background: linear-gradient(
            145deg,
            rgba(31, 39, 52, 0.98),
            rgba(24, 30, 40, 0.98)
          );
          border: 1px solid var(--explorer-border);
          border-radius: var(--explorer-radius);
          box-shadow: var(--explorer-shadow);
        }

        #dashboard-project-explorer .card-body {
          padding: 20px;
          color: var(--explorer-text);
        }

        #dashboard-project-explorer .dashboard-explorer-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        #dashboard-project-explorer .dashboard-explorer-heading h3 {
          margin: 0 0 6px;
          color: var(--explorer-text);
          font-size: 16px;
          font-weight: 800;
          line-height: 1.8;
        }

        #dashboard-project-explorer .dashboard-explorer-heading p {
          margin: 0;
          color: var(--explorer-muted);
          font-size: 12px;
          line-height: 2;
        }

        #dashboard-project-explorer .dashboard-explorer-layout {
          display: grid;
          grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.7fr);
          gap: 16px;
          align-items: start;
        }

        #dashboard-project-explorer .dashboard-project-list-panel,
        #dashboard-project-explorer .dashboard-project-detail-panel {
          min-width: 0;
          padding: 15px;
          color: var(--explorer-text);
          background: rgba(17, 21, 28, 0.55);
          border: 1px solid var(--explorer-border);
          border-radius: 12px;
        }

        #dashboard-project-explorer .dashboard-project-list-panel label {
          display: block;
          margin-bottom: 8px;
          color: var(--explorer-muted);
          font-size: 12px;
          font-weight: 700;
        }

        #dashboard-project-explorer #dashboard-project-search {
          display: block;
          width: 100%;
          min-height: 41px;
          margin: 0 0 12px;
          padding: 9px 12px;
          color: var(--explorer-text);
          background: #141b25;
          border: 1px solid var(--explorer-border-light);
          border-radius: 10px;
          outline: none;
          font: inherit;
          font-size: 12px;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }

        #dashboard-project-explorer #dashboard-project-search::placeholder {
          color: var(--explorer-subtle);
          opacity: 1;
        }

        #dashboard-project-explorer #dashboard-project-search:focus {
          background: #171f2b;
          border-color: var(--explorer-primary);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
        }

        #dashboard-project-explorer .dashboard-project-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
          max-height: 460px;
          overflow-y: auto;
          padding: 1px 2px 1px 4px;
          scrollbar-width: thin;
          scrollbar-color: #3b485c #171d27;
        }

        #dashboard-project-explorer .dashboard-project-choice {
          display: block;
          width: 100%;
          min-width: 0;
          padding: 11px 12px;
          text-align: right;
          color: var(--explorer-text);
          background: #191f29;
          border: 1px solid var(--explorer-border);
          border-radius: 10px;
          cursor: pointer;
          font: inherit;
          transition:
            background 0.18s ease,
            border-color 0.18s ease,
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }

        #dashboard-project-explorer .dashboard-project-choice:hover {
          background: #222c3b;
          border-color: #40536c;
          transform: translateX(-2px);
        }

        #dashboard-project-explorer .dashboard-project-choice:focus-visible {
          outline: 2px solid var(--explorer-primary);
          outline-offset: 2px;
        }

        #dashboard-project-explorer .dashboard-project-choice.selected {
          color: #e8edf5;
          background:
            linear-gradient(
              100deg,
              rgba(14, 165, 233, 0.17),
              rgba(99, 102, 241, 0.08)
            ),
            #191f29;
          border-color: rgba(56, 189, 248, 0.45);
          box-shadow:
            inset -3px 0 0 var(--explorer-primary),
            0 3px 12px rgba(0, 0, 0, 0.12);
        }

        #dashboard-project-explorer .dashboard-project-choice strong {
          display: block;
          margin-bottom: 5px;
          color: #e8edf5;
          font-size: 13px;
          font-weight: 750;
          line-height: 1.9;
          overflow-wrap: anywhere;
        }

        #dashboard-project-explorer .dashboard-project-choice span {
          display: block;
          color: var(--explorer-muted);
          font-size: 11px;
          line-height: 1.9;
          overflow-wrap: anywhere;
        }

        #dashboard-project-explorer .dashboard-selected-project-base > h3 {
          margin: 0 0 15px;
          padding-bottom: 12px;
          color: #f1f5f9;
          border-bottom: 1px solid var(--explorer-border);
          font-size: 18px;
          font-weight: 800;
          line-height: 1.9;
          overflow-wrap: anywhere;
        }

        #dashboard-project-explorer .dashboard-project-base {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 9px;
          margin-bottom: 16px;
        }

        #dashboard-project-explorer .dashboard-project-base-item {
          min-width: 0;
          padding: 11px 12px;
          color: var(--explorer-text);
          background: linear-gradient(145deg, #222c3b, #191f29);
          border: 1px solid var(--explorer-border);
          border-radius: 10px;
          overflow-wrap: anywhere;
        }

        #dashboard-project-explorer .dashboard-project-base-item span {
          display: block;
          margin-bottom: 5px;
          color: var(--explorer-muted);
          font-size: 11px;
          line-height: 1.8;
        }

        #dashboard-project-explorer .dashboard-project-base-item strong {
          display: block;
          color: #e8edf5;
          font-size: 12px;
          font-weight: 750;
          line-height: 1.9;
          overflow-wrap: anywhere;
        }

        #dashboard-project-explorer .dashboard-selected-project-base h4 {
          margin: 20px 0 12px;
          color: #e8f0fa;
          font-size: 14px;
          font-weight: 800;
        }

        #dashboard-project-explorer .dashboard-compact-timeline {
          position: relative;
          padding-right: 17px;
        }

        #dashboard-project-explorer .dashboard-compact-timeline::before {
          position: absolute;
          top: 8px;
          right: 4px;
          bottom: 8px;
          width: 2px;
          background: #354154;
          content: "";
        }

        #dashboard-project-explorer .dashboard-compact-event {
          position: relative;
          margin-bottom: 10px;
          padding: 12px 13px;
          color: var(--explorer-text);
          background: linear-gradient(145deg, #202836, #191f29);
          border: 1px solid #303c4f;
          border-radius: 11px;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        #dashboard-project-explorer .dashboard-compact-event:hover {
          border-color: #40536c;
          box-shadow: 0 5px 16px rgba(0, 0, 0, 0.12);
        }

        #dashboard-project-explorer .dashboard-compact-event::before {
          position: absolute;
          top: 16px;
          right: -18px;
          width: 9px;
          height: 9px;
          background: var(--explorer-primary);
          border: 2px solid #191f29;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
          content: "";
        }

        #dashboard-project-explorer .dashboard-compact-event-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        #dashboard-project-explorer .dashboard-compact-event-title {
          color: #e8edf5;
          font-size: 13px;
          font-weight: 750;
          line-height: 1.9;
          overflow-wrap: anywhere;
        }

        #dashboard-project-explorer .dashboard-compact-event-date {
          color: var(--explorer-muted);
          font-size: 11px;
          line-height: 1.9;
        }

        #dashboard-project-explorer .dashboard-compact-event-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px 14px;
          margin-top: 7px;
          color: var(--explorer-muted);
          font-size: 11px;
          line-height: 1.9;
        }

        #dashboard-project-explorer .dashboard-compact-event-description {
          margin-top: 8px;
          padding: 9px 11px;
          color: #cbd5e1;
          background: rgba(17, 21, 28, 0.5);
          border: 1px solid rgba(53, 65, 84, 0.6);
          border-radius: 8px;
          font-size: 12px;
          line-height: 2;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        #dashboard-project-explorer .dashboard-compact-event-data {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 9px;
        }

        #dashboard-project-explorer .dashboard-compact-event-data span {
          max-width: 100%;
          padding: 5px 8px;
          color: #cbd5e1;
          background: #283344;
          border: 1px solid #354154;
          border-radius: 7px;
          font-size: 11px;
          line-height: 1.9;
          overflow-wrap: anywhere;
        }

        #dashboard-project-explorer .dashboard-detail-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 15px;
          color: var(--explorer-primary);
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: color 0.18s ease;
        }

        #dashboard-project-explorer .dashboard-detail-link:hover {
          color: #7dd3fc;
          text-decoration: underline;
        }

        #dashboard-project-explorer .table-empty {
          padding: 20px 12px;
          color: var(--explorer-muted);
          background: transparent;
          text-align: center;
          font-size: 12px;
          line-height: 2;
        }

        #dashboard-project-explorer .btn-secondary {
          color: #d5deeb;
          background: #252f3e;
          border-color: #3b485c;
        }

        #dashboard-project-explorer .btn-secondary:hover {
          color: #fff;
          background: #303d50;
          border-color: #53647c;
        }

        #dashboard-project-explorer [hidden] {
          display: none !important;
        }

        @media (max-width: 760px) {
          #dashboard-project-explorer .card-body {
            padding: 15px;
          }

          #dashboard-project-explorer .dashboard-explorer-layout {
            grid-template-columns: minmax(0, 1fr);
          }

          #dashboard-project-explorer .dashboard-project-list {
            max-height: 270px;
          }

          #dashboard-project-explorer .dashboard-project-base {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 480px) {
          #dashboard-project-explorer .card-body {
            padding: 12px;
          }

          #dashboard-project-explorer .dashboard-project-list-panel,
          #dashboard-project-explorer .dashboard-project-detail-panel {
            padding: 11px;
          }

          #dashboard-project-explorer .dashboard-explorer-heading h3 {
            font-size: 14px;
          }

          #dashboard-project-explorer .dashboard-project-base {
            grid-template-columns: minmax(0, 1fr);
          }

          #dashboard-project-explorer .dashboard-compact-event {
            padding: 10px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          #dashboard-project-explorer *,
          #dashboard-project-explorer *::before,
          #dashboard-project-explorer *::after {
            transition-duration: 0.01ms !important;
          }
        }
      `;
    },

    loadProjects: async function () {
      const cacheKey = 'dashboard_projects_lookup';

      try {
        const result = await window.PMS.Api.getCached(
          '/projects',
          cacheKey,
          {
            onRefresh: function (data) {
              Dashboard.projects = Dashboard.normalizeArray(
                data,
                ['projects', 'items', 'Projects', 'Items']
              );

              Dashboard.renderProjectList();
              Dashboard.refreshSelectedProjectIfNeeded();
            }
          }
        );

        this.projects = this.normalizeArray(
          result ? result.data : null,
          ['projects', 'items', 'Projects', 'Items']
        );

        this.renderProjectList();
      } catch (error) {
        const list = document.getElementById('dashboard-project-list');

        if (list && !this.projects.length) {
          list.innerHTML =
            '<div class="table-empty">دریافت فهرست پروژه‌ها ناموفق بود.</div>';
        }
      }
    },

    loadSharedData: async function () {
      const requests = [
        {
          path: '/users',
          key: 'dashboard_users_lookup',
          assign: function (data) {
            Dashboard.users = Dashboard.normalizeArray(
              data,
              ['users', 'items', 'Users', 'Items']
            );
          }
        },
        {
          path: '/departments',
          key: 'dashboard_departments_lookup',
          assign: function (data) {
            Dashboard.departments = Dashboard.normalizeArray(
              data,
              ['departments', 'items', 'Departments', 'Items']
            );
          }
        },
        {
          path: '/event-types',
          key: 'dashboard_event_types_lookup',
          assign: function (data) {
            Dashboard.eventTypes = Dashboard.normalizeArray(
              data,
              ['eventTypes', 'items', 'EventTypes', 'Items']
            );

            Dashboard.lookups.eventTypes = Dashboard.toLookup(
              data,
              ['ID', 'EventTypeID', 'Id', 'id'],
              ['Name', 'Title', 'Code']
            );
          }
        }
      ];

      await Promise.all(requests.map(async function (item) {
        try {
          const result = await window.PMS.Api.getCached(
            item.path,
            item.key,
            {
              onRefresh: function (data) {
                item.assign(data);

                if (Dashboard.selectedEvents.length) {
                  Dashboard.renderSelectedTimeline();
                }
              }
            }
          );

          item.assign(result ? result.data : null);
        } catch (error) {
          console.warn(
            'دریافت اطلاعات مشترک داشبورد انجام نشد.',
            item.path,
            error
          );
        }
      }));
    },

    renderProjectList: function (searchText) {
      const container = document.getElementById('dashboard-project-list');
      if (!container) return;

      const searchInput =
        document.getElementById('dashboard-project-search');

      const query = String(
        searchText !== undefined
          ? searchText
          : (searchInput ? searchInput.value : '')
      ).trim().toLowerCase();

      const filtered = this.projects.filter(function (project) {
        const title = String(project.Title || '').toLowerCase();
        const code = String(project.ProjectCode || '').toLowerCase();

        return !query ||
          title.indexOf(query) !== -1 ||
          code.indexOf(query) !== -1;
      });

      if (!filtered.length) {
        container.innerHTML =
          '<div class="table-empty">پروژه‌ای مطابق جستجو پیدا نشد.</div>';
        return;
      }

      let html = '<div class="dashboard-project-list">';

      filtered.forEach(function (project) {
        const id = project.ID || project.Id || project.id;

        const selected =
          Dashboard.selectedProjectId !== null &&
          String(Dashboard.selectedProjectId) === String(id);

        html +=
          '<button type="button" class="dashboard-project-choice' +
            (selected ? ' selected' : '') + '"' +
            ' data-project-id="' + Dashboard.escape(id || '') + '">' +
            '<strong>' + Dashboard.escape(project.Title || 'بدون عنوان') + '</strong>' +
            '<span>کد: ' + Dashboard.escape(project.ProjectCode || '-') + '</span>' +
            '<span>وضعیت: ' + Dashboard.escape(Dashboard.statusText(project.Status)) + '</span>' +
          '</button>';
      });

      html += '</div>';
      container.innerHTML = html;

      container.querySelectorAll('.dashboard-project-choice').forEach(function (button) {
        button.addEventListener('click', function () {
          Dashboard.selectProject(button.getAttribute('data-project-id'));
        });
      });
    },

    selectProject: async function (projectId, forceRefresh) {
      if (!projectId) return;

      this.selectedProjectId = String(projectId);
      this.renderProjectList();

      const closeButton = document.getElementById('dashboard-project-close');
      if (closeButton) closeButton.hidden = false;

      const detail = document.getElementById('dashboard-selected-project');
      if (!detail) return;

      const cachedProject = window.PMS.Cache.get(
        window.PMS.Cache.keys.PROJECT + '_' + projectId
      );

      const cachedEvents = window.PMS.Cache.get(
        window.PMS.Cache.keys.PROJECT_EVENTS + '_' + projectId
      );

      if (cachedProject !== null) {
        this.selectedProject = this.unwrap(cachedProject);
        this.renderSelectedProject();
      } else {
        const listProject = this.findProject(projectId);

        if (listProject) {
          this.selectedProject = listProject;
          this.renderSelectedProject();
        } else {
          detail.innerHTML =
            '<div class="table-empty">در حال دریافت اطلاعات پروژه...</div>';
        }
      }

      if (cachedEvents !== null) {
        this.selectedEvents = this.normalizeArray(
          cachedEvents,
          ['events', 'items', 'Events', 'Items']
        );

        this.renderSelectedTimeline();
      }

      const version = ++this.loadVersion;

      try {
        const projectKey =
          window.PMS.Cache.keys.PROJECT + '_' + projectId;

        const eventsKey =
          window.PMS.Cache.keys.PROJECT_EVENTS + '_' + projectId;

        const projectRequest = forceRefresh
          ? window.PMS.Api.getFresh(
              '/projects/' + encodeURIComponent(projectId),
              projectKey
            ).then(function (data) {
              return { data: data, cached: false };
            })
          : window.PMS.Api.getCached(
              '/projects/' + encodeURIComponent(projectId),
              projectKey,
              {
                onRefresh: function (data) {
                  if (
                    Dashboard.loadVersion !== version ||
                    String(Dashboard.selectedProjectId) !== String(projectId)
                  ) return;

                  Dashboard.selectedProject = Dashboard.unwrap(data);
                  Dashboard.renderSelectedProject();
                }
              }
            );

        const eventsRequest = forceRefresh
          ? window.PMS.Api.getFresh(
              '/projects/' + encodeURIComponent(projectId) + '/events',
              eventsKey
            ).then(function (data) {
              return { data: data, cached: false };
            })
          : window.PMS.Api.getCached(
              '/projects/' + encodeURIComponent(projectId) + '/events',
              eventsKey,
              {
                onRefresh: function (data) {
                  if (
                    Dashboard.loadVersion !== version ||
                    String(Dashboard.selectedProjectId) !== String(projectId)
                  ) return;

                  Dashboard.selectedEvents = Dashboard.normalizeArray(
                    data,
                    ['events', 'items', 'Events', 'Items']
                  );

                  Dashboard.renderSelectedTimeline();
                  Dashboard.loadSelectedEventDetails(projectId);
                }
              }
            );

        const results = await Promise.all([
          projectRequest,
          eventsRequest
        ]);

        if (
          this.loadVersion !== version ||
          String(this.selectedProjectId) !== String(projectId)
        ) return;

        this.selectedProject = this.unwrap(results[0].data);

        this.selectedEvents = this.normalizeArray(
          results[1].data,
          ['events', 'items', 'Events', 'Items']
        );

        this.renderSelectedProject();
        this.renderSelectedTimeline();

        this.loadSelectedWorkflowSteps(projectId);
        this.loadSelectedEventDetails(projectId);
      } catch (error) {
        if (
          this.loadVersion !== version ||
          String(this.selectedProjectId) !== String(projectId)
        ) return;

        if (!this.selectedProject && !this.selectedEvents.length) {
          detail.innerHTML =
            '<div class="alert alert-danger">' +
              this.escape(
                error && error.message
                  ? error.message
                  : 'دریافت اطلاعات پروژه انجام نشد.'
              ) +
            '</div>';
        }
      }
    },

    findProject: function (projectId) {
      return this.projects.find(function (project) {
        return String(project.ID || project.Id || project.id) === String(projectId);
      }) || null;
    },

    refreshSelectedProjectIfNeeded: function () {
      if (!this.selectedProjectId) return;

      const updated = this.findProject(this.selectedProjectId);

      if (updated) {
        this.selectedProject = Object.assign(
          {},
          this.selectedProject || {},
          updated
        );

        this.renderSelectedProject();
      }
    },

    renderSelectedProject: function () {
      const container =
        document.getElementById('dashboard-selected-project');

      const project = this.selectedProject;

      if (!container || !project) return;

      const id = project.ID || project.Id || project.id;

      const currentStep = this.findById(
        this.workflowSteps,
        project.CurrentStepID
      );

      const stepName = currentStep
        ? currentStep.Name || currentStep.Title || currentStep.Code
        : (project.CurrentStepID || '-');

      container.innerHTML =
        '<div class="dashboard-selected-project-base">' +
          '<h3>' + this.escape(project.Title || 'بدون عنوان') + '</h3>' +
          '<div class="dashboard-project-base">' +
            this.baseItem('کد پروژه', project.ProjectCode) +
            this.baseItem('وضعیت', this.statusText(project.Status)) +
            this.baseItem('مرحله فعلی', stepName) +
            this.baseItem('تاریخ ایجاد', this.formatDate(project.CreatedAt)) +
            this.baseItem('آخرین فعالیت', this.formatDate(project.UpdatedAt)) +
            this.baseItem('شناسه پروژه', id) +
          '</div>' +
          (
            project.Description
              ? '<div class="dashboard-compact-event-description">' +
                  this.escape(project.Description) +
                '</div>'
              : ''
          ) +
          '<h4>خط زمانی پروژه</h4>' +
          '<div id="dashboard-selected-timeline">' +
            '<div class="table-empty">در حال دریافت رویدادها...</div>' +
          '</div>' +
          '<a class="dashboard-detail-link" href="#project-detail/' +
            encodeURIComponent(id) +
          '">مشاهده صفحه کامل پروژه ←</a>' +
        '</div>';

      this.renderSelectedTimeline();
    },

    baseItem: function (label, value) {
      return (
        '<div class="dashboard-project-base-item">' +
          '<span>' + this.escape(label) + '</span>' +
          '<strong>' +
            this.escape(
              value === null || value === undefined || value === ''
                ? '-'
                : value
            ) +
          '</strong>' +
        '</div>'
      );
    },

    loadSelectedWorkflowSteps: async function (projectId) {
      const project = this.selectedProject;

      if (
        !project ||
        !project.WorkflowID ||
        String(this.selectedProjectId) !== String(projectId)
      ) return;

      const key =
        window.PMS.Cache.keys.WORKFLOW_STEPS + '_' + project.WorkflowID;

      try {
        const result = await window.PMS.Api.getCached(
          '/workflows/' + encodeURIComponent(project.WorkflowID) + '/steps',
          key
        );

        if (String(this.selectedProjectId) !== String(projectId)) return;

        this.workflowSteps = this.normalizeArray(
          result ? result.data : null,
          ['steps', 'items', 'Steps', 'Items']
        );

        this.renderSelectedProject();
      } catch (error) {
        // اطلاعات پایه بدون نام مرحله نیز نمایش داده می‌شود.
      }
    },

    loadSelectedEventDetails: async function (projectId) {
      const events = this.selectedEvents.slice();

      await Promise.all(events.map(async function (event) {
        const id = event.ID || event.Id || event.id;
        if (!id) return;

        const eventId = String(id);

        if (Dashboard.pendingRequests[eventId]) {
          return Dashboard.pendingRequests[eventId];
        }

        const request = (async function () {
          try {
            await Promise.all([
              Dashboard.loadSelectedEventData(event, projectId),
              Dashboard.loadSelectedEventFields(event, projectId)
            ]);
          } finally {
            delete Dashboard.pendingRequests[eventId];
          }
        })();

        Dashboard.pendingRequests[eventId] = request;
        return request;
      }));

      if (String(this.selectedProjectId) === String(projectId)) {
        this.renderSelectedTimeline();
      }
    },

    loadSelectedEventData: async function (event, projectId) {
      const id = event.ID || event.Id || event.id;
      const eventId = String(id);
      const cacheKey = 'eventData_' + eventId;

      try {
        const result = await window.PMS.Api.getCached(
          '/events/' + encodeURIComponent(eventId) + '/data',
          cacheKey,
          {
            onRefresh: function (data) {
              if (String(Dashboard.selectedProjectId) !== String(projectId)) return;

              Dashboard.eventData[eventId] = Dashboard.normalizeEventData(data);
              Dashboard.renderSelectedTimeline();
            }
          }
        );

        if (String(this.selectedProjectId) !== String(projectId)) return;

        this.eventData[eventId] = this.normalizeEventData(
          result ? result.data : null
        );
      } catch (error) {
        // رویداد بدون اطلاعات تکمیلی نیز نمایش داده می‌شود.
      }
    },

    normalizeEventData: function (data) {
      data = this.unwrap(data);

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {};
      }

      if (typeof data.DataJSON === 'string') {
        try {
          return JSON.parse(data.DataJSON);
        } catch (error) {
          return {};
        }
      }

      if (typeof data.dataJSON === 'string') {
        try {
          return JSON.parse(data.dataJSON);
        } catch (error) {
          return {};
        }
      }

      if (data.Data && typeof data.Data === 'object' && !Array.isArray(data.Data)) {
        return data.Data;
      }

      if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
        return data.data;
      }

      return data;
    },

    loadSelectedEventFields: async function (event, projectId) {
      const typeId = event.EventTypeID || event.EventTypeId;
      if (!typeId) return;

      const typeKey = String(typeId);

      if (Object.prototype.hasOwnProperty.call(this.eventFields, typeKey)) {
        return;
      }

      const cacheKey = window.PMS.Cache.keys.EVENT_FIELDS + '_' + typeKey;

      try {
        const result = await window.PMS.Api.getCached(
          '/event-types/' + encodeURIComponent(typeKey) + '/fields',
          cacheKey,
          {
            onRefresh: function (data) {
              Dashboard.eventFields[typeKey] = Dashboard.normalizeArray(
                data,
                ['fields', 'items', 'Fields', 'Items']
              ).filter(function (field) {
                return !field.Status ||
                  String(field.Status).toUpperCase() === 'ACTIVE';
              });

              if (String(Dashboard.selectedProjectId) === String(projectId)) {
                Dashboard.renderSelectedTimeline();
              }
            }
          }
        );

        this.eventFields[typeKey] = this.normalizeArray(
          result ? result.data : null,
          ['fields', 'items', 'Fields', 'Items']
        ).filter(function (field) {
          return !field.Status ||
            String(field.Status).toUpperCase() === 'ACTIVE';
        });
      } catch (error) {
        // اطلاعات رویداد بدون عنوان فیلدها نیز نمایش داده می‌شود.
      }
    },

    renderSelectedTimeline: function () {
      const container =
        document.getElementById('dashboard-selected-timeline');

      if (!container) return;

      const events = this.selectedEvents.slice();

      if (!events.length) {
        container.innerHTML =
          '<div class="table-empty">برای این پروژه رویدادی ثبت نشده است.</div>';
        return;
      }

      events.sort(function (a, b) {
        const first = Dashboard.getEventTime(a);
        const second = Dashboard.getEventTime(b);

        if (first === null && second === null) return 0;
        if (first === null) return 1;
        if (second === null) return -1;

        return first - second;
      });

      let html = '<div class="dashboard-compact-timeline">';

      events.forEach(function (event) {
        const id = String(event.ID || event.Id || event.id || '');
        const typeId = event.EventTypeID || event.EventTypeId;

        const type = Dashboard.findById(Dashboard.eventTypes, typeId);
        const department = Dashboard.findById(
          Dashboard.departments,
          event.DepartmentID || event.DepartmentId
        );
        const performer = Dashboard.findById(
          Dashboard.users,
          event.PerformedBy || event.PerformedByID
        );
        const creator = Dashboard.findById(
          Dashboard.users,
          event.CreatedBy || event.CreatedByID
        );

        const title = type
          ? type.Name || type.Title || type.Code
          : (
              event.EventTypeName ||
              event.EventTypeCode ||
              Dashboard.lookups.eventTypes[String(typeId)] ||
              'رویداد'
            );

        const fields = Dashboard.eventFields[String(typeId || '')] || [];
        const data = Dashboard.eventData[id] || {};

        html +=
          '<article class="dashboard-compact-event">' +
            '<div class="dashboard-compact-event-head">' +
              '<div class="dashboard-compact-event-title">' +
                Dashboard.escape(title || 'رویداد') +
              '</div>' +
              '<div class="dashboard-compact-event-date">' +
                Dashboard.escape(
                  Dashboard.formatDate(
                    event.OccurredAt || event.occurredAt || event.CreatedAt
                  )
                ) +
              '</div>' +
            '</div>' +
            '<div class="dashboard-compact-event-meta">' +
              (
                department
                  ? '<span>واحد: ' +
                      Dashboard.escape(department.Name || department.Title || '-') +
                    '</span>'
                  : (
                      event.DepartmentName
                        ? '<span>واحد: ' + Dashboard.escape(event.DepartmentName) + '</span>'
                        : ''
                    )
              ) +
              (
                performer
                  ? '<span>اجراکننده: ' +
                      Dashboard.escape(performer.Name || performer.Username || '-') +
                    '</span>'
                  : (
                      event.PerformedByName
                        ? '<span>اجراکننده: ' + Dashboard.escape(event.PerformedByName) + '</span>'
                        : ''
                    )
              ) +
              (
                creator
                  ? '<span>ثبت‌کننده: ' +
                      Dashboard.escape(creator.Name || creator.Username || '-') +
                    '</span>'
                  : (
                      event.CreatedByName
                        ? '<span>ثبت‌کننده: ' + Dashboard.escape(event.CreatedByName) + '</span>'
                        : ''
                    )
              ) +
            '</div>' +
            (
              event.Description
                ? '<div class="dashboard-compact-event-description">' +
                    Dashboard.escape(event.Description) +
                  '</div>'
                : ''
            ) +
            Dashboard.renderCompactDynamicData(data, fields) +
            '<div class="dashboard-compact-event-meta">' +
              '<span>تاریخ ثبت: ' +
                Dashboard.escape(Dashboard.formatDate(event.CreatedAt)) +
              '</span>' +
              '<span>وضعیت: ' +
                Dashboard.escape(Dashboard.statusText(event.Status)) +
              '</span>' +
            '</div>' +
          '</article>';
      });

      html += '</div>';
      container.innerHTML = html;
    },

    renderCompactDynamicData: function (data, fields) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return '';

      const keys = Object.keys(data).filter(function (key) {
        return data[key] !== null &&
          data[key] !== undefined &&
          String(data[key]) !== '';
      });

      if (!keys.length) return '';

      let html = '<div class="dashboard-compact-event-data">';

      keys.forEach(function (key) {
        const field = fields.find(function (item) {
          return String(item.Code) === String(key);
        });

        const label = field ? field.Name || field.Code : key;
        let value = data[key];

        if (typeof value === 'object') {
          try {
            value = JSON.stringify(value);
          } catch (error) {
            value = String(value);
          }
        }

        html +=
          '<span>' +
            Dashboard.escape(label) + ': ' +
            Dashboard.escape(value) +
          '</span>';
      });

      html += '</div>';
      return html;
    },

    getEventTime: function (event) {
      const value =
        event.OccurredAt ||
        event.occurredAt ||
        event.CreatedAt ||
        event.createdAt;

      if (!value) return null;

      const time = new Date(value).getTime();
      return Number.isNaN(time) ? null : time;
    },

    findById: function (items, id) {
      if (!Array.isArray(items) || id === null || id === undefined || id === '') {
        return null;
      }

      return items.find(function (item) {
        return item && [item.ID, item.Id, item.id].some(function (value) {
          return value !== null &&
            value !== undefined &&
            String(value) === String(id);
        });
      }) || null;
    },

    showError: function (error) {
      const errorBox = document.getElementById('dashboard-error');
      if (!errorBox) return;

      errorBox.textContent =
        error && error.message
          ? error.message
          : 'خطا در دریافت اطلاعات داشبورد.';

      errorBox.hidden = false;
    },

    setText: function (id, value) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    },

    formatDate: function (value) {
      if (!value) return '-';

      const date = new Date(value);

      if (isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleString('fa-IR');
    },

    statusText: function (status) {
      const labels = {
        ACTIVE: 'فعال',
        INACTIVE: 'غیرفعال',
        ON_HOLD: 'متوقف',
        COMPLETED: 'تکمیل‌شده',
        CANCELLED: 'لغوشده',
        VOID: 'باطل‌شده',
        DELETED: 'حذف‌شده',
        PENDING: 'در انتظار',
        DRAFT: 'پیش‌نویس',
        SUBMITTED: 'ثبت‌شده',
        APPROVED: 'تأییدشده',
        REJECTED: 'ردشده'
      };

      return labels[status] || status || '-';
    },

    escape: function (value) {
      if (value === null || value === undefined) return '';

      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };

  window.PMS.Dashboard = Dashboard;
  window.PMS.Modules.Dashboard = Dashboard;

})();
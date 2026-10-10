(function () {
  'use strict';

  const CACHE_KEY = window.PMS.Cache.keys.EVENTS;
  const PROJECTS_CACHE_KEY = window.PMS.Cache.keys.PROJECTS;
  const EVENT_TYPES_CACHE_KEY = window.PMS.Cache.keys.EVENT_TYPES;

  const Events = {
    events: [],
    projects: [],
    eventTypes: [],
    eventFields: [],
    modalOpen: false,
    submitting: false,

    init: function () {
      this.bindEvents();
      this.load();
    },

    bindEvents: function () {
      const ids = [
        'event-project-filter',
        'event-type-filter',
        'event-status-filter'
      ];

      ids.forEach(function (id) {
        const element = document.getElementById(id);
        if (element) {
          element.addEventListener('change', function () {
            Events.applyFilters();
          });
        }
      });

      const search = document.getElementById('event-search');
      if (search) {
        search.addEventListener('input', () => this.applyFilters());
      }

      const createButton = document.getElementById('event-create-button');
      if (createButton) {
        createButton.addEventListener('click', () => this.openForm());
      }
    },

    load: async function () {
      const loading = document.getElementById('events-loading');
      const cachedEvents = window.PMS.Cache.get(CACHE_KEY);
      const cachedProjects = window.PMS.Cache.get(PROJECTS_CACHE_KEY);
      const cachedTypes = window.PMS.Cache.get(EVENT_TYPES_CACHE_KEY);

      if (cachedEvents !== null) this.events = this.normalize(cachedEvents);
      if (cachedProjects !== null) this.projects = this.normalize(cachedProjects);
      if (cachedTypes !== null) this.eventTypes = this.normalize(cachedTypes);

      if (cachedEvents !== null || cachedProjects !== null || cachedTypes !== null) {
        this.renderFilters();
        this.applyFilters();
        if (loading) loading.hidden = true;
      }

      try {
        const results = await Promise.all([
          window.PMS.Api.getCached('/events', CACHE_KEY, {
            onRefresh: function (data) {
              Events.events = Events.normalize(data);
              Events.applyFilters();
            },
            onError: function (error, isBackground) {
              if (!isBackground) Events.showError(error);
            }
          }),
          window.PMS.Api.getCached('/projects', PROJECTS_CACHE_KEY, {
            onRefresh: function (data) {
              Events.projects = Events.normalize(data);
              Events.renderFilters();
              Events.applyFilters();
            }
          }),
          window.PMS.Api.getCached('/event-types', EVENT_TYPES_CACHE_KEY, {
            onRefresh: function (data) {
              Events.eventTypes = Events.normalize(data);
              Events.renderFilters();
              Events.applyFilters();
            }
          })
        ]);

        if (results[0] && results[0].cached === false) {
          this.events = this.normalize(results[0].data);
        }
        if (results[1] && results[1].cached === false) {
          this.projects = this.normalize(results[1].data);
        }
        if (results[2] && results[2].cached === false) {
          this.eventTypes = this.normalize(results[2].data);
        }

        this.renderFilters();
        this.applyFilters();
      } catch (error) {
        if (cachedEvents === null) this.showError(error);
      } finally {
        if (loading) loading.hidden = true;
      }
    },

    normalize: function (data) {
      if (Array.isArray(data)) return data;
      if (!data || typeof data !== 'object') return [];

      const keys = [
        'items', 'events', 'projects', 'eventTypes', 'fields',
        'data', 'records', 'values'
      ];

      for (const key of keys) {
        if (Array.isArray(data[key])) return data[key];
      }

      return [];
    },

    renderFilters: function () {
      const projectFilter = document.getElementById('event-project-filter');
      const typeFilter = document.getElementById('event-type-filter');

      if (projectFilter) {
        const current = projectFilter.value;
        let html = '<option value="">همه پروژه‌ها</option>';

        this.projects.forEach(function (project) {
          const id = Events.idOf(project);
          if (!id) return;
          const title = project.ProjectCode || project.Title || project.Name || id;

          html += '<option value="' + Events.escape(id) + '">' +
            Events.escape(title) + '</option>';
        });

        projectFilter.innerHTML = html;
        projectFilter.value = current;
      }

      if (typeFilter) {
        const current = typeFilter.value;
        let html = '<option value="">همه انواع</option>';

        this.eventTypes.forEach(function (type) {
          const id = Events.idOf(type);
          if (!id) return;
          const title = type.Name || type.Code || id;

          html += '<option value="' + Events.escape(id) + '">' +
            Events.escape(title) + '</option>';
        });

        typeFilter.innerHTML = html;
        typeFilter.value = current;
      }
    },

    applyFilters: function () {
      const projectFilter = document.getElementById('event-project-filter');
      const typeFilter = document.getElementById('event-type-filter');
      const statusFilter = document.getElementById('event-status-filter');
      const searchInput = document.getElementById('event-search');

      const projectId = projectFilter ? projectFilter.value : '';
      const typeId = typeFilter ? typeFilter.value : '';
      const status = statusFilter ? statusFilter.value : '';
      const search = searchInput ? searchInput.value.trim().toLowerCase() : '';

      const filtered = this.events.filter(function (event) {
        if (projectId && String(event.ProjectID || '') !== projectId) return false;
        if (typeId && String(event.EventTypeID || '') !== typeId) return false;
        if (status && String(event.Status || '') !== status) return false;

        if (search) {
          const project = Events.findById(Events.projects, event.ProjectID);
          const type = Events.findById(Events.eventTypes, event.EventTypeID);

          const values = [
            event.Description,
            event.ProjectCode,
            event.ProjectTitle,
            event.ProjectID,
            project && project.ProjectCode,
            project && project.Title,
            event.EventTypeName,
            event.EventTypeID,
            type && type.Name,
            type && type.Code,
            event.CreatorName,
            event.PerformedByName,
            event.DepartmentName,
            event.CreatedBy,
            event.PerformedBy,
            event.DepartmentID,
            event.ID
          ];

          const haystack = values.filter(Boolean).join(' ').toLowerCase();
          if (haystack.indexOf(search) === -1) return false;
        }

        return true;
      });

      this.render(filtered);
    },

    render: function (events) {
      const container = document.getElementById('events-table-container');
      const empty = document.getElementById('events-empty');
      if (!container) return;

      if (!events || events.length === 0) {
        container.innerHTML = '';
        container.hidden = true;
        if (empty) empty.hidden = false;
        return;
      }

      if (empty) empty.hidden = true;

      let html =
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>پروژه</th>' +
            '<th>نوع رویداد</th>' +
            '<th>شرح فعالیت</th>' +
            '<th>تاریخ وقوع</th>' +
            '<th>تاریخ ثبت</th>' +
            '<th>ثبت‌کننده</th>' +
            '<th>واحد</th>' +
            '<th>وضعیت</th>' +
            '<th>جزئیات</th>' +
          '</tr></thead><tbody>';

      events.forEach(function (event) {
        const project = Events.findById(Events.projects, event.ProjectID);
        const type = Events.findById(Events.eventTypes, event.EventTypeID);

        const projectName =
          event.ProjectCode ||
          (project && (project.ProjectCode || project.Title || project.Name)) ||
          event.ProjectID || '-';

        const typeName =
          event.EventTypeName ||
          (type && (type.Name || type.Code)) ||
          event.EventTypeID || '-';

        const creatorName = event.CreatorName || event.CreatedBy || '-';
        const departmentName = event.DepartmentName || event.DepartmentID || '-';

        html +=
          '<tr>' +
            '<td>' + Events.escape(projectName) + '</td>' +
            '<td>' + Events.escape(typeName) + '</td>' +
            '<td>' + Events.escape(event.Description || '-') + '</td>' +
            '<td>' + Events.escape(Events.formatDate(event.OccurredAt)) + '</td>' +
            '<td>' + Events.escape(Events.formatDate(event.CreatedAt)) + '</td>' +
            '<td>' + Events.escape(creatorName) + '</td>' +
            '<td>' + Events.escape(departmentName) + '</td>' +
            '<td><span class="status-badge">' +
              Events.escape(Events.statusText(event.Status)) +
            '</span></td>' +
            '<td><button type="button" class="btn btn-secondary event-details-button" ' +
              'data-event-id="' + Events.escape(event.ID || '') + '">مشاهده</button></td>' +
          '</tr>';
      });

      html += '</tbody></table>';
      container.innerHTML = html;
      container.hidden = false;

      container.querySelectorAll('.event-details-button').forEach(function (button) {
        button.addEventListener('click', function () {
          Events.openDetails(button.getAttribute('data-event-id'));
        });
      });
    },

    /* استایل اختصاصی مودال‌ها با تم تاریک */
    modalStyles: function () {
      return `
        <style>
          #event-create-modal,
          #event-details-modal {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(0, 0, 0, .76);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            box-sizing: border-box;
            color: #e5e7eb;
            font-family: inherit;
          }

          #event-create-modal *,
          #event-details-modal * {
            box-sizing: border-box;
          }

          #event-create-modal .event-modal-panel,
          #event-details-modal .event-modal-panel {
            width: 100%;
            max-width: 760px;
            max-height: 90vh;
            overflow: auto;
            padding: 24px;
            border: 1px solid #303a48;
            border-radius: 14px;
            background: #1b222d !important;
            color: #e5e7eb !important;
            box-shadow: 0 24px 70px rgba(0, 0, 0, .5);
          }

          #event-details-modal .event-modal-panel {
            max-width: 800px;
          }

          #event-create-modal .event-modal-heading,
          #event-details-modal .event-modal-heading {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 14px;
            border-bottom: 1px solid #303a48;
          }

          #event-create-modal h3,
          #event-create-modal h4,
          #event-details-modal h3,
          #event-details-modal h4 {
            color: #f3f4f6 !important;
          }

          #event-create-modal .event-modal-heading h3,
          #event-details-modal .event-modal-heading h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
          }

          #event-create-modal label,
          #event-details-modal label {
            display: block;
            margin-bottom: 6px;
            color: #cbd5e1 !important;
            font-size: 13px;
          }

          #event-create-modal input:not([type="checkbox"]),
          #event-create-modal select,
          #event-create-modal textarea {
            display: block;
            width: 100%;
            min-width: 0;
            margin-top: 6px;
            padding: 10px 12px;
            border: 1px solid #3a4555;
            border-radius: 8px;
            outline: none;
            background: #111720 !important;
            color: #e5e7eb !important;
            font: inherit;
            font-size: 14px;
            transition: border-color .2s, box-shadow .2s;
          }

          #event-create-modal input:focus,
          #event-create-modal select:focus,
          #event-create-modal textarea:focus {
            border-color: #38bdf8;
            box-shadow: 0 0 0 3px rgba(56, 189, 248, .12);
          }

          #event-create-modal input[type="checkbox"] {
            accent-color: #38bdf8;
          }

          #event-create-modal select option {
            background: #1b222d;
            color: #e5e7eb;
          }

          #event-create-modal .event-modal-actions {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start;
            gap: 10px;
            margin-top: 24px;
            padding-top: 18px;
            border-top: 1px solid #303a48;
          }

          #event-create-modal .event-modal-button,
          #event-details-modal .event-modal-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 40px;
            padding: 9px 18px;
            border: 1px solid #3a4555;
            border-radius: 8px;
            background: #273244;
            color: #e5e7eb;
            font: inherit;
            font-size: 14px;
            cursor: pointer;
            transition: background .2s, border-color .2s;
          }

          #event-create-modal .event-modal-button:hover,
          #event-details-modal .event-modal-button:hover {
            background: #334155;
          }

          #event-create-modal .event-modal-button-primary {
            border-color: #0284c7;
            background: #0369a1;
            color: #fff;
          }

          #event-create-modal .event-modal-button-primary:hover {
            background: #0284c7;
          }

          #event-create-modal .event-modal-button:disabled {
            opacity: .6;
            cursor: not-allowed;
          }

          #event-create-modal .event-modal-close,
          #event-details-modal .event-modal-close {
            flex-shrink: 0;
            width: 36px;
            height: 36px;
            padding: 0;
            border: 1px solid #3a4555;
            border-radius: 8px;
            background: #222c3a;
            color: #cbd5e1;
            font-size: 24px;
            line-height: 1;
            cursor: pointer;
          }

          #event-create-modal .event-modal-close:hover,
          #event-details-modal .event-modal-close:hover {
            background: #374151;
            color: #fff;
          }

          #event-create-modal .event-modal-error {
            margin-bottom: 14px;
            padding: 12px;
            border: 1px solid #7f1d1d;
            border-radius: 8px;
            background: #351c25 !important;
            color: #fecaca !important;
          }

          #event-create-modal [hidden] {
            display: none !important;
          }

          #event-create-modal .event-muted,
          #event-details-modal .event-muted {
            color: #94a3b8 !important;
          }

          #event-details-modal .event-detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }

          #event-details-modal .event-detail-card {
            min-width: 0;
            padding: 12px;
            border: 1px solid #303a48;
            border-radius: 9px;
            background: #111720 !important;
            color: #e5e7eb !important;
          }

          #event-details-modal .event-detail-label {
            display: block;
            margin-bottom: 7px;
            color: #7dd3fc !important;
            font-size: 12px;
            font-weight: 600;
          }

          #event-details-modal .event-detail-value {
            overflow-wrap: anywhere;
            color: #e5e7eb !important;
            font-size: 14px;
          }

          #event-details-modal .event-modal-table-wrap {
            width: 100%;
            overflow-x: auto;
            border: 1px solid #303a48;
            border-radius: 8px;
          }

          #event-details-modal .event-modal-table {
            width: 100%;
            border-collapse: collapse;
            color: #e5e7eb !important;
            background: #1b222d !important;
          }

          #event-details-modal .event-modal-table th,
          #event-details-modal .event-modal-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #303a48;
            text-align: right;
            background: #1b222d !important;
            color: #e5e7eb !important;
          }

          #event-details-modal .event-modal-table th {
            background: #222c3a !important;
            color: #7dd3fc !important;
            font-weight: 600;
          }

          #event-details-modal .event-modal-table tr:last-child td {
            border-bottom: 0;
          }

          #event-create-modal .event-dynamic-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 14px;
          }

          @media (max-width: 600px) {
            #event-create-modal,
            #event-details-modal {
              padding: 8px;
            }

            #event-create-modal .event-modal-panel,
            #event-details-modal .event-modal-panel {
              max-height: 94vh;
              padding: 16px;
              border-radius: 10px;
            }

            #event-create-modal .event-dynamic-grid,
            #event-details-modal .event-detail-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      `;
    },

    openDetails: async function (eventId) {
      if (!eventId) return;

      if (this.modalOpen) this.closeModal();
      this.modalOpen = true;

      const modal = document.createElement('div');
      modal.id = 'event-details-modal';
      modal.dir = 'rtl';

      modal.innerHTML =
        this.modalStyles() +
        '<div class="event-modal-panel">' +
          '<div class="event-modal-heading">' +
            '<h3>جزئیات رویداد</h3>' +
            '<button type="button" id="event-details-close" ' +
              'class="event-modal-close" aria-label="بستن">×</button>' +
          '</div>' +
          '<div id="event-details-content" class="event-modal-content">' +
            '<p class="event-muted">در حال دریافت اطلاعات...</p>' +
          '</div>' +
        '</div>';

      document.body.appendChild(modal);

      document.getElementById('event-details-close').addEventListener(
        'click',
        () => this.closeModal()
      );

      modal.addEventListener('click', (event) => {
        if (event.target === modal) this.closeModal();
      });

      try {
        const responses = await Promise.all([
          window.PMS.Api.get('/events/' + encodeURIComponent(eventId)),
          window.PMS.Api.get('/events/' + encodeURIComponent(eventId) + '/data')
        ]);

        const event = this.extractObject(responses[0]);
        const dynamicData = this.extractDataObject(responses[1]);
        const project = this.findById(this.projects, event.ProjectID);
        const type = this.findById(this.eventTypes, event.EventTypeID);

        const rows = [
          ['شناسه رویداد', event.ID],
          ['پروژه', event.ProjectCode ||
            (project && (project.ProjectCode || project.Title || project.Name)) ||
            event.ProjectID],
          ['نوع رویداد', event.EventTypeName ||
            (type && (type.Name || type.Code)) || event.EventTypeID],
          ['شرح', event.Description],
          ['ثبت‌کننده', event.CreatorName || event.CreatedBy],
          ['انجام‌دهنده', event.PerformedByName || event.PerformedBy],
          ['واحد', event.DepartmentName || event.DepartmentID],
          ['تاریخ وقوع', this.formatDate(event.OccurredAt)],
          ['تاریخ ثبت', this.formatDate(event.CreatedAt)],
          ['وضعیت', this.statusText(event.Status)]
        ];

        let html = '<div class="event-detail-grid">';

        rows.forEach(function (row) {
          html +=
            '<div class="event-detail-card">' +
              '<strong class="event-detail-label">' +
                Events.escape(row[0]) +
              '</strong>' +
              '<div class="event-detail-value">' +
                Events.escape(row[1] || '-') +
              '</div>' +
            '</div>';
        });

        html += '</div><h4 style="margin-top:24px;margin-bottom:12px;">' +
          'اطلاعات اختصاصی رویداد</h4>';

        const values = this.dynamicEntries(dynamicData);

        if (values.length) {
          html +=
            '<div class="event-modal-table-wrap">' +
              '<table class="event-modal-table">' +
                '<thead><tr><th>فیلد</th><th>مقدار</th></tr></thead><tbody>';

          values.forEach(function (item) {
            html += '<tr><td>' + Events.escape(item[0]) +
              '</td><td>' + Events.escape(item[1]) + '</td></tr>';
          });

          html += '</tbody></table></div>';
        } else {
          html += '<p class="event-muted">' +
            'اطلاعات اختصاصی برای این رویداد ثبت نشده است.</p>';
        }

        const content = document.getElementById('event-details-content');
        if (content) content.innerHTML = html;
      } catch (error) {
        const content = document.getElementById('event-details-content');
        if (content) {
          content.textContent =
            'دریافت جزئیات ناموفق بود: ' + this.errorMessage(error);
        }
      }
    },

    extractObject: function (response) {
      let data = window.PMS.Api.extractData(response);
      if (Array.isArray(data)) return data[0] || {};
      if (data && data.event && typeof data.event === 'object') return data.event;
      return data && typeof data === 'object' ? data : {};
    },

    extractDataObject: function (response) {
      const data = window.PMS.Api.extractData(response);
      if (Array.isArray(data)) return data;

      if (data && typeof data === 'object') {
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data.fields)) return data.fields;
        if (Array.isArray(data.values)) return data.values;
        if (data.data && typeof data.data === 'object') return data.data;
        return data;
      }

      return {};
    },

    dynamicEntries: function (data) {
      if (Array.isArray(data)) {
        return data.map(function (item) {
          if (item && typeof item === 'object') {
            return [
              item.Name || item.FieldName || item.Code || item.FieldCode || 'فیلد',
              item.Value !== undefined ? item.Value :
                item.FieldValue !== undefined ? item.FieldValue : ''
            ];
          }

          return ['', item];
        });
      }

      if (!data || typeof data !== 'object') return [];

      return Object.keys(data).map(function (key) {
        const value = data[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const label = value.Name || value.FieldName || value.Label || key;
          const actual = value.Value !== undefined ? value.Value :
            value.FieldValue !== undefined ? value.FieldValue : JSON.stringify(value);

          return [label, Events.displayValue(actual)];
        }

        return [key, Events.displayValue(value)];
      });
    },

    displayValue: function (value) {
      if (value === null || value === undefined || value === '') return '-';
      if (typeof value === 'object') return JSON.stringify(value);
      if (value === true) return 'بله';
      if (value === false) return 'خیر';
      return String(value);
    },

    closeModal: function () {
      const details = document.getElementById('event-details-modal');
      if (details) details.remove();

      const form = document.getElementById('event-create-modal');
      if (form && !this.submitting) form.remove();

      this.modalOpen = false;
    },

    findById: function (items, id) {
      return items.find(function (item) {
        return Events.idOf(item) === String(id || '');
      }) || null;
    },

    idOf: function (item) {
      return String(item && (item.ID || item.Id || item.id) || '');
    },

    openForm: async function () {
      if (this.modalOpen) return;

      this.modalOpen = true;
      this.eventFields = [];

      const modal = document.createElement('div');
      modal.id = 'event-create-modal';
      modal.dir = 'rtl';

      modal.innerHTML =
        this.modalStyles() +
        '<div class="event-modal-panel">' +
          '<div class="event-modal-heading">' +
            '<h3>ثبت رویداد جدید</h3>' +
            '<button type="button" id="event-form-close" ' +
              'class="event-modal-close" aria-label="بستن">×</button>' +
          '</div>' +

          '<div id="event-form-error" class="event-modal-error" role="alert" hidden></div>' +

          '<form id="event-create-form">' +
            '<div class="event-dynamic-grid">' +

              '<div>' +
                '<label for="event-form-project">پروژه *</label>' +
                '<select id="event-form-project" name="ProjectID" required>' +
                  '<option value="">انتخاب پروژه</option>' +
                '</select>' +
              '</div>' +

              '<div>' +
                '<label for="event-form-type">نوع رویداد *</label>' +
                '<select id="event-form-type" name="EventTypeID" required>' +
                  '<option value="">انتخاب نوع رویداد</option>' +
                '</select>' +
              '</div>' +

              '<div>' +
                '<label for="event-form-date">تاریخ و زمان وقوع *</label>' +
                '<input id="event-form-date" name="OccurredAt" type="datetime-local" required>' +
              '</div>' +

              '<div style="grid-column:1/-1;">' +
                '<label for="event-form-description">شرح رویداد</label>' +
                '<textarea id="event-form-description" name="Description" rows="3"></textarea>' +
              '</div>' +

            '</div>' +

            '<div style="margin-top:24px;">' +
              '<h4 style="margin-bottom:12px;">اطلاعات اختصاصی رویداد</h4>' +
              '<div id="event-dynamic-fields" class="event-dynamic-grid">' +
                '<p class="event-muted">ابتدا نوع رویداد را انتخاب کنید.</p>' +
              '</div>' +
            '</div>' +

            '<div class="event-modal-actions">' +
              '<button type="submit" id="event-form-submit" ' +
                'class="event-modal-button event-modal-button-primary">' +
                'ثبت رویداد' +
              '</button>' +
              '<button type="button" id="event-form-cancel" class="event-modal-button">' +
                'انصراف' +
              '</button>' +
            '</div>' +

          '</form>' +
        '</div>';

      document.body.appendChild(modal);

      const projectSelect = document.getElementById('event-form-project');
      const typeSelect = document.getElementById('event-form-type');
      const dateInput = document.getElementById('event-form-date');

      this.projects.forEach(function (project) {
        const id = Events.idOf(project);
        if (!id) return;

        const option = document.createElement('option');
        option.value = id;
        option.textContent = project.ProjectCode || project.Title || project.Name || id;
        projectSelect.appendChild(option);
      });

      this.eventTypes.forEach(function (type) {
        const id = Events.idOf(type);
        if (!id || String(type.Status || 'ACTIVE').toUpperCase() !== 'ACTIVE') return;

        const option = document.createElement('option');
        option.value = id;
        option.textContent = type.Name || type.Code || id;
        typeSelect.appendChild(option);
      });

      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      dateInput.value = now.toISOString().slice(0, 16);

      document.getElementById('event-form-close').addEventListener(
        'click',
        () => this.closeForm()
      );

      document.getElementById('event-form-cancel').addEventListener(
        'click',
        () => this.closeForm()
      );

      typeSelect.addEventListener('change', () => this.loadDynamicFields(typeSelect.value));

      document.getElementById('event-create-form').addEventListener('submit', (event) => {
        event.preventDefault();
        this.submitForm();
      });

      modal.addEventListener('click', (event) => {
        if (event.target === modal && !this.submitting) this.closeForm();
      });
    },

    loadDynamicFields: async function (eventTypeId) {
      const container = document.getElementById('event-dynamic-fields');
      const modalError = document.getElementById('event-form-error');
      if (!container) return;

      container.innerHTML = '';
      this.eventFields = [];

      if (modalError) {
        modalError.hidden = true;
        modalError.textContent = '';
      }

      if (!eventTypeId) {
        container.innerHTML =
          '<p class="event-muted">ابتدا نوع رویداد را انتخاب کنید.</p>';
        return;
      }

      container.innerHTML = '<p class="event-muted">در حال دریافت فیلدها...</p>';

      try {
        const response = await window.PMS.Api.get(
          '/event-types/' + encodeURIComponent(eventTypeId) + '/fields'
        );

        const fields = this.normalize(
          window.PMS.Api.extractData(response)
        ).filter(function (field) {
          return String(field.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
        });

        this.eventFields = fields;
        this.renderDynamicFields(fields);
      } catch (error) {
        container.innerHTML = '';
        this.showFormError(
          'دریافت فیلدهای نوع رویداد ناموفق بود: ' + this.errorMessage(error)
        );
      }
    },

    renderDynamicFields: function (fields) {
      const container = document.getElementById('event-dynamic-fields');
      if (!container) return;

      if (!fields.length) {
        container.innerHTML =
          '<p class="event-muted">برای این نوع رویداد فیلد اختصاصی تعریف نشده است.</p>';
        return;
      }

      container.innerHTML = '';

      fields.sort(function (a, b) {
        return Number(a.FieldOrder || 0) - Number(b.FieldOrder || 0);
      });

      fields.forEach((field, index) => {
        const code = field.Code || '';
        const type = String(field.FieldType || 'text').toLowerCase();
        const required = Events.isRequired(field);
        const label = (field.Name || code) + (required ? ' *' : '');
        const wrapper = document.createElement('div');

        if (type === 'boolean') {
          wrapper.innerHTML =
            '<label style="display:flex;align-items:center;gap:8px;margin-top:8px;">' +
              '<input type="checkbox" data-dynamic-code="' + Events.escape(code) + '">' +
              Events.escape(label) +
            '</label>';
        } else {
          const labelElement = document.createElement('label');
          labelElement.textContent = label;

          const input = Events.createFieldInput(field, type);
          input.setAttribute('data-dynamic-code', code);

          if (required) input.required = true;

          if (
            field.DefaultValue !== null &&
            field.DefaultValue !== undefined &&
            String(field.DefaultValue) !== ''
          ) {
            if (input.type === 'checkbox') {
              input.checked = String(field.DefaultValue).toLowerCase() === 'true';
            } else {
              input.value = String(field.DefaultValue);
            }
          }

          labelElement.htmlFor = 'event-dynamic-' + index;
          input.id = 'event-dynamic-' + index;

          wrapper.appendChild(labelElement);
          wrapper.appendChild(input);
        }

        wrapper.style.minWidth = '0';

        Array.from(wrapper.querySelectorAll('input, select, textarea')).forEach(function (input) {
          input.style.display = input.type === 'checkbox' ? 'inline-block' : 'block';
          input.style.width = input.type === 'checkbox' ? 'auto' : '100%';
          input.style.padding = input.type === 'checkbox' ? '0' : '10px';
          input.style.marginTop = '6px';
          input.style.boxSizing = 'border-box';
        });

        container.appendChild(wrapper);
      });
    },

    createFieldInput: function (field, type) {
      let input;

      if (type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else if (type === 'select') {
        input = document.createElement('select');

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'انتخاب کنید';
        input.appendChild(placeholder);

        this.parseOptions(field.Options).forEach(function (item) {
          const option = document.createElement('option');
          option.value = item.value;
          option.textContent = item.label;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');

        const types = {
          text: 'text',
          number: 'number',
          date: 'date',
          datetime: 'datetime-local'
        };

        input.type = types[type] || 'text';

        if (type === 'number') input.step = 'any';
      }

      input.name = 'dynamic_' + (field.Code || '');
      return input;
    },

    parseOptions: function (value) {
      if (!value) return [];

      let options;

      try {
        options = JSON.parse(value);
      } catch (error) {
        options = String(value).split(',');
      }

      if (!Array.isArray(options)) return [];

      return options.map(function (item) {
        if (item && typeof item === 'object') {
          const optionValue = item.value !== undefined ? item.value : item.label;

          return {
            value: String(optionValue === undefined ? '' : optionValue).trim(),
            label: String(item.label !== undefined ? item.label : optionValue).trim()
          };
        }

        const text = String(item).trim();
        return { value: text, label: text };
      }).filter(function (item) {
        return item.value !== '';
      });
    },

    isRequired: function (field) {
      const value = field.IsRequired;
      return value === true ||
        String(value).toLowerCase() === 'true' ||
        String(value) === '1';
    },

    submitForm: async function () {
      if (this.submitting) return;

      const form = document.getElementById('event-create-form');
      if (!form || !form.reportValidity()) return;

      const projectId = document.getElementById('event-form-project').value;
      const typeId = document.getElementById('event-form-type').value;
      const occurredAt = document.getElementById('event-form-date').value;
      const description = document.getElementById('event-form-description').value.trim();
      const dynamicData = {};

      const inputs = form.querySelectorAll('[data-dynamic-code]');

      for (const input of inputs) {
        const code = input.getAttribute('data-dynamic-code');
        if (!code) continue;

        if (input.type === 'checkbox') {
          dynamicData[code] = input.checked;
        } else {
          const value = input.value;

          if (input.required && String(value).trim() === '') {
            input.reportValidity();
            return;
          }

          if (String(value).trim() !== '') {
            dynamicData[code] = input.type === 'number' ? Number(value) : value;
          }
        }
      }

      const type = this.findById(this.eventTypes, typeId);

      const payload = {
        ProjectID: projectId,
        EventTypeID: typeId,
        EventTypeVersion: type ? Number(type.Version || 1) : 1,
        OccurredAt: new Date(occurredAt).toISOString(),
        Description: description,
        DynamicData: dynamicData
      };

      this.submitting = true;
      this.setSubmitState(true);

      try {
        await window.PMS.Api.post('/events', payload);
        window.PMS.Api.invalidateMany([CACHE_KEY, PROJECTS_CACHE_KEY]);

        this.closeForm();
        await this.reloadEvents();
        alert('رویداد با موفقیت ثبت شد.');
      } catch (error) {
        this.showFormError('ثبت رویداد ناموفق بود: ' + this.errorMessage(error));
      } finally {
        this.submitting = false;
        this.setSubmitState(false);
      }
    },

    reloadEvents: async function () {
      const response = await window.PMS.Api.getFresh('/events', CACHE_KEY);
      this.events = this.normalize(response);
      this.applyFilters();
    },

    setSubmitState: function (busy) {
      const button = document.getElementById('event-form-submit');

      if (button) {
        button.disabled = busy;
        button.textContent = busy ? 'در حال ثبت...' : 'ثبت رویداد';
      }
    },

    showFormError: function (message) {
      const box = document.getElementById('event-form-error');

      if (!box) {
        alert(message);
        return;
      }

      box.textContent = message;
      box.hidden = false;
    },

    errorMessage: function (error) {
      return error && error.message ? error.message : 'خطای نامشخص';
    },

    closeForm: function () {
      if (this.submitting) return;

      const modal = document.getElementById('event-create-modal');
      if (modal) modal.remove();

      this.modalOpen = false;
      this.eventFields = [];
    },

    statusText: function (status) {
      const map = {
        ACTIVE: 'فعال',
        VOID: 'باطل‌شده',
        INACTIVE: 'غیرفعال'
      };

      return map[status] || status || '-';
    },

    formatDate: function (value) {
      if (!value) return '-';

      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleString('fa-IR');
      } catch (error) {
        return String(value);
      }
    },

    showError: function (error) {
      const errorBox = document.getElementById('events-error');
      if (!errorBox) return;

      errorBox.textContent = error && error.message
        ? error.message
        : 'خطا در دریافت رویدادها.';

      errorBox.hidden = false;
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

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};
  window.PMS.Events = Events;
  window.PMS.Modules.Events = Events;
})();
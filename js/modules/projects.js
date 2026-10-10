(function () {
  'use strict';

  const CACHE_KEY = window.PMS.Cache.keys.PROJECTS;

  const Projects = {
    projects: [],
    workflows: [],
    modal: null,
    isSaving: false,

    init: function () {
      this.bindEvents();
      this.loadProjects();
    },

    bindEvents: function () {
      const statusFilter = document.getElementById('project-status-filter');
      const searchInput = document.getElementById('project-search');
      const createButton = document.getElementById('project-create-button');

      if (statusFilter) {
        statusFilter.addEventListener('change', () => {
          this.applyFilters();
        });
      }

      if (searchInput) {
        searchInput.addEventListener('input', () => {
          this.applyFilters();
        });
      }

      if (createButton) {
        createButton.addEventListener('click', () => {
          this.openCreateForm();
        });
      }
    },

    // ========================================================
    // بارگذاری پروژه‌ها
    // ========================================================

    loadProjects: async function () {
      const loading = document.getElementById('projects-loading');

      const cached = window.PMS.Cache.get(CACHE_KEY);

      if (cached !== null) {
        this.projects = this.normalizeProjects(cached);
        this.applyFilters();

        if (loading) {
          loading.hidden = true;
        }
      } else if (loading) {
        loading.hidden = false;
      }

      try {
        const result = await window.PMS.Api.getCached(
          '/projects',
          CACHE_KEY,
          {
            onRefresh: (data) => {
              this.projects = this.normalizeProjects(data);
              this.applyFilters();
            },

            onError: (error, isBackground) => {
              if (!isBackground) {
                this.showError(error);
              }
            }
          }
        );

        if (result && result.cached === false) {
          this.projects = this.normalizeProjects(result.data);
          this.applyFilters();
        }

        if (loading) {
          loading.hidden = true;
        }
      } catch (error) {
        if (loading) {
          loading.hidden = true;
        }

        if (cached === null) {
          this.showError(error);
        }
      }
    },

    normalizeProjects: function (data) {
      if (Array.isArray(data)) {
        return data;
      }

      if (data && Array.isArray(data.projects)) {
        return data.projects;
      }

      if (data && Array.isArray(data.items)) {
        return data.items;
      }

      if (data && data.data) {
        return this.normalizeProjects(data.data);
      }

      return [];
    },

    // ========================================================
    // فرم ایجاد پروژه
    // ========================================================

    openCreateForm: async function () {
      if (this.modal) {
        this.modal.remove();
      }

      const modal = document.createElement('div');

      modal.id = 'project-create-modal';

      modal.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9999',
        'background:rgba(0,0,0,0.45)',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:16px',
        'overflow-y:auto'
      ].join(';');

      modal.innerHTML = `
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-create-title"
          style="
            background:#fff;
            width:100%;
            max-width:560px;
            max-height:90vh;
            overflow-y:auto;
            border-radius:10px;
            padding:24px;
            box-sizing:border-box;
            direction:rtl;
            color:#222;
          "
        >
          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            margin-bottom:20px;
          ">
            <h3 id="project-create-title" style="margin:0;">
              ایجاد پروژه جدید
            </h3>

            <button
              type="button"
              id="project-create-close"
              class="btn btn-light"
              aria-label="بستن"
            >✕</button>
          </div>

          <div
            id="project-create-error"
            class="alert alert-danger"
            hidden
            style="margin-bottom:16px;"
          ></div>

          <form id="project-create-form">
            <div class="filter-group" style="margin-bottom:16px;">
              <label for="new-project-code">
                کد پروژه <span style="color:#c00;">*</span>
              </label>

              <input
                type="text"
                id="new-project-code"
                name="ProjectCode"
                required
                maxlength="100"
                autocomplete="off"
                placeholder="مثلاً PRJ-001"
                style="width:100%;box-sizing:border-box;"
              >
            </div>

            <div class="filter-group" style="margin-bottom:16px;">
              <label for="new-project-title">
                عنوان پروژه <span style="color:#c00;">*</span>
              </label>

              <input
                type="text"
                id="new-project-title"
                name="Title"
                required
                maxlength="200"
                autocomplete="off"
                placeholder="عنوان پروژه تولید"
                style="width:100%;box-sizing:border-box;"
              >
            </div>

            <div class="filter-group" style="margin-bottom:16px;">
              <label for="new-project-workflow">
                گردش کار <span style="color:#c00;">*</span>
              </label>

              <select
                id="new-project-workflow"
                name="WorkflowID"
                required
                style="width:100%;box-sizing:border-box;"
              >
                <option value="">در حال دریافت گردش کارها...</option>
              </select>

              <small style="display:block;margin-top:6px;color:#666;">
                پروژه از اولین مرحله گردش کار انتخاب‌شده شروع می‌شود.
              </small>
            </div>

            <div class="filter-group" style="margin-bottom:20px;">
              <label for="new-project-description">
                توضیحات
              </label>

              <textarea
                id="new-project-description"
                name="Description"
                rows="3"
                placeholder="توضیحات اختیاری درباره پروژه"
                style="width:100%;box-sizing:border-box;resize:vertical;"
              ></textarea>
            </div>

            <div style="
              display:flex;
              justify-content:flex-start;
              gap:10px;
              flex-wrap:wrap;
            ">
              <button
                type="submit"
                id="project-create-submit"
                class="btn btn-primary"
              >
                ثبت پروژه
              </button>

              <button
                type="button"
                id="project-create-cancel"
                class="btn btn-light"
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(modal);
      this.modal = modal;

      const closeButton = modal.querySelector('#project-create-close');
      const cancelButton = modal.querySelector('#project-create-cancel');
      const form = modal.querySelector('#project-create-form');
      const workflowSelect = modal.querySelector('#new-project-workflow');

      const closeModal = () => {
        if (this.isSaving) {
          return;
        }

        modal.remove();

        if (this.modal === modal) {
          this.modal = null;
        }
      };

      closeButton.addEventListener('click', closeModal);
      cancelButton.addEventListener('click', closeModal);

      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeModal();
        }
      });

      const escapeHandler = (event) => {
        if (event.key === 'Escape' && this.modal === modal) {
          closeModal();
        }
      };

      document.addEventListener('keydown', escapeHandler);

      const originalRemove = modal.remove.bind(modal);

      modal.remove = () => {
        document.removeEventListener('keydown', escapeHandler);
        originalRemove();
      };

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.createProject(modal);
      });

      try {
        const response = await window.PMS.Api.get('/workflows');
        const workflows = this.normalizeWorkflows(response);

        if (this.modal !== modal) {
          return;
        }

        this.workflows = workflows;

        if (workflows.length === 0) {
          workflowSelect.innerHTML =
            '<option value="">گردش کار فعالی پیدا نشد</option>';

          this.showFormError(
            modal,
            'برای ایجاد پروژه، ابتدا باید یک گردش کار دارای مرحله ایجاد کنید.'
          );

          return;
        }

        workflowSelect.innerHTML =
          '<option value="">انتخاب گردش کار</option>' +
          workflows.map((workflow) => {
            const id = workflow.ID || workflow.Id || workflow.id;
            const name =
              workflow.Name ||
              workflow.Title ||
              workflow.WorkflowName ||
              workflow.Code ||
              id;

            return `
              <option value="${this.escape(id)}">
                ${this.escape(name)}
              </option>
            `;
          }).join('');

      } catch (error) {
        workflowSelect.innerHTML =
          '<option value="">خطا در دریافت گردش کارها</option>';

        this.showFormError(
          modal,
          'دریافت گردش کارها ناموفق بود. فرم را ببند و دوباره تلاش کن. ' +
          this.getErrorMessage(error)
        );
      }

      const codeInput = modal.querySelector('#new-project-code');

      if (codeInput) {
        codeInput.focus();
      }
    },

    normalizeWorkflows: function (response) {
      let data = response;

      if (data && data.success === true && data.data !== undefined) {
        data = data.data;
      }

      if (data && data.data !== undefined) {
        data = data.data;
      }

      if (Array.isArray(data)) {
        return data.filter((workflow) => {
          return String(workflow.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
        });
      }

      if (data && Array.isArray(data.workflows)) {
        return this.normalizeWorkflows(data.workflows);
      }

      if (data && Array.isArray(data.items)) {
        return this.normalizeWorkflows(data.items);
      }

      return [];
    },

    // ========================================================
    // ثبت پروژه
    // ========================================================

    createProject: async function (modal) {
      if (this.isSaving) {
        return;
      }

      const codeInput = modal.querySelector('#new-project-code');
      const titleInput = modal.querySelector('#new-project-title');
      const workflowSelect = modal.querySelector('#new-project-workflow');
      const descriptionInput = modal.querySelector('#new-project-description');
      const submitButton = modal.querySelector('#project-create-submit');

      const project = {
        ProjectCode: codeInput.value.trim(),
        Title: titleInput.value.trim(),
        WorkflowID: workflowSelect.value,
        Description: descriptionInput.value.trim()
      };

      if (!project.ProjectCode) {
        this.showFormError(modal, 'کد پروژه را وارد کن.');
        codeInput.focus();
        return;
      }

      if (!project.Title) {
        this.showFormError(modal, 'عنوان پروژه را وارد کن.');
        titleInput.focus();
        return;
      }

      if (!project.WorkflowID) {
        this.showFormError(modal, 'یک گردش کار انتخاب کن.');
        workflowSelect.focus();
        return;
      }

      this.isSaving = true;
      submitButton.disabled = true;
      submitButton.textContent = 'در حال ثبت...';

      this.clearFormError(modal);

      try {
        const response = await window.PMS.Api.post('/projects', project);

        const created = this.extractCreatedProject(response);

        if (!created || !(created.ID || created.Id || created.id)) {
          throw new Error(
            this.getErrorMessage(response) ||
            'پاسخ سرور برای ثبت پروژه معتبر نیست.'
          );
        }

        const createdId = String(created.ID || created.Id || created.id);

        const exists = this.projects.some((item) => {
          return String(item.ID || item.Id || item.id) === createdId;
        });

        if (!exists) {
          this.projects.unshift(created);
        }

        // فهرست فعلی را بلافاصله به‌روز می‌کنیم.
        this.applyFilters();

        modal.remove();

        if (this.modal === modal) {
          this.modal = null;
        }

        alert('پروژه با موفقیت ثبت شد.');

        // دریافت دوباره فهرست از سرور برای هماهنگ‌شدن اطلاعات.
        this.loadProjects();

      } catch (error) {
        this.showFormError(
          modal,
          this.getErrorMessage(error) || 'ثبت پروژه ناموفق بود.'
        );
      } finally {
        this.isSaving = false;

        if (submitButton.isConnected) {
          submitButton.disabled = false;
          submitButton.textContent = 'ثبت پروژه';
        }
      }
    },

    extractCreatedProject: function (response) {
      if (!response) {
        return null;
      }

      if (response.success === false) {
        throw new Error(this.getErrorMessage(response));
      }

      let data = response;

      if (data.data !== undefined) {
        data = data.data;
      }

      if (data && data.data !== undefined) {
        data = data.data;
      }

      if (data && (data.ID || data.Id || data.id)) {
        return data;
      }

      return null;
    },

    showFormError: function (modal, message) {
      const errorBox = modal.querySelector('#project-create-error');

      if (!errorBox) {
        return;
      }

      errorBox.textContent = message;
      errorBox.hidden = false;
    },

    clearFormError: function (modal) {
      const errorBox = modal.querySelector('#project-create-error');

      if (errorBox) {
        errorBox.textContent = '';
        errorBox.hidden = true;
      }
    },

    getErrorMessage: function (error) {
      if (!error) {
        return '';
      }

      if (typeof error === 'string') {
        return error;
      }

      if (error.message) {
        return error.message;
      }

      if (error.error && error.error.message) {
        return error.error.message;
      }

      if (error.data && error.data.message) {
        return error.data.message;
      }

      if (error.messageText) {
        return error.messageText;
      }

      return '';
    },

    // ========================================================
    // فیلتر پروژه‌ها
    // ========================================================

    applyFilters: function () {
      const statusFilter = document.getElementById('project-status-filter');
      const searchInput = document.getElementById('project-search');

      const status = statusFilter ? statusFilter.value : '';
      const search = searchInput
        ? searchInput.value.trim().toLowerCase()
        : '';

      const filtered = (this.projects || []).filter((project) => {
        if (status && String(project.Status || '') !== status) {
          return false;
        }

        if (search) {
          const code = String(project.ProjectCode || '').toLowerCase();
          const title = String(project.Title || '').toLowerCase();

          if (
            code.indexOf(search) === -1 &&
            title.indexOf(search) === -1
          ) {
            return false;
          }
        }

        return true;
      });

      this.render(filtered);
    },

    // ========================================================
    // نمایش جدول پروژه‌ها
    // ========================================================

    render: function (projects) {
      const container = document.getElementById('projects-table-container');
      const empty = document.getElementById('projects-empty');

      if (!container) {
        return;
      }

      if (!projects || projects.length === 0) {
        container.innerHTML = '';
        container.hidden = true;

        if (empty) {
          empty.hidden = false;
        }

        return;
      }

      if (empty) {
        empty.hidden = true;
      }

      let html = `
        <table class="data-table">
          <thead>
            <tr>
              <th>کد پروژه</th>
              <th>عنوان</th>
              <th>وضعیت</th>
              <th>مرحله فعلی</th>
              <th>آخرین بروزرسانی</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
      `;

      projects.forEach((project) => {
        const id = project.ID || project.Id || project.id || '';

        html += `
          <tr>
            <td>${this.escape(project.ProjectCode)}</td>
            <td>${this.escape(project.Title)}</td>
            <td>
              <span class="status-badge">
                ${this.escape(this.statusText(project.Status))}
              </span>
            </td>
            <td>${this.escape(project.CurrentStepID || '-')}</td>
            <td>${this.escape(this.formatDate(project.UpdatedAt))}</td>
            <td>
              <button
                type="button"
                class="btn btn-sm btn-light project-view-button"
                data-project-id="${this.escape(id)}"
              >
                مشاهده
              </button>
            </td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;

      container.innerHTML = html;
      container.hidden = false;

      container.querySelectorAll('.project-view-button').forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.getAttribute('data-project-id');

          if (!id) {
            return;
          }

          window.location.hash =
            '#project-detail/' + encodeURIComponent(id);
        });
      });
    },

    // ========================================================
    // وضعیت پروژه
    // ========================================================

    statusText: function (status) {
      const map = {
        ACTIVE: 'فعال',
        INACTIVE: 'غیرفعال',
        ON_HOLD: 'متوقف',
        COMPLETED: 'تکمیل‌شده',
        CANCELLED: 'لغوشده',
        VOID: 'باطل‌شده',
        DELETED: 'حذف‌شده'
      };

      return map[status] || status || '-';
    },

    // ========================================================
    // تاریخ
    // ========================================================

    formatDate: function (value) {
      if (!value) {
        return '-';
      }

      try {
        const date = new Date(value);

        if (isNaN(date.getTime())) {
          return String(value);
        }

        return date.toLocaleString('fa-IR');
      } catch (error) {
        return String(value);
      }
    },

    // ========================================================
    // نمایش خطا
    // ========================================================

    showError: function (error) {
      const errorBox = document.getElementById('projects-error');

      if (!errorBox) {
        return;
      }

      errorBox.textContent =
        this.getErrorMessage(error) || 'خطا در دریافت پروژه‌ها.';

      errorBox.hidden = false;
    },

    // ========================================================
    // جلوگیری از ورود HTML ناخواسته
    // ========================================================

    escape: function (value) {
      if (value === null || value === undefined) {
        return '';
      }

      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };

  // ==========================================================
  // ثبت ماژول در فضای عمومی برنامه
  // ==========================================================

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  window.PMS.Projects = Projects;
  window.PMS.Modules.Projects = Projects;

})();
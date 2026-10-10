
(function () {
  'use strict';

  const PMS = window.PMS = window.PMS || {};

  const CACHE_KEY =
    PMS.Cache && PMS.Cache.keys
      ? PMS.Cache.keys.WORKFLOWS
      : 'workflows';

  const STEP_CACHE_PREFIX =
    PMS.Cache && PMS.Cache.keys
      ? PMS.Cache.keys.WORKFLOW_STEPS
      : 'workflow_steps';

  const state = {
    workflows: [],
    search: '',
    loading: false,
    saving: false,
    loadRequestId: 0,
    stepRequestId: 0
  };

  function init() {
    bindEvents();
    loadWorkflows();
  }

  function bindEvents() {
    const search = document.getElementById('workflow-search');
    const createButton = document.getElementById('workflow-create-button');

    if (search && !search.dataset.workflowBound) {
      search.dataset.workflowBound = 'true';
      state.search = search.value.trim().toLowerCase();

      search.addEventListener('input', function () {
        state.search = this.value.trim().toLowerCase();
        render();
      });
    }

    if (createButton && !createButton.dataset.workflowBound) {
      createButton.dataset.workflowBound = 'true';
      createButton.addEventListener('click', showCreateWorkflowModal);
    }
  }

  // ------------------------------------------
  // بارگذاری فهرست با کش و به‌روزرسانی پس‌زمینه
  // ------------------------------------------

  async function loadWorkflows() {
    const requestId = ++state.loadRequestId;

    state.loading = true;
    setVisible('workflows-loading', true);
    setVisible('workflows-error', false);

    try {
      const result = await PMS.Api.getCached(
        '/workflows',
        CACHE_KEY,
        {
          onRefresh: function (data) {
            if (requestId !== state.loadRequestId) return;

            state.workflows = normalizeWorkflows(data);
            render();
            setVisible('workflows-loading', false);
          },

          onError: function (error) {
            if (requestId !== state.loadRequestId) return;

            showError(
              error.message || 'به‌روزرسانی فهرست فرآیندها ناموفق بود.'
            );
            setVisible('workflows-loading', false);
          }
        }
      );

      if (requestId !== state.loadRequestId) return;

      state.workflows = normalizeWorkflows(result.data);
      render();

      if (!result.refreshing) {
        setVisible('workflows-loading', false);
      }
    } catch (error) {
      if (requestId !== state.loadRequestId) return;

      showError(error.message || 'دریافت فرآیندها ناموفق بود.');
      setVisible('workflows-loading', false);
    } finally {
      if (requestId === state.loadRequestId) {
        state.loading = false;
      }
    }
  }

  function normalizeWorkflows(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.workflows)) return data.workflows;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  }

  function normalizeSteps(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.steps)) return data.steps;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  }

  function getValue(item, upper, lower) {
    return item && (item[upper] != null ? item[upper] : item[lower]);
  }

  function getId(item) {
    return String(getValue(item, 'ID', 'id') || '');
  }

  function getName(item) {
    return getValue(item, 'Name', 'name') || 'بدون نام';
  }

  function getCode(item) {
    return getValue(item, 'Code', 'code') || '-';
  }

  function getStatus(item) {
    return getValue(item, 'Status', 'status') || '';
  }

  // ------------------------------------------
  // نمایش صفحه
  // ------------------------------------------

  function render() {
    const container = document.getElementById(
      'workflows-table-container'
    );
    const empty = document.getElementById('workflows-empty');

    if (!container) return;

    const filtered = state.workflows.filter(function (workflow) {
      const text = [
        getId(workflow),
        getName(workflow),
        getCode(workflow),
        getStatus(workflow),
        getValue(workflow, 'Version', 'version')
      ].join(' ').toLowerCase();

      return text.includes(state.search);
    });

    if (!filtered.length) {
      container.innerHTML = '';
      container.hidden = true;

      if (empty) {
        empty.hidden = false;
        empty.textContent = state.search
          ? 'فرآیندی مطابق عبارت جستجو پیدا نشد.'
          : 'هنوز فرآیندی ثبت نشده است. برای شروع، یک فرآیند جدید بساز.';
      }

      return;
    }

    if (empty) empty.hidden = true;
    container.hidden = false;

    container.innerHTML = `
      <div class="workflow-list-heading"
           style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div>
          <h3 style="margin:0 0 5px">فرآیندهای تولید</h3>
          <div style="color:var(--text-muted,#64748b);font-size:13px">
            هر فرآیند مسیر و ترتیب مراحل تولید را مشخص می‌کند.
          </div>
        </div>
        <span class="workflow-count"
              style="font-size:13px;color:var(--text-muted,#64748b)">
          ${filtered.length} فرآیند
        </span>
      </div>

      <div class="workflow-card-list"
           style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:16px">
        ${filtered.map(renderWorkflowCard).join('')}
      </div>
    `;

    container.querySelectorAll('[data-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = this.dataset.id;
        const workflow = state.workflows.find(function (item) {
          return getId(item) === String(id);
        });

        if (!workflow) {
          showMessage('فرآیند موردنظر پیدا نشد.', 'danger');
          return;
        }

        if (this.dataset.action === 'view-steps') {
          loadWorkflowSteps(workflow);
        } else if (this.dataset.action === 'add-step') {
          showCreateStepModal(workflow);
        }
      });
    });
  }

  function renderWorkflowCard(workflow) {
    const id = getId(workflow);
    const name = getName(workflow);
    const code = getCode(workflow);
    const version = getValue(workflow, 'Version', 'version') || '1';

    return `
      <article class="workflow-card card"
               style="margin:0;min-width:0;overflow:hidden">
        <div class="card-body" style="padding:18px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
            <div style="min-width:0">
              <div style="font-size:11px;color:var(--text-muted,#64748b);margin-bottom:6px">
                فرآیند تولید
              </div>
              <h4 style="margin:0 0 10px;overflow-wrap:anywhere;font-size:17px">
                ${escapeHtml(name)}
              </h4>
            </div>
            <div style="flex-shrink:0">
              ${renderStatus(getStatus(workflow))}
            </div>
          </div>

          <div style="border-top:1px solid var(--border-color,#e2e8f0);padding-top:12px;margin-top:12px">
            <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px">
              <div>
                <div style="font-size:12px;color:var(--text-muted,#64748b);margin-bottom:4px">
                  کد فرآیند
                </div>
                <div style="font-size:13px;overflow-wrap:anywhere">
                  ${escapeHtml(code)}
                </div>
              </div>
              <div>
                <div style="font-size:12px;color:var(--text-muted,#64748b);margin-bottom:4px">
                  نسخه
                </div>
                <div style="font-size:13px">
                  ${escapeHtml(version)}
                </div>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
            <button type="button"
                    class="btn btn-primary btn-sm"
                    data-action="view-steps"
                    data-id="${escapeAttribute(id)}">
              مشاهده مراحل
            </button>
            <button type="button"
                    class="btn btn-light btn-sm"
                    data-action="add-step"
                    data-id="${escapeAttribute(id)}">
              + افزودن مرحله
            </button>
          </div>
        </div>
      </article>
    `;
  }

  // ------------------------------------------
  // ایجاد فرآیند
  // ------------------------------------------

  function showCreateWorkflowModal() {
    openModal({
      title: 'ایجاد فرآیند جدید',
      content: `
        <div style="margin-bottom:18px;color:var(--text-muted,#64748b);font-size:13px">
          ابتدا مشخصات فرآیند را ثبت کن. سپس می‌توانی مراحل تولید را به ترتیب اضافه کنی.
        </div>

        <form id="workflow-create-form">
          <div class="form-group">
            <label for="workflow-name">نام فرآیند <span aria-hidden="true">*</span></label>
            <input class="form-control"
                   id="workflow-name"
                   name="Name"
                   type="text"
                   maxlength="150"
                   required
                   placeholder="مثلاً فرآیند تولید لباس">
          </div>

          <div class="form-group">
            <label for="workflow-code">کد فرآیند <span aria-hidden="true">*</span></label>
            <input class="form-control"
                   id="workflow-code"
                   name="Code"
                   type="text"
                   maxlength="80"
                   required
                   placeholder="مثلاً GARMENT_PRODUCTION">
            <small style="display:block;margin-top:5px;color:var(--text-muted,#64748b)">
              کدی کوتاه و قابل‌شناسایی وارد کن.
            </small>
          </div>

          <div id="workflow-form-message" class="alert" hidden></div>

          <div class="modal-footer"
               style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">
            <button type="submit" class="btn btn-primary">ثبت فرآیند</button>
            <button type="button" class="btn btn-light" data-close-modal>انصراف</button>
          </div>
        </form>
      `,
      onReady: function (overlay) {
        const form = overlay.querySelector('#workflow-create-form');

        form.addEventListener('submit', async function (event) {
          event.preventDefault();
          if (state.saving) return;

          const name = form.elements.Name.value.trim();
          const code = form.elements.Code.value.trim();

          if (!name || !code) {
            showFormMessage(
              overlay,
              '#workflow-form-message',
              'نام و کد فرآیند را وارد کن.',
              'danger'
            );
            return;
          }

          state.saving = true;
          const submit = form.querySelector('[type="submit"]');
          submit.disabled = true;
          submit.textContent = 'در حال ثبت...';

          try {
            await PMS.Api.post('/workflows', {
              Name: name,
              Code: code
            });

            invalidateCache(CACHE_KEY);
            closeModal(overlay);
            showMessage('فرآیند با موفقیت ثبت شد.', 'success');
            await loadWorkflows();
          } catch (error) {
            showFormMessage(
              overlay,
              '#workflow-form-message',
              error.message || 'ثبت فرآیند ناموفق بود.',
              'danger'
            );
          } finally {
            state.saving = false;

            if (submit.isConnected) {
              submit.disabled = false;
              submit.textContent = 'ثبت فرآیند';
            }
          }
        });
      }
    });
  }

  // ------------------------------------------
  // افزودن مرحله به فرآیند
  // ------------------------------------------

  function showCreateStepModal(workflow) {
    openModal({
      title: 'افزودن مرحله جدید',
      content: `
        <div class="card"
             style="margin-bottom:18px;background:var(--surface-muted,#f8fafc)">
          <div class="card-body" style="padding:14px">
            <div style="font-size:12px;color:var(--text-muted,#64748b);margin-bottom:5px">
              فرآیند انتخاب‌شده
            </div>
            <div style="font-weight:600;overflow-wrap:anywhere">
              ${escapeHtml(getName(workflow))}
            </div>
            <div style="font-size:12px;color:var(--text-muted,#64748b);margin-top:5px">
              کد: ${escapeHtml(getCode(workflow))}
            </div>
          </div>
        </div>

        <p style="font-size:13px;color:var(--text-muted,#64748b);margin-bottom:18px">
          نام و کد مرحله را وارد کن. ترتیب مراحل مطابق تنظیمات ثبت‌شده در سیستم نمایش داده می‌شود.
        </p>

        <form id="workflow-step-form">
          <div class="form-group">
            <label for="step-name">نام مرحله <span aria-hidden="true">*</span></label>
            <input class="form-control"
                   id="step-name"
                   name="Name"
                   type="text"
                   maxlength="150"
                   required
                   placeholder="مثلاً برش پارچه">
          </div>

          <div class="form-group">
            <label for="step-code">کد مرحله <span aria-hidden="true">*</span></label>
            <input class="form-control"
                   id="step-code"
                   name="Code"
                   type="text"
                   maxlength="80"
                   required
                   placeholder="مثلاً CUTTING">
          </div>

          <div id="step-form-message" class="alert" hidden></div>

          <div class="modal-footer"
               style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">
            <button type="submit" class="btn btn-primary">ثبت مرحله</button>
            <button type="button" class="btn btn-light" data-close-modal>انصراف</button>
          </div>
        </form>
      `,
      onReady: function (overlay) {
        const form = overlay.querySelector('#workflow-step-form');

        form.addEventListener('submit', async function (event) {
          event.preventDefault();
          if (state.saving) return;

          const name = form.elements.Name.value.trim();
          const code = form.elements.Code.value.trim();

          if (!name || !code) {
            showFormMessage(
              overlay,
              '#step-form-message',
              'نام و کد مرحله را وارد کن.',
              'danger'
            );
            return;
          }

          state.saving = true;
          const submit = form.querySelector('[type="submit"]');
          submit.disabled = true;
          submit.textContent = 'در حال ثبت...';

          try {
            await PMS.Api.post(
              '/workflows/' + encodeURIComponent(getId(workflow)) + '/steps',
              {
                Name: name,
                Code: code
              }
            );

            invalidateCache(getStepCacheKey(getId(workflow)));
            closeModal(overlay);
            showMessage('مرحله با موفقیت اضافه شد.', 'success');
            await loadWorkflowSteps(workflow);
          } catch (error) {
            showFormMessage(
              overlay,
              '#step-form-message',
              error.message || 'افزودن مرحله ناموفق بود.',
              'danger'
            );
          } finally {
            state.saving = false;

            if (submit.isConnected) {
              submit.disabled = false;
              submit.textContent = 'ثبت مرحله';
            }
          }
        });
      }
    });
  }

  // ------------------------------------------
  // مشاهده مراحل؛ کش اول، سرور در پس‌زمینه
  // ------------------------------------------

  async function loadWorkflowSteps(workflow) {
    const requestId = ++state.stepRequestId;
    const workflowId = getId(workflow);
    const cacheKey = getStepCacheKey(workflowId);

    try {
      const result = await PMS.Api.getCached(
        '/workflows/' + encodeURIComponent(workflowId) + '/steps',
        cacheKey,
        {
          onRefresh: function (data) {
            if (requestId !== state.stepRequestId) return;
            showWorkflowSteps(workflow, normalizeSteps(data));
          },

          onError: function (error) {
            if (requestId !== state.stepRequestId) return;
            showMessage(
              error.message || 'به‌روزرسانی مراحل ناموفق بود.',
              'danger'
            );
          }
        }
      );

      if (requestId !== state.stepRequestId) return;

      showWorkflowSteps(workflow, normalizeSteps(result.data));
    } catch (error) {
      if (requestId !== state.stepRequestId) return;

      showMessage(
        error.message || 'دریافت مراحل فرآیند ناموفق بود.',
        'danger'
      );
    }
  }

  function showWorkflowSteps(workflow, steps) {
    const sortedSteps = steps.slice().sort(function (a, b) {
      return Number(
        getValue(a, 'StepOrder', 'stepOrder') || 0
      ) - Number(
        getValue(b, 'StepOrder', 'stepOrder') || 0
      );
    });

    const rows = sortedSteps.map(function (step, index) {
      const order = getValue(step, 'StepOrder', 'stepOrder') || index + 1;

      return `
        <tr>
          <td style="width:70px;text-align:center">
            <span style="display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;border-radius:50%;background:var(--surface-muted,#f1f5f9)">
              ${escapeHtml(order)}
            </span>
          </td>
          <td>${escapeHtml(getName(step))}</td>
          <td>${escapeHtml(getCode(step))}</td>
          <td>${renderStatus(getStatus(step))}</td>
        </tr>
      `;
    }).join('');

    openModal({
      title: 'مراحل فرآیند',
      content: `
        <div class="card"
             style="margin-bottom:18px;background:var(--surface-muted,#f8fafc)">
          <div class="card-body" style="padding:14px">
            <div style="font-size:12px;color:var(--text-muted,#64748b);margin-bottom:5px">
              فرآیند انتخاب‌شده
            </div>
            <div style="font-weight:600;overflow-wrap:anywhere">
              ${escapeHtml(getName(workflow))}
            </div>
            <div style="font-size:12px;color:var(--text-muted,#64748b);margin-top:5px">
              کد: ${escapeHtml(getCode(workflow))}
              <span style="margin-inline-start:10px">تعداد مراحل: ${sortedSteps.length}</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom:12px">
          <h4 style="margin:0 0 5px">ترتیب مراحل تولید</h4>
          <p style="font-size:13px;color:var(--text-muted,#64748b);margin:0">
            مراحل ثبت‌شده برای این فرآیند در جدول زیر نمایش داده می‌شوند.
          </p>
        </div>

        ${sortedSteps.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ترتیب</th>
                  <th>نام مرحله</th>
                  <th>کد مرحله</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        ` : `
          <div class="table-empty" style="padding:24px;text-align:center">
            <div style="font-size:15px;font-weight:600;margin-bottom:8px">
              هنوز مرحله‌ای ثبت نشده است
            </div>
            <div style="font-size:13px;color:var(--text-muted,#64748b);margin-bottom:16px">
              برای تعریف مسیر تولید، اولین مرحله را اضافه کن.
            </div>
          </div>
        `}

        <div class="modal-footer"
             style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">
          <button type="button" class="btn btn-primary" id="steps-add-button">
            + افزودن مرحله
          </button>
          <button type="button" class="btn btn-light" data-close-modal>
            بستن
          </button>
        </div>
      `,
      onReady: function (overlay) {
        overlay.querySelector('#steps-add-button').addEventListener(
          'click',
          function () {
            closeModal(overlay);
            showCreateStepModal(workflow);
          }
        );
      }
    });
  }

  // ------------------------------------------
  // پنجره‌های محاوره‌ای
  // ------------------------------------------

  function openModal(config) {
    const oldModal = document.querySelector('.workflow-modal-overlay');

    if (oldModal) closeModal(oldModal);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay workflow-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.style.maxWidth = '760px';
    modal.style.width = 'calc(100% - 24px)';
    modal.style.maxHeight = '90vh';
    modal.style.overflowY = 'auto';

    modal.innerHTML = `
      <div class="modal-header"
           style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <h3 style="margin:0;font-size:18px">
          ${escapeHtml(config.title)}
        </h3>
        <button type="button"
                class="btn btn-light btn-sm"
                data-close-modal
                aria-label="بستن پنجره">✕</button>
      </div>
      <div class="modal-body">${config.content}</div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    overlay.addEventListener('click', function (event) {
      if (
        event.target === overlay ||
        (event.target.closest &&
          event.target.closest('[data-close-modal]'))
      ) {
        closeModal(overlay);
      }
    });

    if (typeof config.onReady === 'function') {
      config.onReady(overlay);
    }

    const firstInput = modal.querySelector('input');
    if (firstInput) firstInput.focus();

    return overlay;
  }

  function closeModal(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    if (!document.querySelector('.modal-overlay')) {
      document.body.classList.remove('modal-open');
    }
  }

  // ------------------------------------------
  // پیام‌ها و ابزارهای کمکی
  // ------------------------------------------

  function showFormMessage(overlay, selector, message, type) {
    const element = overlay.querySelector(selector);
    if (!element) return;

    element.className = 'alert alert-' + type;
    element.textContent = message;
    element.hidden = false;
  }

  function showMessage(message, type) {
    const old = document.getElementById('workflow-global-message');
    if (old) old.remove();

    const element = document.createElement('div');
    element.id = 'workflow-global-message';
    element.className = 'alert alert-' + type;
    element.textContent = message;
    element.style.marginBottom = '16px';

    const page = document.querySelector('.page-section');

    if (page) {
      page.insertBefore(element, page.firstChild);
    } else {
      document.body.appendChild(element);
    }

    window.setTimeout(function () {
      if (element.isConnected) element.remove();
    }, 5000);
  }

  function showError(message) {
    const element = document.getElementById('workflows-error');

    if (element) {
      element.textContent = message;
      element.hidden = false;
    } else {
      showMessage(message, 'danger');
    }
  }

  function setVisible(id, visible) {
    const element = document.getElementById(id);
    if (element) element.hidden = !visible;
  }

  function invalidateCache(key) {
    if (PMS.Api && typeof PMS.Api.invalidate === 'function') {
      PMS.Api.invalidate(key);
    } else if (PMS.Cache && typeof PMS.Cache.remove === 'function') {
      PMS.Cache.remove(key);
    }
  }

  function getStepCacheKey(workflowId) {
    return STEP_CACHE_PREFIX + '_' + workflowId;
  }

  function renderStatus(status) {
    const value = String(status || '').toUpperCase();

    if (value === 'ACTIVE' || value === 'فعال') {
      return '<span class="alert alert-success" style="display:inline-block;padding:3px 8px;margin:0">فعال</span>';
    }

    if (value === 'INACTIVE' || value === 'غیرفعال') {
      return '<span class="alert alert-warning" style="display:inline-block;padding:3px 8px;margin:0">غیرفعال</span>';
    }

    if (!value) {
      return '<span style="color:var(--text-muted,#64748b)">-</span>';
    }

    return escapeHtml(status);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  // ------------------------------------------
  // ماژول عمومی
  // ------------------------------------------

  PMS.Workflows = {
    init: init,
    loadWorkflows: loadWorkflows,
    render: render,
    loadWorkflowSteps: loadWorkflowSteps
  };

  PMS.Modules = PMS.Modules || {};
  PMS.Modules.Workflows = PMS.Workflows;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

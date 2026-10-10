(function () {
  'use strict';

  const PMS = window.PMS = window.PMS || {};

  const WORKFLOWS_CACHE_KEY =
    PMS.Cache && PMS.Cache.keys && PMS.Cache.keys.WORKFLOWS
      ? PMS.Cache.keys.WORKFLOWS
      : 'workflows';

  const DEPARTMENTS_CACHE_KEY =
    PMS.Cache && PMS.Cache.keys && PMS.Cache.keys.DEPARTMENTS
      ? PMS.Cache.keys.DEPARTMENTS
      : 'departments';

  const STEP_CACHE_PREFIX =
    PMS.Cache && PMS.Cache.keys && PMS.Cache.keys.WORKFLOW_STEPS
      ? PMS.Cache.keys.WORKFLOW_STEPS
      : 'workflow_steps';

  const ASSIGNMENT_CACHE_PREFIX =
    PMS.Cache && PMS.Cache.keys &&
    PMS.Cache.keys.WORKFLOW_DEPARTMENT_STEPS
      ? PMS.Cache.keys.WORKFLOW_DEPARTMENT_STEPS
      : 'workflow_department_steps';

  const state = {
    workflows: [],
    departments: [],
    steps: [],
    assignments: [],
    workflowId: '',
    loading: false,
    saving: false,
    workflowDataRequestId: 0,
    initialRequestId: 0
  };

  function init() {
    const page = document.querySelector('.page-section');

    if (
      !page ||
      document.getElementById('workflow-department-assignments')
    ) {
      return;
    }

    const section = document.createElement('section');
    section.id = 'workflow-department-assignments';
    section.className = 'card';
    section.style.marginBottom = '20px';

    section.innerHTML = `
      <div class="card-body">
        <div class="page-header">
          <div>
            <h3>اتصال بخش‌ها به مراحل فرایند</h3>
            <p>برای هر بخش، یک مرحله از Workflow انتخاب کن.</p>
          </div>
        </div>

        <div class="filter-bar">
          <div class="filter-group">
            <label for="wsd-workflow">انتخاب Workflow</label>
            <select id="wsd-workflow" class="form-control">
              <option value="">در حال دریافت...</option>
            </select>
          </div>
        </div>

        <div id="wsd-message" class="alert" hidden></div>

        <div id="wsd-loading" class="loading-state" hidden>
          در حال دریافت اطلاعات...
        </div>

        <div id="wsd-content" hidden>
          <div class="filter-bar">
            <div class="filter-group">
              <label for="wsd-department">بخش کارخانه</label>
              <select id="wsd-department" class="form-control">
                <option value="">انتخاب بخش</option>
              </select>
            </div>

            <div class="filter-group">
              <label for="wsd-step">مرحله فرایند</label>
              <select id="wsd-step" class="form-control">
                <option value="">انتخاب مرحله</option>
              </select>
            </div>

            <div class="filter-group">
              <label>&nbsp;</label>
              <button
                type="button"
                id="wsd-assign-button"
                class="btn btn-primary"
              >
                اتصال بخش به مرحله
              </button>
            </div>
          </div>

          <h4>اتصال‌های ثبت‌شده</h4>

          <div id="wsd-empty" class="table-empty" hidden>
            هنوز بخشی به مراحل این Workflow متصل نشده است.
          </div>

          <div
            id="wsd-table-container"
            class="table-wrapper"
            hidden
          ></div>
        </div>
      </div>
    `;

    const header = page.querySelector('.page-header');

    if (header) {
      header.insertAdjacentElement('afterend', section);
    } else {
      page.prepend(section);
    }

    bindEvents();
    loadInitialData();
  }

  function bindEvents() {
    const workflowSelect = document.getElementById('wsd-workflow');
    const assignButton = document.getElementById('wsd-assign-button');
    const table = document.getElementById('wsd-table-container');

    workflowSelect.addEventListener('change', async function () {
      state.workflowId = this.value;
      await loadWorkflowData();
    });

    assignButton.addEventListener('click', assignDepartment);

    table.addEventListener('click', function (event) {
      const button = event.target.closest('.wsd-remove-button');

      if (button) {
        removeAssignment(button.getAttribute('data-id'));
      }
    });
  }

  async function loadInitialData() {
    const requestId = ++state.initialRequestId;

    setMessage('', '');
    setLoading(true);

    try {
      const results = await Promise.all([
        PMS.Api.getCached(
          '/workflows',
          WORKFLOWS_CACHE_KEY,
          {
            onRefresh: function (data) {
              if (requestId !== state.initialRequestId) return;

              state.workflows = normalizeList(
                data,
                ['items', 'workflows']
              );

              renderWorkflowOptions();
            },
            onError: function (error) {
              console.warn('Workflow refresh failed:', error);
            }
          }
        ),

        PMS.Api.getCached(
          '/departments',
          DEPARTMENTS_CACHE_KEY,
          {
            onRefresh: function (data) {
              if (requestId !== state.initialRequestId) return;

              state.departments = normalizeList(
                data,
                ['items', 'departments']
              ).filter(isActive);

              renderDepartmentOptions();
            },
            onError: function (error) {
              console.warn('Departments refresh failed:', error);
            }
          }
        )
      ]);

      if (requestId !== state.initialRequestId) return;

      state.workflows = normalizeList(
        results[0].data,
        ['items', 'workflows']
      );

      state.departments = normalizeList(
        results[1].data,
        ['items', 'departments']
      ).filter(isActive);

      renderWorkflowOptions();
      renderDepartmentOptions();

      if (state.workflows.length === 0) {
        setMessage(
          'هیچ Workflowای برای انتخاب وجود ندارد.',
          'info'
        );
        return;
      }

      state.workflowId = String(getId(state.workflows[0]));

      document.getElementById('wsd-workflow').value =
        state.workflowId;

      await loadWorkflowData();

    } catch (error) {
      console.error(
        'Workflow assignment initialization failed:',
        error
      );

      setMessage(getErrorMessage(error), 'danger');

    } finally {
      if (requestId === state.initialRequestId) {
        setLoading(false);
      }
    }
  }

  async function loadWorkflowData() {
    const requestId = ++state.workflowDataRequestId;

    const content = document.getElementById('wsd-content');

    if (!state.workflowId) {
      content.hidden = true;
      state.steps = [];
      state.assignments = [];
      renderStepOptions();
      renderAssignments();
      return;
    }

    const workflowId = state.workflowId;

    state.loading = true;
    setLoading(true);
    setMessage('', '');

    try {
      const stepUrl =
        '/workflows/' + encodeURIComponent(workflowId) + '/steps';

      const assignmentUrl =
        '/workflows/' + encodeURIComponent(workflowId) +
        '/department-steps';

      const results = await Promise.all([
        PMS.Api.getCached(
          stepUrl,
          getStepCacheKey(workflowId),
          {
            onRefresh: function (data) {
              if (
                requestId !== state.workflowDataRequestId ||
                workflowId !== state.workflowId
              ) {
                return;
              }

              state.steps = normalizeList(
                data,
                ['items', 'steps']
              ).filter(function (step) {
                const status = getValue(
                  step,
                  'Status',
                  'status'
                );

                return (
                  !status ||
                  String(status).toUpperCase() === 'ACTIVE'
                );
              });

              sortSteps();
              renderStepOptions();
            },
            onError: function (error) {
              if (requestId === state.workflowDataRequestId) {
                console.warn(
                  'Workflow steps refresh failed:',
                  error
                );
              }
            }
          }
        ),

        PMS.Api.getCached(
          assignmentUrl,
          getAssignmentCacheKey(workflowId),
          {
            onRefresh: function (data) {
              if (
                requestId !== state.workflowDataRequestId ||
                workflowId !== state.workflowId
              ) {
                return;
              }

              state.assignments = normalizeList(
                data,
                ['items', 'assignments']
              ).filter(isActive);

              renderAssignments();
            },
            onError: function (error) {
              if (requestId === state.workflowDataRequestId) {
                console.warn(
                  'Department-step assignments refresh failed:',
                  error
                );
              }
            }
          }
        )
      ]);

      if (
        requestId !== state.workflowDataRequestId ||
        workflowId !== state.workflowId
      ) {
        return;
      }

      state.steps = normalizeList(
        results[0].data,
        ['items', 'steps']
      ).filter(function (step) {
        const status = getValue(step, 'Status', 'status');

        return (
          !status ||
          String(status).toUpperCase() === 'ACTIVE'
        );
      });

      state.assignments = normalizeList(
        results[1].data,
        ['items', 'assignments']
      ).filter(isActive);

      sortSteps();
      renderStepOptions();
      renderAssignments();

      content.hidden = false;

      if (state.steps.length === 0) {
        setMessage(
          'برای این Workflow هنوز مرحله فعالی ثبت نشده است.',
          'info'
        );
      }

    } catch (error) {
      if (requestId !== state.workflowDataRequestId) return;

      console.error(
        'Loading workflow assignments failed:',
        error
      );

      content.hidden = true;
      setMessage(getErrorMessage(error), 'danger');

    } finally {
      if (requestId === state.workflowDataRequestId) {
        state.loading = false;
        setLoading(false);
      }
    }
  }

  function isActive(item) {
    const status = getValue(item, 'Status', 'status');

    return (
      !status ||
      String(status).toUpperCase() === 'ACTIVE'
    );
  }

  function sortSteps() {
    state.steps.sort(function (a, b) {
      return Number(
        getValue(a, 'StepOrder', 'stepOrder') || 0
      ) - Number(
        getValue(b, 'StepOrder', 'stepOrder') || 0
      );
    });
  }

  function getStepCacheKey(workflowId) {
    return STEP_CACHE_PREFIX + '_' + workflowId;
  }

  function getAssignmentCacheKey(workflowId) {
    return ASSIGNMENT_CACHE_PREFIX + '_' + workflowId;
  }

  function invalidateCache(key) {
    if (!key) return;

    try {
      if (
        PMS.Api &&
        typeof PMS.Api.invalidate === 'function'
      ) {
        PMS.Api.invalidate(key);
      }

      if (
        PMS.Cache &&
        typeof PMS.Cache.invalidate === 'function'
      ) {
        PMS.Cache.invalidate(key);
      }

      if (
        PMS.Cache &&
        typeof PMS.Cache.remove === 'function'
      ) {
        PMS.Cache.remove(key);
      }

      if (
        PMS.Cache &&
        typeof PMS.Cache.delete === 'function'
      ) {
        PMS.Cache.delete(key);
      }
    } catch (error) {
      console.warn('Cache invalidation failed:', key, error);
    }
  }

  function invalidateWorkflowAssignmentCaches(workflowId) {
    if (!workflowId) return;

    invalidateCache(getAssignmentCacheKey(workflowId));
    invalidateCache(getStepCacheKey(workflowId));
    invalidateCache(WORKFLOWS_CACHE_KEY);
    invalidateCache(DEPARTMENTS_CACHE_KEY);
  }

  function renderWorkflowOptions() {
    const select = document.getElementById('wsd-workflow');

    if (!select) return;

    let html = '<option value="">انتخاب Workflow</option>';

    state.workflows.forEach(function (workflow) {
      const id = getId(workflow);
      const name = getValue(workflow, 'Name', 'name') || 'بدون نام';
      const code = getValue(workflow, 'Code', 'code') || '';

      html +=
        '<option value="' + escapeAttribute(id) + '">' +
        escapeHtml(name) +
        (code ? ' (' + escapeHtml(code) + ')' : '') +
        '</option>';
    });

    select.innerHTML = html;

    if (state.workflowId) {
      select.value = state.workflowId;
    }
  }

  function renderDepartmentOptions() {
    const select = document.getElementById('wsd-department');

    if (!select) return;

    let html = '<option value="">انتخاب بخش</option>';

    state.departments.forEach(function (department) {
      const id = getId(department);
      const name = getValue(department, 'Name', 'name') || 'بدون نام';
      const code = getValue(department, 'Code', 'code') || '';

      html +=
        '<option value="' + escapeAttribute(id) + '">' +
        escapeHtml(name) +
        (code ? ' (' + escapeHtml(code) + ')' : '') +
        '</option>';
    });

    select.innerHTML = html;
  }

  function renderStepOptions() {
    const select = document.getElementById('wsd-step');

    if (!select) return;

    let html = '<option value="">انتخاب مرحله</option>';

    state.steps.forEach(function (step) {
      const id = getId(step);
      const name = getValue(step, 'Name', 'name') || 'بدون نام';
      const order = getValue(step, 'StepOrder', 'stepOrder');

      html +=
        '<option value="' + escapeAttribute(id) + '">' +
        (
          order !== undefined &&
          order !== null &&
          order !== ''
            ? escapeHtml(String(order)) + '. '
            : ''
        ) +
        escapeHtml(name) +
        '</option>';
    });

    select.innerHTML = html;
  }

  async function assignDepartment() {
    if (state.saving || state.loading) return;

    const departmentSelect =
      document.getElementById('wsd-department');

    const stepSelect =
      document.getElementById('wsd-step');

    const button =
      document.getElementById('wsd-assign-button');

    const departmentId = departmentSelect.value;
    const stepId = stepSelect.value;
    const workflowId = state.workflowId;

    if (!workflowId || !departmentId || !stepId) {
      setMessage(
        'ابتدا Workflow، بخش و مرحله را انتخاب کن.',
        'warning'
      );
      return;
    }

    const existing = state.assignments.find(function (item) {
      return String(
        getValue(item, 'DepartmentID', 'departmentId')
      ) === String(departmentId);
    });

    if (existing) {
      const existingStepId = getValue(
        existing,
        'WorkflowStepID',
        'workflowStepId'
      );

      if (String(existingStepId) === String(stepId)) {
        setMessage(
          'این بخش قبلاً به همین مرحله متصل شده است.',
          'info'
        );
      } else {
        setMessage(
          'این بخش قبلاً به مرحله دیگری متصل شده است. ' +
          'ابتدا اتصال قبلی را حذف کن.',
          'warning'
        );
      }

      return;
    }

    state.saving = true;
    button.disabled = true;
    button.textContent = 'در حال ثبت...';
    setMessage('', '');

    try {
      await PMS.Api.post(
        '/workflows/' + encodeURIComponent(workflowId) +
        '/department-steps',
        {
          WorkflowStepID: stepId,
          DepartmentID: departmentId
        }
      );

      invalidateWorkflowAssignmentCaches(workflowId);

      setMessage(
        'اتصال بخش به مرحله با موفقیت ثبت شد.',
        'success'
      );

      departmentSelect.value = '';
      stepSelect.value = '';

      await loadWorkflowData();

    } catch (error) {
      console.error(
        'Assigning department to workflow step failed:',
        error
      );

      setMessage(getErrorMessage(error), 'danger');

    } finally {
      state.saving = false;
      button.disabled = false;
      button.textContent = 'اتصال بخش به مرحله';
    }
  }

  async function removeAssignment(id) {
    if (!id || state.saving || state.loading) return;

    const confirmed = window.confirm(
      'آیا از حذف اتصال این بخش به مرحله مطمئن هستی؟'
    );

    if (!confirmed) return;

    const workflowId = state.workflowId;

    state.saving = true;
    setMessage('', '');

    try {
      await PMS.Api.delete(
        '/workflows/' + encodeURIComponent(workflowId) +
        '/department-steps/' + encodeURIComponent(id)
      );

      invalidateWorkflowAssignmentCaches(workflowId);

      setMessage(
        'اتصال بخش با موفقیت حذف شد.',
        'success'
      );

      await loadWorkflowData();

    } catch (error) {
      console.error(
        'Removing department assignment failed:',
        error
      );

      setMessage(getErrorMessage(error), 'danger');

    } finally {
      state.saving = false;
    }
  }

  function renderAssignments() {
    const container =
      document.getElementById('wsd-table-container');

    const empty = document.getElementById('wsd-empty');

    if (!container || !empty) return;

    const rows = state.assignments.map(function (assignment) {
      const departmentId = getValue(
        assignment,
        'DepartmentID',
        'departmentId'
      );

      const stepId = getValue(
        assignment,
        'WorkflowStepID',
        'workflowStepId'
      );

      const department = state.departments.find(function (item) {
        return String(getId(item)) === String(departmentId);
      });

      const step = state.steps.find(function (item) {
        return String(getId(item)) === String(stepId);
      });

      const departmentName = department
        ? getValue(department, 'Name', 'name')
        : 'بخش حذف‌شده یا غیرفعال';

      const stepName = step
        ? getValue(step, 'Name', 'name')
        : 'مرحله پیدا نشد';

      const stepOrder = step
        ? getValue(step, 'StepOrder', 'stepOrder')
        : '';

      return {
        id: getId(assignment),
        departmentName: departmentName || '-',
        stepName: stepName || '-',
        stepOrder: stepOrder
      };
    });

    if (rows.length === 0) {
      container.innerHTML = '';
      container.hidden = true;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;

    let html =
      '<table class="data-table">' +
      '<thead><tr>' +
      '<th>بخش کارخانه</th>' +
      '<th>مرحله Workflow</th>' +
      '<th>عملیات</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (row) {
      const stepLabel =
        row.stepOrder !== '' &&
        row.stepOrder !== undefined &&
        row.stepOrder !== null
          ? escapeHtml(String(row.stepOrder)) + '. '
          : '';

      html +=
        '<tr>' +
        '<td>' + escapeHtml(row.departmentName) + '</td>' +
        '<td>' + stepLabel + escapeHtml(row.stepName) + '</td>' +
        '<td>' +
        '<button type="button" class="btn btn-sm btn-secondary ' +
        'wsd-remove-button" data-id="' +
        escapeAttribute(row.id) + '">' +
        'حذف اتصال</button>' +
        '</td>' +
        '</tr>';
    });

    html += '</tbody></table>';

    container.innerHTML = html;
    container.hidden = false;
  }

  function normalizeList(result, keys) {
    let value = result;

    if (value && value.data !== undefined) {
      value = value.data;
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === 'object') {
      for (let i = 0; i < keys.length; i++) {
        if (Array.isArray(value[keys[i]])) {
          return value[keys[i]];
        }
      }
    }

    return [];
  }

  function getId(item) {
    return getValue(item, 'ID', 'id') || '';
  }

  function getValue(item, upperKey, lowerKey) {
    if (!item) return '';

    if (item[upperKey] !== undefined) {
      return item[upperKey];
    }

    return item[lowerKey] !== undefined
      ? item[lowerKey]
      : '';
  }

  function setLoading(visible) {
    const element = document.getElementById('wsd-loading');

    if (element) {
      element.hidden = !visible;
    }
  }

  function setMessage(message, type) {
    const box = document.getElementById('wsd-message');

    if (!box) return;

    box.textContent = message || '';
    box.hidden = !message;
    box.className = 'alert' + (type ? ' alert-' + type : '');
  }

  function getErrorMessage(error) {
    return error && error.message
      ? error.message
      : 'عملیات انجام نشد. لطفاً دوباره تلاش کن.';
  }

  function escapeHtml(value) {
    return String(
      value === undefined || value === null ? '' : value
    )
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
(function () {
  'use strict';

  const CACHE_KEY = PMS.Cache.keys.DEPARTMENTS;
  const DETAIL_CACHE_PREFIX = 'pms_department_detail_';

  const state = {
    departments: [],
    search: ''
  };

  function init() {
    bindEvents();

    // نمایش فوری فهرست ذخیره‌شده
    const cached = PMS.Cache.get(CACHE_KEY);

    if (cached !== null) {
      state.departments = normalizeDepartments(cached);
      render();
    }

    // دریافت یا به‌روزرسانی فهرست با سیستم کش
    loadDepartments();
  }

  function bindEvents() {
    const searchInput = document.getElementById('department-search');

    if (searchInput) {
      searchInput.addEventListener('input', function (event) {
        state.search = event.target.value.trim().toLowerCase();
        render();
      });
    }

    const createButton = document.getElementById('department-create-button');

    if (createButton) {
      createButton.addEventListener('click', function () {
        openDepartmentForm();
      });
    }

    const tableContainer = document.getElementById(
      'departments-table-container'
    );

    if (tableContainer) {
      tableContainer.addEventListener('click', function (event) {
        const button = event.target.closest('.department-view-button');

        if (button) {
          openDepartmentDetails(button.getAttribute('data-id'));
        }
      });
    }
  }

  async function loadDepartments() {
    const loading = document.getElementById('departments-loading');
    const errorBox = document.getElementById('departments-error');

    if (loading && state.departments.length === 0) {
      loading.hidden = false;
    }

    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }

    try {
      const result = await PMS.Api.getCached(
        '/departments',
        CACHE_KEY,
        {
          onRefresh: function (data) {
            state.departments = normalizeDepartments(data);
            render();
          },

          onError: function (error) {
            console.warn(
              'Departments background refresh failed:',
              error
            );

            showError(error, state.departments.length > 0);
          }
        }
      );

      state.departments = normalizeDepartments(result.data);
      render();
    } catch (error) {
      console.error('Departments loading failed:', error);

      if (state.departments.length === 0) {
        showError(error, false);
      }
    } finally {
      if (loading) {
        loading.hidden = true;
      }
    }
  }

  function normalizeDepartments(data) {
    if (Array.isArray(data)) return data;

    if (data && Array.isArray(data.items)) {
      return data.items;
    }

    if (data && Array.isArray(data.departments)) {
      return data.departments;
    }

    return [];
  }

  function getDepartmentId(department) {
    if (!department) return '';

    return String(department.ID || department.id || '');
  }

  function getDepartmentDetailCacheKey(id) {
    return DETAIL_CACHE_PREFIX + String(id);
  }

  function getFilteredDepartments() {
    let result = state.departments.slice();

    if (state.search !== '') {
      result = result.filter(function (department) {
        const text = [
          department.ID,
          department.id,
          department.Name,
          department.name,
          department.Code,
          department.code,
          department.Status,
          department.status
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return text.indexOf(state.search) !== -1;
      });
    }

    return result;
  }

  function render() {
    const container = document.getElementById(
      'departments-table-container'
    );

    const empty = document.getElementById('departments-empty');

    if (!container) return;

    const departments = getFilteredDepartments();

    if (departments.length === 0) {
      container.innerHTML = '';
      container.hidden = true;

      if (empty) {
        empty.hidden = false;
        empty.textContent = state.search !== ''
          ? 'واحد موردنظر پیدا نشد.'
          : 'واحدی برای نمایش وجود ندارد.';
      }

      return;
    }

    if (empty) {
      empty.hidden = true;
    }

    let html = '<table class="data-table"><thead><tr>';

    html += '<th>نام واحد</th><th>کد واحد</th><th>وضعیت</th>';
    html += '<th>تاریخ ایجاد</th><th>آخرین بروزرسانی</th><th>عملیات</th>';
    html += '</tr></thead><tbody>';

    departments.forEach(function (department) {
      const id = getDepartmentId(department);
      const name = department.Name || department.name || '-';
      const code = department.Code || department.code || '-';
      const status = department.Status || department.status || '-';
      const createdAt = department.CreatedAt || department.createdAt || '';
      const updatedAt = department.UpdatedAt || department.updatedAt || '';

      html += '<tr>';
      html += '<td>' + escapeHtml(name) + '</td>';
      html += '<td>' + escapeHtml(code) + '</td>';
      html += '<td>' + renderStatus(status) + '</td>';
      html += '<td>' + escapeHtml(formatDate(createdAt)) + '</td>';
      html += '<td>' + escapeHtml(formatDate(updatedAt)) + '</td>';

      html += '<td><button type="button" ' +
        'class="btn btn-sm btn-secondary department-view-button" ' +
        'data-id="' + escapeAttribute(id) + '">مشاهده</button></td>';

      html += '</tr>';
    });

    html += '</tbody></table>';

    container.innerHTML = html;
    container.hidden = false;
  }

  function openDepartmentForm(department) {
    const editing = Boolean(department);

    const content = `
      <form id="department-form">
        <div class="form-group">
          <label for="department-name">نام واحد *</label>
          <input
            class="form-control"
            id="department-name"
            name="Name"
            type="text"
            required
            maxlength="150"
            value="${escapeAttribute(
              editing ? department.Name || department.name || '' : ''
            )}"
          >
        </div>

        <div class="form-group">
          <label for="department-code">کد واحد *</label>
          <input
            class="form-control"
            id="department-code"
            name="Code"
            type="text"
            required
            maxlength="50"
            value="${escapeAttribute(
              editing ? department.Code || department.code || '' : ''
            )}"
          >
        </div>

        <div class="form-group">
          <label for="department-status">وضعیت</label>
          <select
            class="form-control"
            id="department-status"
            name="Status"
          >
            <option
              value="ACTIVE"
              ${
                !editing ||
                String(
                  department.Status || department.status || ''
                ).toUpperCase() === 'ACTIVE'
                  ? 'selected'
                  : ''
              }
            >فعال</option>

            <option
              value="INACTIVE"
              ${
                editing &&
                String(
                  department.Status || department.status || ''
                ).toUpperCase() === 'INACTIVE'
                  ? 'selected'
                  : ''
              }
            >غیرفعال</option>
          </select>
        </div>

        <div id="department-form-error" class="form-error" hidden></div>
      </form>
    `;

    PMS.Modal.open({
      id: 'department-form-modal',
      title: editing ? 'ویرایش واحد' : 'ثبت واحد جدید',
      content: content,

      footer: `
        <button
          type="button"
          class="btn btn-secondary"
          data-department-cancel
        >انصراف</button>

        <button
          type="button"
          class="btn btn-primary"
          id="department-save-button"
        >
          ${editing ? 'ذخیره تغییرات' : 'ثبت واحد'}
        </button>
      `,

      onOpen: function () {
        const modal = document.getElementById('department-form-modal');

        if (!modal) return;

        const cancelButton = modal.querySelector(
          '[data-department-cancel]'
        );

        const saveButton = modal.querySelector(
          '#department-save-button'
        );

        if (cancelButton) {
          cancelButton.addEventListener('click', function () {
            PMS.Modal.close('department-form-modal');
          });
        }

        if (saveButton) {
          saveButton.addEventListener('click', function () {
            saveDepartment(
              editing ? getDepartmentId(department) : null
            );
          });
        }
      }
    });
  }

  async function saveDepartment(id) {
    const form = document.getElementById('department-form');
    const errorBox = document.getElementById('department-form-error');
    const saveButton = document.getElementById('department-save-button');

    if (!form) return;

    if (!form.reportValidity()) return;

    const data = {
      Name: form.elements.Name.value.trim(),
      Code: form.elements.Code.value.trim(),
      Status: form.elements.Status.value
    };

    if (!data.Name || !data.Code) {
      showFormError('نام واحد و کد واحد الزامی هستند.');
      return;
    }

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'در حال ذخیره...';
    }

    try {
      if (id) {
        await PMS.Api.put(
          '/departments/' + encodeURIComponent(id),
          data
        );
      } else {
        await PMS.Api.post('/departments', data);
      }

      // حذف اعتبار کش فهرست و آدرس مربوط به آن
      invalidateCacheKey(CACHE_KEY);
      invalidateCacheKey('/departments');

      // حذف کش جزئیات واحد و مسیر مربوط به آن در زمان ویرایش
      if (id) {
        invalidateCacheKey(getDepartmentDetailCacheKey(id));
        invalidateCacheKey(
          '/departments/' + encodeURIComponent(id)
        );
      }

      PMS.Modal.close('department-form-modal');

      showMessage(
        id ? 'تغییرات واحد ذخیره شد.' : 'واحد جدید ثبت شد.'
      );

      await loadDepartments();
    } catch (error) {
      console.error('Saving department failed:', error);

      showFormError(
        error && error.message
          ? error.message
          : 'ذخیره اطلاعات انجام نشد. لطفاً دوباره تلاش کن.'
      );
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = id
          ? 'ذخیره تغییرات'
          : 'ثبت واحد';
      }
    }

    function showFormError(message) {
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      } else {
        showMessage(message);
      }
    }
  }

  function invalidateCacheKey(key) {
    if (PMS.Api && typeof PMS.Api.invalidate === 'function') {
      PMS.Api.invalidate(key);
    }

    if (PMS.Cache && typeof PMS.Cache.remove === 'function') {
      PMS.Cache.remove(key);
    }
  }

  async function openDepartmentDetails(id) {
    if (!id) {
      showMessage('شناسه واحد پیدا نشد.');
      return;
    }

    const departmentId = String(id);
    const detailCacheKey = getDepartmentDetailCacheKey(departmentId);
    const endpoint = '/departments/' + encodeURIComponent(departmentId);

    // در صورت وجود اطلاعات فهرست، از آن برای نمایش اولیه استفاده کن
    const listDepartment = state.departments.find(function (item) {
      return getDepartmentId(item) === departmentId;
    });

    if (listDepartment) {
      openDepartmentDetailsModal(listDepartment);
    }

    try {
      // دریافت جزئیات از کش؛ در صورت نیاز، API اطلاعات را به‌روزرسانی می‌کند
      const result = await PMS.Api.getCached(
        endpoint,
        detailCacheKey,
        {
          onRefresh: function (data) {
            const freshDepartment = normalizeDepartmentDetails(data);

            if (freshDepartment) {
              updateDepartmentInState(freshDepartment);
              render();

              // اگر پنجره جزئیات هنوز باز است، اطلاعات آن نیز به‌روز شود
              const modal = document.getElementById(
                'department-details-modal'
              );

              if (modal) {
                openDepartmentDetailsModal(freshDepartment);
              }
            }
          },

          onError: function (error) {
            console.warn(
              'Department details background refresh failed:',
              error
            );
          }
        }
      );

      const department = normalizeDepartmentDetails(
        result && result.data !== undefined
          ? result.data
          : result
      );

      if (!department) {
        if (!listDepartment) {
          showMessage('اطلاعات این واحد پیدا نشد.');
        }

        return;
      }

      updateDepartmentInState(department);
      render();
      openDepartmentDetailsModal(department);
    } catch (error) {
      console.error('Loading department details failed:', error);

      // اگر اطلاعات فهرست موجود است، نمایش آن را حفظ کن
      if (!listDepartment) {
        showMessage(
          error && error.message
            ? error.message
            : 'دریافت جزئیات واحد انجام نشد.'
        );
      }
    }
  }

  function normalizeDepartmentDetails(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }

    // بعضی پاسخ‌های API ممکن است داده را داخل یک فیلد قرار دهند
    if (
      data.data &&
      typeof data.data === 'object' &&
      !Array.isArray(data.data)
    ) {
      return data.data;
    }

    if (
      data.department &&
      typeof data.department === 'object' &&
      !Array.isArray(data.department)
    ) {
      return data.department;
    }

    return data;
  }

  function updateDepartmentInState(department) {
    const id = getDepartmentId(department);

    if (!id) return;

    const index = state.departments.findIndex(function (item) {
      return getDepartmentId(item) === id;
    });

    if (index >= 0) {
      state.departments[index] = Object.assign(
        {},
        state.departments[index],
        department
      );
    } else {
      state.departments.push(department);
    }
  }

  function openDepartmentDetailsModal(department) {
    if (!department) return;

    const id = getDepartmentId(department);
    const name = department.Name || department.name || '-';
    const code = department.Code || department.code || '-';
    const status = department.Status || department.status || '-';
    const createdAt = department.CreatedAt || department.createdAt || '';
    const updatedAt = department.UpdatedAt || department.updatedAt || '';

    const statusLabel = String(status).toUpperCase() === 'ACTIVE'
      ? 'فعال'
      : String(status).toUpperCase() === 'INACTIVE'
        ? 'غیرفعال'
        : status;

    const content = `
      <div class="department-details">
        <p><strong>نام واحد:</strong> ${escapeHtml(name)}</p>
        <p><strong>کد واحد:</strong> ${escapeHtml(code)}</p>
        <p><strong>وضعیت:</strong> ${escapeHtml(statusLabel)}</p>
        <p><strong>تاریخ ایجاد:</strong> ${escapeHtml(formatDate(createdAt))}</p>
        <p><strong>آخرین بروزرسانی:</strong> ${escapeHtml(formatDate(updatedAt))}</p>
      </div>
    `;

    PMS.Modal.open({
      id: 'department-details-modal',
      title: 'جزئیات واحد',
      content: content,

      footer: `
        <button
          type="button"
          class="btn btn-secondary"
          data-department-details-close
        >بستن</button>

        <button
          type="button"
          class="btn btn-primary"
          data-department-edit
        >ویرایش واحد</button>
      `,

      onOpen: function () {
        const modal = document.getElementById(
          'department-details-modal'
        );

        if (!modal) return;

        const closeButton = modal.querySelector(
          '[data-department-details-close]'
        );

        const editButton = modal.querySelector(
          '[data-department-edit]'
        );

        if (closeButton) {
          closeButton.addEventListener('click', function () {
            PMS.Modal.close('department-details-modal');
          });
        }

        if (editButton) {
          editButton.addEventListener('click', function () {
            PMS.Modal.close('department-details-modal');

            // اطلاعات به‌روز برای فرم ویرایش
            const currentDepartment = state.departments.find(
              function (item) {
                return getDepartmentId(item) === id;
              }
            );

            openDepartmentForm(currentDepartment || department);
          });
        }
      }
    });
  }

  function renderStatus(status) {
    const value = String(status || '').toUpperCase();
    let label = status || '-';

    if (value === 'ACTIVE') {
      label = 'فعال';
    } else if (value === 'INACTIVE') {
      label = 'غیرفعال';
    }

    return '<span class="status-badge status-' +
      escapeAttribute(value.toLowerCase()) + '">' +
      escapeHtml(String(label)) +
      '</span>';
  }

  function formatDate(value) {
    if (!value) return '-';

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString('fa-IR');
  }

  function showError(error, cachedAvailable) {
    const errorBox = document.getElementById('departments-error');

    if (!errorBox) return;

    errorBox.textContent = cachedAvailable
      ? 'اتصال به سرور برقرار نشد؛ اطلاعات ذخیره‌شده نمایش داده می‌شود.'
      : (
          error && error.message
            ? error.message
            : 'دریافت واحدها با خطا مواجه شد.'
        );

    errorBox.hidden = false;
  }

  function showMessage(message) {
    if (
      window.PMS &&
      PMS.Alert &&
      typeof PMS.Alert.info === 'function'
    ) {
      PMS.Alert.info(message);
    } else {
      alert(message);
    }
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  window.PMS.Departments = {
    init: init,
    load: loadDepartments,
    render: render
  };

  window.PMS.Modules.Departments = window.PMS.Departments;
})();
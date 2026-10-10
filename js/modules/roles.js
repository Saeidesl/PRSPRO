(function () {
  'use strict';

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  const Api = window.PMS.Api;
  const Cache = window.PMS.Cache;

  const state = {
    roles: [],
    search: '',
    editingRoleId: null
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    return date.toLocaleString('fa-IR');
  }

  function statusLabel(status) {
    if (status === 'ACTIVE') return 'فعال';
    if (status === 'INACTIVE') return 'غیرفعال';
    return status || '-';
  }

  function normalizeRoles(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.roles)) return data.roles;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  }

  function normalizePermissions(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.permissions)) return data.permissions;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  }

  function permissionIdOf(permission) {
    if (!permission) return '';

    return String(
      permission.PermissionID ??
      permission.permissionId ??
      permission.permissionID ??
      permission.ID ??
      permission.id ??
      ''
    ).trim();
  }

  function permissionNameOf(permission) {
    return permission.Name ||
      permission.name ||
      permission.PermissionName ||
      permission.permissionName ||
      '-';
  }

  function permissionCodeOf(permission) {
    return permission.Code ||
      permission.code ||
      permission.PermissionCode ||
      permission.permissionCode ||
      '-';
  }

  function permissionModuleOf(permission) {
    return permission.Module ||
      permission.module ||
      permission.ModuleName ||
      permission.moduleName ||
      '-';
  }

  function render() {
    const loading = document.getElementById('roles-loading');
    const error = document.getElementById('roles-error');
    const container = document.getElementById('roles-table-container');
    const empty = document.getElementById('roles-empty');

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (!container) return;

    let roles = state.roles || [];
    const search = state.search.trim().toLowerCase();

    if (search) {
      roles = roles.filter(function (role) {
        const text = [
          role.ID,
          role.Name,
          role.Code,
          role.Status
        ].join(' ').toLowerCase();

        return text.indexOf(search) !== -1;
      });
    }

    if (!roles.length) {
      container.hidden = true;

      if (empty) {
        empty.hidden = false;
        empty.textContent = search
          ? 'نقشی مطابق جستجو پیدا نشد.'
          : 'نقشی برای نمایش وجود ندارد.';
      }

      return;
    }

    if (empty) empty.hidden = true;
    container.hidden = false;

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += '<th>نام نقش</th>';
    html += '<th>کد</th>';
    html += '<th>وضعیت</th>';
    html += '<th>تاریخ ایجاد</th>';
    html += '<th>آخرین تغییر</th>';
    html += '<th>عملیات</th>';
    html += '</tr></thead><tbody>';

    roles.forEach(function (role) {
      html += '<tr>';
      html += '<td>' + escapeHtml(role.Name) + '</td>';
      html += '<td>' + escapeHtml(role.Code) + '</td>';
      html += '<td>' + escapeHtml(statusLabel(role.Status)) + '</td>';
      html += '<td>' + escapeHtml(formatDate(role.CreatedAt)) + '</td>';
      html += '<td>' + escapeHtml(formatDate(role.UpdatedAt)) + '</td>';
      html += '<td>';

      html +=
        '<button type="button" ' +
        'class="btn btn-sm btn-secondary role-permissions-button" ' +
        'data-role-id="' + escapeHtml(role.ID) + '">' +
        'دسترسی‌ها</button> ';

      html +=
        '<button type="button" ' +
        'class="btn btn-sm btn-primary role-edit-button" ' +
        'data-role-id="' + escapeHtml(role.ID) + '">' +
        'ویرایش</button>';

      html += '</td></tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    bindButtons();
  }

  function showError(message) {
    const loading = document.getElementById('roles-loading');
    const error = document.getElementById('roles-error');

    if (loading) loading.hidden = true;

    if (error) {
      error.textContent = message || 'خطا در دریافت نقش‌ها.';
      error.hidden = false;
    }
  }

  function bindButtons() {
    document.querySelectorAll('.role-permissions-button').forEach(
      function (button) {
        button.addEventListener('click', function () {
          loadPermissions(button.getAttribute('data-role-id'));
        });
      }
    );

    document.querySelectorAll('.role-edit-button').forEach(
      function (button) {
        button.addEventListener('click', function () {
          openEditRoleForm(button.getAttribute('data-role-id'));
        });
      }
    );
  }

  // باز کردن فوری پنجره و سپس دریافت اطلاعات
  async function loadPermissions(roleId) {
    if (!roleId) return;

    let modal = document.getElementById('pms-role-modal');

    if (
      !modal ||
      String(modal.getAttribute('data-role-id')) !== String(roleId)
    ) {
      modal = showPermissions([], roleId, true);
    } else {
      const tbody = modal.querySelector('#role-permissions-tbody');

      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="6" class="table-empty">' +
          'در حال دریافت دسترسی‌ها...</td></tr>';
      }
    }

    const currentModal = modal;
    const message = modal.querySelector('#role-permission-message');

    if (message) message.hidden = true;

    try {
      const results = await Promise.all([
        Api.get(
          '/roles/' + encodeURIComponent(roleId) + '/permissions'
        ),
        Api.get('/roles/available-permissions')
      ]);

      if (
        !currentModal.isConnected ||
        String(currentModal.getAttribute('data-role-id')) !== String(roleId)
      ) {
        return;
      }

      const assignedRows = normalizePermissions(
        Api.extractData(results[0])
      );

      const allPermissions = normalizePermissions(
        Api.extractData(results[1])
      );

      const permissionsById = new Map();

      allPermissions.forEach(function (permission) {
        const id = String(
          permission.ID || permission.id || ''
        ).trim();

        if (id) permissionsById.set(id, permission);
      });

      const permissions = assignedRows.map(function (row) {
        const id = String(
          row.PermissionID ||
          row.permissionId ||
          row.permissionID ||
          row.ID ||
          row.id ||
          ''
        ).trim();

        const details = permissionsById.get(id);

        if (!details) {
          return {
            ID: id,
            PermissionID: id,
            Name: 'اطلاعات دسترسی پیدا نشد',
            Code: id,
            Module: '-',
            Status: 'UNKNOWN'
          };
        }

        return Object.assign({}, details, {
          ID: id,
          PermissionID: id
        });
      });

      renderPermissionRows(permissions, roleId, currentModal);

      await loadAvailablePermissions(
        roleId,
        currentModal,
        permissions
      );

    } catch (error) {
      console.error('خطای دریافت دسترسی‌های نقش:', error);

      if (currentModal.isConnected) {
        const tbody = currentModal.querySelector(
          '#role-permissions-tbody'
        );

        if (tbody) {
          tbody.innerHTML =
            '<tr><td colspan="6" class="table-empty">' +
            'دریافت دسترسی‌ها ناموفق بود.</td></tr>';
        }

        if (message) {
          message.textContent = error && error.message
            ? error.message
            : 'دریافت دسترسی‌های نقش ناموفق بود.';

          message.hidden = false;
        }
      }
    }
  }

  function showPermissions(permissions, roleId, isLoading) {
    const html = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>دسترسی‌های نقش</h3>
          <button type="button" class="modal-close"
            aria-label="بستن">×</button>
        </div>

        <div class="modal-body">
          <div class="role-permission-add"
            style="margin-bottom:18px;">

            <div id="role-permission-list"
              style="border:1px solid #ddd;border-radius:6px;
              padding:10px;max-height:250px;overflow-y:auto;
              margin-bottom:10px;">
              در حال دریافت فهرست دسترسی‌ها...
            </div>

            <button type="button" id="role-permission-add-button"
              class="btn btn-primary">
              افزودن دسترسی‌های انتخاب‌شده
            </button>

            <button type="button"
              id="role-permission-delete-selected-button"
              class="btn btn-danger" disabled
              style="margin-right:8px;">
              حذف دسترسی‌های انتخاب‌شده (۰)
            </button>
          </div>

          <div id="role-permission-message"
            class="form-error" hidden
            style="margin-bottom:12px;"></div>

          <div class="table-wrapper"
            style="width:100%;overflow-x:auto;">
            <table class="data-table"
              style="width:100%;min-width:650px;">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox"
                      id="role-permission-select-all"
                      aria-label="انتخاب همه">
                  </th>
                  <th>کد</th>
                  <th>نام</th>
                  <th>ماژول</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody id="role-permissions-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>`;

    const old = document.getElementById('pms-role-modal');
    if (old) old.remove();

    const modal = document.createElement('div');

    modal.id = 'pms-role-modal';
    modal.setAttribute('data-role-id', String(roleId));
    modal.className = 'modal-overlay';

    modal.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;' +
      'align-items:center;justify-content:center;padding:16px;' +
      'overflow-y:auto;box-sizing:border-box;';

    modal.innerHTML = html;

    const modalContent = modal.querySelector('.modal-content');

    modalContent.style.cssText =
      'width:100%;max-width:900px;max-height:90vh;' +
      'overflow-y:auto;box-sizing:border-box;';

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener(
      'click',
      function () {
        modal.remove();
      }
    );

    modal.addEventListener('click', function (event) {
      if (event.target === modal) modal.remove();
    });

    modal.querySelector(
      '#role-permission-delete-selected-button'
    ).addEventListener('click', function () {
      deleteSelectedPermissions(roleId, modal);
    });

    modal.querySelector(
      '#role-permission-add-button'
    ).addEventListener('click', function () {
      addPermission(roleId, modal, permissions);
    });

    if (isLoading) {
      const tbody = modal.querySelector('#role-permissions-tbody');

      tbody.innerHTML =
        '<tr><td colspan="6" class="table-empty">' +
        'در حال دریافت دسترسی‌ها...</td></tr>';
    } else {
      renderPermissionRows(permissions, roleId, modal);
      loadAvailablePermissions(roleId, modal, permissions);
    }

    return modal;
  }

  // نمایش دسترسی‌های فعلی نقش
  function renderPermissionRows(permissions, roleId, modal) {
    const tbody = modal.querySelector('#role-permissions-tbody');
    if (!tbody) return;

    if (!permissions.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="table-empty">' +
        'برای این نقش دسترسی‌ای ثبت نشده است.' +
        '</td></tr>';

      const selectAll = modal.querySelector(
        '#role-permission-select-all'
      );

      if (selectAll) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
      }

      updateSelectedPermissionsButton(modal);
      return;
    }

    let html = '';

    permissions.forEach(function (permission) {
      permission = permission || {};

      const permissionId = permissionIdOf(permission);

      html += '<tr>';

      html +=
        '<td><input type="checkbox" ' +
        'class="role-assigned-permission-checkbox" ' +
        'value="' + escapeHtml(permissionId) + '" ' +
        'aria-label="انتخاب دسترسی" ' +
        (!permissionId ? 'disabled' : '') +
        '></td>';

      html +=
        '<td>' + escapeHtml(permissionCodeOf(permission)) + '</td>';

      html +=
        '<td>' + escapeHtml(permissionNameOf(permission)) + '</td>';

      html +=
        '<td>' + escapeHtml(permissionModuleOf(permission)) + '</td>';

      html +=
        '<td>' + escapeHtml(
          statusLabel(permission.Status || permission.status)
        ) + '</td>';

      html += '<td>';

      if (permissionId) {
        html +=
          '<button type="button" ' +
          'class="btn btn-sm btn-danger role-permission-remove-button" ' +
          'data-permission-id="' + escapeHtml(permissionId) + '">' +
          'حذف</button>';
      } else {
        html += '<span>-</span>';
      }

      html += '</td></tr>';
    });

    tbody.innerHTML = html;

    const selectAll = modal.querySelector(
      '#role-permission-select-all'
    );

    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;

      selectAll.onchange = function () {
        tbody.querySelectorAll(
          '.role-assigned-permission-checkbox:not(:disabled)'
        ).forEach(function (checkbox) {
          checkbox.checked = selectAll.checked;
        });

        updateSelectedPermissionsButton(modal);
      };
    }

    tbody.querySelectorAll(
      '.role-assigned-permission-checkbox'
    ).forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        const all = Array.from(
          tbody.querySelectorAll(
            '.role-assigned-permission-checkbox:not(:disabled)'
          )
        );

        const checked = all.filter(function (item) {
          return item.checked;
        });

        if (selectAll) {
          selectAll.checked =
            all.length > 0 && checked.length === all.length;

          selectAll.indeterminate =
            checked.length > 0 && checked.length < all.length;
        }

        updateSelectedPermissionsButton(modal);
      });
    });

    updateSelectedPermissionsButton(modal);

    tbody.querySelectorAll(
      '.role-permission-remove-button'
    ).forEach(function (button) {
      button.addEventListener('click', function () {
        removePermission(
          roleId,
          button.getAttribute('data-permission-id'),
          modal
        );
      });
    });
  }

  function updateSelectedPermissionsButton(modal) {
    if (!modal) return;

    const button = modal.querySelector(
      '#role-permission-delete-selected-button'
    );

    const selected = modal.querySelectorAll(
      '#role-permissions-tbody ' +
      '.role-assigned-permission-checkbox:checked'
    );

    if (!button) return;

    button.disabled = selected.length === 0;

    button.textContent =
      'حذف دسترسی‌های انتخاب‌شده (' + selected.length + ')';
  }

  // حذف گروهی دسترسی‌ها
  async function deleteSelectedPermissions(roleId, modal) {
    if (!roleId || !modal || !modal.isConnected) return;

    const selected = Array.from(
      modal.querySelectorAll(
        '#role-permissions-tbody ' +
        '.role-assigned-permission-checkbox:checked'
      )
    ).map(function (checkbox) {
      return checkbox.value;
    }).filter(Boolean);

    if (!selected.length) return;

    if (!window.confirm(
      'آیا از حذف ' + selected.length +
      ' دسترسی انتخاب‌شده از این نقش مطمئن هستی؟'
    )) {
      return;
    }

    const message = modal.querySelector('#role-permission-message');
    const controls = modal.querySelectorAll(
      'button, input[type="checkbox"]'
    );

    controls.forEach(function (control) {
      control.disabled = true;
    });

    if (message) message.hidden = true;

    const button = modal.querySelector(
      '#role-permission-delete-selected-button'
    );

    if (button) button.textContent = 'در حال حذف...';

    try {
      const results = await Promise.allSettled(
        selected.map(function (permissionId) {
          return Api.delete(
            '/roles/' + encodeURIComponent(roleId) +
            '/permissions/' + encodeURIComponent(permissionId)
          );
        })
      );

      const successCount = results.filter(function (result) {
        return result.status === 'fulfilled';
      }).length;

      const failedCount = results.length - successCount;

      if (Api.invalidate) {
        Api.invalidate('/roles/' + roleId + '/permissions');
      }

      await loadPermissions(roleId);

      const currentModal = document.getElementById('pms-role-modal');

      const currentMessage = currentModal
        ? currentModal.querySelector('#role-permission-message')
        : null;

      if (currentMessage) {
        currentMessage.textContent = failedCount
          ? successCount + ' دسترسی حذف شد؛ حذف ' +
            failedCount + ' مورد ناموفق بود.'
          : successCount + ' دسترسی با موفقیت حذف شد.';

        currentMessage.hidden = false;
      }

    } catch (error) {
      if (message) {
        message.textContent =
          error && error.message
            ? error.message
            : 'حذف دسترسی‌های انتخاب‌شده ناموفق بود.';

        message.hidden = false;
      }

    } finally {
      const currentModal = document.getElementById('pms-role-modal');

      if (currentModal === modal) {
        controls.forEach(function (control) {
          control.disabled = false;
        });

        updateSelectedPermissionsButton(modal);
      }
    }
  }

  // دریافت دسترسی‌هایی که هنوز به نقش اختصاص داده نشده‌اند
  async function loadAvailablePermissions(
    roleId,
    modal,
    assignedPermissions
  ) {
    const list = modal.querySelector('#role-permission-list');
    const message = modal.querySelector('#role-permission-message');

    try {
      const response = await Api.get('/roles/available-permissions');

      const available = normalizePermissions(
        Api.extractData(response)
      );

      if (!list || !modal.isConnected) return;

      const assignedIds = new Set(
        (assignedPermissions || [])
          .map(permissionIdOf)
          .filter(Boolean)
      );

      const choices = available.filter(function (permission) {
        const id = String(
          permission.ID || permission.id || ''
        ).trim();

        const status = String(
          permission.Status || permission.status || 'ACTIVE'
        ).trim().toUpperCase();

        return id && !assignedIds.has(id) && status === 'ACTIVE';
      });

      if (!choices.length) {
        list.innerHTML =
          '<div style="color:#666;padding:8px;">' +
          'دسترسی جدیدی برای افزودن وجود ندارد.</div>';

        if (message) message.hidden = true;
        return;
      }

      list.innerHTML = choices.map(function (permission) {
        const id = String(
          permission.ID || permission.id || ''
        ).trim();

        return `
          <label style="display:flex;align-items:center;gap:8px;
            padding:8px 4px;border-bottom:1px solid #eee;
            cursor:pointer;">
            <input type="checkbox"
              class="role-permission-checkbox"
              value="${escapeHtml(id)}">
            <span>
              <strong>${escapeHtml(permissionCodeOf(permission))}</strong>
              — ${escapeHtml(permissionNameOf(permission))}
              <small style="color:#777;">
                (${escapeHtml(permissionModuleOf(permission))})
              </small>
            </span>
          </label>
        `;
      }).join('');

      if (message) message.hidden = true;

    } catch (error) {
      console.error('خطای دریافت دسترسی‌ها:', error);

      if (list) {
        list.textContent = 'دریافت فهرست دسترسی‌ها ناموفق بود.';
      }

      if (message) {
        message.textContent = error && error.message
          ? error.message
          : 'دریافت فهرست دسترسی‌ها ناموفق بود.';

        message.hidden = false;
      }
    }
  }

  // افزودن چند دسترسی به نقش
  async function addPermission(roleId, modal, assignedPermissions) {
    const checkboxes = modal.querySelectorAll(
      '.role-permission-checkbox:checked'
    );

    const button = modal.querySelector('#role-permission-add-button');
    const message = modal.querySelector('#role-permission-message');

    const permissionIds = Array.from(checkboxes).map(
      function (checkbox) {
        return checkbox.value;
      }
    );

    if (!permissionIds.length) {
      if (message) {
        message.textContent = 'لطفاً حداقل یک دسترسی را تیک بزن.';
        message.hidden = false;
      }

      return;
    }

    button.disabled = true;
    button.textContent = 'در حال افزودن...';

    if (message) message.hidden = true;

    try {
      const results = await Promise.allSettled(
        permissionIds.map(function (permissionId) {
          return Api.post(
            '/roles/' + encodeURIComponent(roleId) + '/permissions',
            { permissionId: permissionId }
          );
        })
      );

      const successCount = results.filter(function (result) {
        return result.status === 'fulfilled';
      }).length;

      const failedCount = results.length - successCount;

      if (Api.invalidate) {
        Api.invalidate('/roles/' + roleId + '/permissions');
      }

      await loadPermissions(roleId);

      const currentModal = document.getElementById('pms-role-modal');

      const currentMessage = currentModal
        ? currentModal.querySelector('#role-permission-message')
        : null;

      if (currentMessage) {
        currentMessage.textContent = failedCount > 0
          ? successCount + ' دسترسی اضافه شد؛ افزودن ' +
            failedCount + ' مورد ناموفق بود.'
          : successCount + ' دسترسی با موفقیت اضافه شد.';

        currentMessage.hidden = false;
      }

    } catch (error) {
      if (message) {
        message.textContent = error && error.message
          ? error.message
          : 'افزودن دسترسی‌ها ناموفق بود.';

        message.hidden = false;
      }

    } finally {
      const currentModal = document.getElementById('pms-role-modal');

      if (currentModal === modal) {
        const currentButton = modal.querySelector(
          '#role-permission-add-button'
        );

        if (currentButton) {
          currentButton.disabled = false;
          currentButton.textContent = 'افزودن دسترسی‌های انتخاب‌شده';
        }
      }
    }
  }

  // حذف تکی دسترسی
  async function removePermission(roleId, permissionId, modal) {
    if (!roleId || !permissionId) return;

    if (!window.confirm(
      'آیا از حذف این دسترسی از نقش مطمئن هستی؟'
    )) {
      return;
    }

    const message = modal.querySelector('#role-permission-message');

    const buttons = modal.querySelectorAll(
      '.role-permission-remove-button'
    );

    buttons.forEach(function (button) {
      button.disabled = true;
    });

    if (message) message.hidden = true;

    try {
      await Api.delete(
        '/roles/' + encodeURIComponent(roleId) +
        '/permissions/' + encodeURIComponent(permissionId)
      );

      if (Api.invalidate) {
        Api.invalidate('/roles/' + roleId + '/permissions');
      }

      if (window.PMS.Alert && window.PMS.Alert.info) {
        window.PMS.Alert.info('دسترسی با موفقیت حذف شد.');
      }

      await loadPermissions(roleId);

    } catch (error) {
      if (message) {
        message.textContent =
          error && error.message
            ? error.message
            : 'حذف دسترسی ناموفق بود.';

        message.hidden = false;
      }

      buttons.forEach(function (button) {
        button.disabled = false;
      });
    }
  }

  async function load() {
    const loading = document.getElementById('roles-loading');

    if (loading) loading.hidden = false;

    let cached = null;

    if (Cache) cached = Cache.get('roles');

    if (cached) {
      state.roles = normalizeRoles(cached);
      render();
    }

    try {
      const response = await Api.get('/roles');
      const data = Api.extractData(response);

      state.roles = normalizeRoles(data);

      if (Cache) Cache.set('roles', data);

      render();

    } catch (error) {
      if (!cached) {
        showError(error.message || 'دریافت نقش‌ها ناموفق بود.');
      }
    }
  }

  function openRoleForm() {
    state.editingRoleId = null;

    openRoleFormDialog({
      Name: '',
      Code: '',
      Status: 'ACTIVE'
    }, false);
  }

  function openEditRoleForm(roleId) {
    const role = state.roles.find(function (item) {
      return String(item.ID) === String(roleId);
    });

    if (!role) {
      showError('اطلاعات نقش مورد نظر پیدا نشد.');
      return;
    }

    state.editingRoleId = role.ID;
    openRoleFormDialog(role, true);
  }

  function openRoleFormDialog(role, isEdit) {
    const content = `
      <form id="role-form">
        <div class="form-group">
          <label for="role-name">نام نقش *</label>
          <input class="form-control" id="role-name" name="Name"
            type="text" required maxlength="150"
            value="${escapeHtml(role.Name || '')}">
        </div>

        <div class="form-group">
          <label for="role-code">کد نقش *</label>
          <input class="form-control" id="role-code" name="Code"
            type="text" required maxlength="50"
            placeholder="مثلاً PRODUCTION_MANAGER"
            value="${escapeHtml(role.Code || '')}">
        </div>

        <div class="form-group">
          <label for="role-status">وضعیت</label>
          <select class="form-control" id="role-status" name="Status">
            <option value="ACTIVE"
              ${role.Status === 'ACTIVE' ? 'selected' : ''}>
              فعال
            </option>
            <option value="INACTIVE"
              ${role.Status === 'INACTIVE' ? 'selected' : ''}>
              غیرفعال
            </option>
          </select>
        </div>

        <div id="role-form-error" class="form-error" hidden></div>
      </form>
    `;

    window.PMS.Modal.open({
      id: 'role-form-modal',
      title: isEdit ? 'ویرایش نقش' : 'ایجاد نقش جدید',
      content: content,

      footer: `
        <button type="button" class="btn btn-secondary"
          id="role-cancel-button">انصراف</button>

        <button type="button" class="btn btn-primary"
          id="role-save-button">
          ${isEdit ? 'ذخیره تغییرات' : 'ثبت نقش'}
        </button>
      `,

      onOpen: function () {
        const modal = document.getElementById('role-form-modal');
        if (!modal) return;

        modal.querySelector('#role-cancel-button').addEventListener(
          'click',
          function () {
            state.editingRoleId = null;
            window.PMS.Modal.close('role-form-modal');
          }
        );

        modal.querySelector('#role-save-button').addEventListener(
          'click',
          saveRole
        );
      }
    });
  }

  async function saveRole() {
    const form = document.getElementById('role-form');
    const errorBox = document.getElementById('role-form-error');
    const saveButton = document.getElementById('role-save-button');

    if (!form || !form.reportValidity()) return;

    const data = {
      Name: form.elements.Name.value.trim(),
      Code: form.elements.Code.value.trim().toUpperCase(),
      Status: form.elements.Status.value
    };

    if (!data.Name || !data.Code) {
      errorBox.textContent = 'نام و کد نقش الزامی هستند.';
      errorBox.hidden = false;
      return;
    }

    const isEdit = state.editingRoleId !== null;
    const roleId = state.editingRoleId;

    saveButton.disabled = true;
    saveButton.textContent = isEdit
      ? 'در حال ذخیره...'
      : 'در حال ثبت...';

    try {
      if (isEdit) {
        await Api.put(
          '/roles/' + encodeURIComponent(roleId),
          data
        );
      } else {
        await Api.post('/roles', data);
      }

      if (Api.invalidate) {
        Api.invalidate('roles');
        Api.invalidate('/roles');
      }

      state.editingRoleId = null;

      window.PMS.Modal.close('role-form-modal');

      window.PMS.Alert.info(
        isEdit
          ? 'تغییرات نقش با موفقیت ذخیره شد.'
          : 'نقش جدید با موفقیت ثبت شد.'
      );

      await load();

    } catch (error) {
      errorBox.textContent = error && error.message
        ? error.message
        : 'ذخیره اطلاعات انجام نشد. دوباره تلاش کن.';

      errorBox.hidden = false;

    } finally {
      saveButton.disabled = false;
      saveButton.textContent = isEdit
        ? 'ذخیره تغییرات'
        : 'ثبت نقش';
    }
  }

  function init() {
    const search = document.getElementById('role-search');

    if (search) {
      search.addEventListener('input', function () {
        state.search = search.value || '';
        render();
      });
    }

    const createButton = document.getElementById('role-create-button');

    if (createButton) {
      createButton.addEventListener('click', openRoleForm);
    }

    load();
  }

  window.PMS.Roles = {
    init: init,
    load: load,
    render: render
  };

  window.PMS.Modules.Roles = window.PMS.Roles;

})();

(function () {
  'use strict';

  const CACHE_KEY = PMS.Cache.keys.USERS;
  const DEPARTMENTS_CACHE_KEY = PMS.Cache.keys.DEPARTMENTS;
  const ROLES_CACHE_KEY = PMS.Cache.keys.ROLES || 'pms_roles';

  const state = {
    users: [],
    departments: [],
    roles: [],
    search: '',
    saving: false
  };

  function init() {
    bindEvents();

    const cachedUsers = PMS.Cache.get(CACHE_KEY);
    const cachedDepartments = PMS.Cache.get(DEPARTMENTS_CACHE_KEY);

    if (cachedUsers !== null) {
      state.users = normalizeUsers(cachedUsers);
      render();
    }

    if (cachedDepartments !== null) {
      state.departments = normalizeList(cachedDepartments, 'departments');
    }

    loadUsers();
    loadDepartments();
  }

  function bindEvents() {
    const search = document.getElementById('user-search');

    if (search) {
      search.addEventListener('input', function () {
        state.search = search.value.trim().toLowerCase();
        render();
      });
    }

    const createButton = document.getElementById('user-create-button');

    if (createButton) {
      createButton.addEventListener('click', openCreateForm);
    }
  }

  async function loadUsers() {
    try {
      const result = await PMS.Api.getCached('/users', CACHE_KEY, {
        onRefresh: function (data) {
          state.users = normalizeUsers(data);
          render();
        },
        onError: function (error) {
          console.warn('Users refresh failed:', error);
        }
      });

      state.users = normalizeUsers(result.data);
      render();
    } catch (error) {
      showError(error);
    } finally {
      const loading = document.getElementById('users-loading');
      if (loading) loading.hidden = true;
    }
  }

  async function loadDepartments() {
    try {
      const result = await PMS.Api.getCached(
        '/departments',
        DEPARTMENTS_CACHE_KEY
      );

      state.departments = normalizeList(result.data, 'departments');
    } catch (error) {
      console.warn('Departments loading failed:', error);
    }
  }

  async function loadRoles() {
    const result = await PMS.Api.getCached('/roles', ROLES_CACHE_KEY);
    state.roles = normalizeList(result.data, 'roles');
    return state.roles;
  }

  function normalizeUsers(data) {
    return normalizeList(data, 'users');
  }

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data[key])) return data[key];
    return [];
  }

  function getUserId(user) {
    return user.ID || user.id || '';
  }

  function getFilteredUsers() {
    if (!state.search) return state.users.slice();

    return state.users.filter(function (user) {
      const text = [
        user.ID,
        user.Name,
        user.Username,
        getDepartmentName(user.DepartmentID),
        user.Status
      ].filter(Boolean).join(' ').toLowerCase();

      return text.includes(state.search);
    });
  }

  function render() {
    const container = document.getElementById('users-table-container');
    const empty = document.getElementById('users-empty');

    if (!container) return;

    const users = getFilteredUsers();

    if (!users.length) {
      container.innerHTML = '';
      container.hidden = true;

      if (empty) {
        empty.hidden = false;
        empty.textContent = state.search
          ? 'کاربر موردنظر پیدا نشد.'
          : 'کاربری برای نمایش وجود ندارد.';
      }
      return;
    }

    if (empty) empty.hidden = true;

    let html = '<table class="data-table"><thead><tr>' +
      '<th>نام و نام خانوادگی</th><th>نام کاربری</th>' +
      '<th>واحد</th><th>وضعیت</th><th>تاریخ ایجاد</th><th>عملیات</th>' +
      '</tr></thead><tbody>';

    users.forEach(function (user) {
      const id = getUserId(user);
      const name = user.Name || user.name || '-';

      html += '<tr>' +
        '<td>' + esc(name) + '</td>' +
        '<td>' + esc(user.Username || user.username || '-') + '</td>' +
        '<td>' + esc(getDepartmentName(user.DepartmentID)) + '</td>' +
        '<td>' + renderStatus(user.Status) + '</td>' +
        '<td>' + esc(formatDate(user.CreatedAt)) + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button type="button" class="btn btn-sm btn-primary user-edit-button" ' +
          'data-id="' + esc(id) + '">ویرایش</button> ' +
          '<button type="button" class="btn btn-sm btn-secondary user-roles-button" ' +
          'data-id="' + esc(id) + '" data-name="' + esc(name) + '">نقش‌ها</button>' +
        '</td>' +
        '</tr>';
    });

    container.innerHTML = html + '</tbody></table>';
    container.hidden = false;

    container.querySelectorAll('.user-edit-button').forEach(function (button) {
      button.addEventListener('click', function () {
        openEditForm(button.dataset.id);
      });
    });

    container.querySelectorAll('.user-roles-button').forEach(function (button) {
      button.addEventListener('click', function () {
        loadUserRoles(button.dataset.id, button.dataset.name);
      });
    });
  }

  async function openCreateForm() {
    try {
      await Promise.all([
        state.roles.length ? Promise.resolve() : loadRoles(),
        state.departments.length ? Promise.resolve() : loadDepartments()
      ]);

      showCreateModal();
    } catch (error) {
      showError(error);
    }
  }

  function showCreateModal() {
    closeModal();

    const modal = document.createElement('div');
    modal.id = 'user-create-modal';
    modal.className = 'modal-overlay';

    const departmentOptions = state.departments.map(function (department) {
      const id = department.ID || department.id || '';
      const name = department.Name || department.name || id;

      return '<option value="' + esc(id) + '">' + esc(name) + '</option>';
    }).join('');

    const roleOptions = state.roles.filter(function (role) {
      return String(role.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    }).map(function (role) {
      const id = role.ID || role.id || '';
      const name = role.Name || role.name || role.Code || id;
      const code = role.Code || role.code || '';

      return '<label style="display:flex;gap:8px;align-items:center;margin:8px 0">' +
        '<input type="checkbox" name="user-role" value="' + esc(id) + '">' +
        '<span>' + esc(name) + (code ? ' (' + esc(code) + ')' : '') + '</span>' +
        '</label>';
    }).join('');

    modal.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>ایجاد کاربر جدید</h3>' +
          '<button type="button" class="modal-close" id="user-create-close">×</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<form id="user-create-form">' +
            '<label>نام و نام خانوادگی *</label>' +
            '<input class="form-control" name="Name" required maxlength="150">' +
            '<label>نام کاربری *</label>' +
            '<input class="form-control" name="Username" required maxlength="100" autocomplete="username">' +
            '<label>رمز عبور</label>' +
            '<input class="form-control" name="Password" type="password" autocomplete="new-password">' +
            '<small>اگر رمز خالی باشد، ممکن است ورود کاربر امکان‌پذیر نباشد.</small>' +
            '<label>واحد سازمانی</label>' +
            '<select class="form-control" name="DepartmentID">' +
              '<option value="">بدون واحد</option>' + departmentOptions +
            '</select>' +
            '<label>وضعیت</label>' +
            '<select class="form-control" name="Status">' +
              '<option value="ACTIVE">فعال</option>' +
              '<option value="INACTIVE">غیرفعال</option>' +
            '</select>' +
            '<fieldset style="margin-top:16px">' +
              '<legend>نقش‌های کاربر</legend>' +
              (roleOptions || '<p>نقش فعالی برای انتخاب وجود ندارد.</p>') +
            '</fieldset>' +
            '<div id="user-create-error" role="alert" style="color:#b91c1c;margin-top:12px"></div>' +
            '<div style="display:flex;gap:8px;margin-top:16px">' +
              '<button class="btn btn-primary" id="user-create-save" type="submit">ثبت کاربر</button>' +
              '<button class="btn btn-secondary" id="user-create-cancel" type="button">انصراف</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('user-create-close').addEventListener('click', closeModal);
    document.getElementById('user-create-cancel').addEventListener('click', closeModal);

    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });

    document.getElementById('user-create-form').addEventListener('submit', saveNewUser);
  }

  async function saveNewUser(event) {
    event.preventDefault();

    if (state.saving) return;

    const form = event.currentTarget;
    const errorBox = document.getElementById('user-create-error');
    const saveButton = document.getElementById('user-create-save');
    const formData = new FormData(form);

    const name = String(formData.get('Name') || '').trim();
    const username = String(formData.get('Username') || '').trim();
    const password = String(formData.get('Password') || '');
    const departmentId = String(formData.get('DepartmentID') || '');
    const status = String(formData.get('Status') || 'ACTIVE');

    const roleIds = Array.from(
      form.querySelectorAll('input[name="user-role"]:checked')
    ).map(function (input) {
      return input.value;
    });

    if (!name || !username) {
      errorBox.textContent = 'نام و نام کاربری الزامی هستند.';
      return;
    }

    if (password && password.length < 8) {
      errorBox.textContent = 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
      return;
    }

    state.saving = true;
    saveButton.disabled = true;
    saveButton.textContent = 'در حال ثبت...';
    errorBox.textContent = '';

    let createdUser = null;

    try {
      const response = await PMS.Api.post('/users', {
        Name: name,
        Username: username,
        Password: password,
        DepartmentID: departmentId,
        Status: status
      });

      createdUser = PMS.Api.extractData(response);

      const userId = createdUser && (createdUser.ID || createdUser.id);

      if (!userId) {
        throw new Error('کاربر ثبت شد، اما شناسه او از سرور دریافت نشد.');
      }

      for (const roleId of roleIds) {
        await PMS.Api.post(
          '/users/' + encodeURIComponent(userId) + '/roles',
          { roleId: roleId }
        );
      }

      PMS.Api.invalidate(CACHE_KEY);
      PMS.Api.invalidate(ROLES_CACHE_KEY);

      closeModal();
      showMessage(
        roleIds.length
          ? 'کاربر ایجاد شد و نقش‌های انتخابی اختصاص داده شدند.'
          : 'کاربر با موفقیت ایجاد شد.'
      );

      await loadUsers();
    } catch (error) {
      console.error('Creating user failed:', error);

      errorBox.textContent = createdUser
        ? 'کاربر ساخته شد، اما تخصیص یکی از نقش‌ها ناموفق بود. جزئیات: ' + error.message
        : (error.message || 'ایجاد کاربر ناموفق بود.');
    } finally {
      state.saving = false;

      const currentButton = document.getElementById('user-create-save');
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = 'ثبت کاربر';
      }
    }
  }

  async function openEditForm(userId) {
    try {
      if (!state.departments.length) {
        await loadDepartments();
      }

      const user = state.users.find(function (item) {
        return String(getUserId(item)) === String(userId);
      });

      if (!user) {
        throw new Error('اطلاعات کاربر در فهرست پیدا نشد. صفحه را تازه کنید.');
      }

      showEditModal(user);
    } catch (error) {
      showError(error);
    }
  }

  function showEditModal(user) {
    closeModal();

    const userId = getUserId(user);
    const modal = document.createElement('div');
    modal.id = 'user-edit-modal';
    modal.className = 'modal-overlay';

    const currentDepartmentId = user.DepartmentID || user.departmentId || '';

    const departmentOptions = state.departments.map(function (department) {
      const id = department.ID || department.id || '';
      const name = department.Name || department.name || id;
      const selected = String(id) === String(currentDepartmentId) ? ' selected' : '';

      return '<option value="' + esc(id) + '"' + selected + '>' +
        esc(name) + '</option>';
    }).join('');

    const currentStatus = String(user.Status || user.status || 'ACTIVE').toUpperCase();

    modal.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>ویرایش اطلاعات کاربر</h3>' +
          '<button type="button" class="modal-close" id="user-edit-close">×</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<form id="user-edit-form">' +
            '<label>نام و نام خانوادگی *</label>' +
            '<input class="form-control" name="Name" required maxlength="150" value="' +
              esc(user.Name || user.name || '') + '">' +
            '<label>نام کاربری *</label>' +
            '<input class="form-control" name="Username" required maxlength="100" autocomplete="username" value="' +
              esc(user.Username || user.username || '') + '">' +
            '<label>واحد سازمانی</label>' +
            '<select class="form-control" name="DepartmentID">' +
              '<option value="">بدون واحد</option>' + departmentOptions +
            '</select>' +
            '<label>وضعیت</label>' +
            '<select class="form-control" name="Status">' +
              '<option value="ACTIVE"' + (currentStatus === 'ACTIVE' ? ' selected' : '') + '>فعال</option>' +
              '<option value="INACTIVE"' + (currentStatus === 'INACTIVE' ? ' selected' : '') + '>غیرفعال</option>' +
            '</select>' +
            '<label>رمز عبور جدید</label>' +
            '<input class="form-control" name="Password" type="password" minlength="8" autocomplete="new-password">' +
            '<small>اگر نمی‌خواهید رمز عبور تغییر کند، این قسمت را خالی بگذارید.</small>' +
            '<div id="user-edit-error" role="alert" style="color:#b91c1c;margin-top:12px"></div>' +
            '<div style="display:flex;gap:8px;margin-top:16px">' +
              '<button class="btn btn-primary" id="user-edit-save" type="submit">ذخیره تغییرات</button>' +
              '<button class="btn btn-secondary" id="user-edit-cancel" type="button">انصراف</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('user-edit-close').addEventListener('click', closeModal);
    document.getElementById('user-edit-cancel').addEventListener('click', closeModal);

    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });

    document.getElementById('user-edit-form').addEventListener('submit', function (event) {
      saveEditedUser(event, userId);
    });
  }

  async function saveEditedUser(event, userId) {
    event.preventDefault();

    if (state.saving) return;

    const form = event.currentTarget;
    const errorBox = document.getElementById('user-edit-error');
    const saveButton = document.getElementById('user-edit-save');
    const formData = new FormData(form);

    const name = String(formData.get('Name') || '').trim();
    const username = String(formData.get('Username') || '').trim();
    const password = String(formData.get('Password') || '');
    const departmentId = String(formData.get('DepartmentID') || '');
    const status = String(formData.get('Status') || 'ACTIVE');

    if (!name || !username) {
      errorBox.textContent = 'نام و نام کاربری الزامی هستند.';
      return;
    }

    if (password && password.length < 8) {
      errorBox.textContent = 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.';
      return;
    }

    const payload = {
      Name: name,
      Username: username,
      DepartmentID: departmentId,
      Status: status
    };

    // رمز فقط در صورت وارد شدن به درخواست ارسال می‌شود.
    if (password) {
      payload.Password = password;
    }

    state.saving = true;
    saveButton.disabled = true;
    saveButton.textContent = 'در حال ذخیره...';
    errorBox.textContent = '';

    try {
      await PMS.Api.put(
        '/users/' + encodeURIComponent(userId),
        payload
      );

      PMS.Api.invalidate(CACHE_KEY);
      PMS.Cache.remove(CACHE_KEY);

      closeModal();
      showMessage('تغییرات کاربر با موفقیت ذخیره شد.');

      await loadUsers();
    } catch (error) {
      console.error('Updating user failed:', error);
      errorBox.textContent = error.message || 'ذخیره تغییرات ناموفق بود.';
    } finally {
      state.saving = false;

      const currentButton = document.getElementById('user-edit-save');
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = 'ذخیره تغییرات';
      }
    }
  }

async function loadUserRoles(userId, userName) {
  const modalId = 'user-roles-modal';

  // اگر درخواست همین کاربر در حال اجراست، درخواست تکراری نفرست.
  const existingModal = document.getElementById(modalId);

  if (
    existingModal &&
    existingModal.dataset.userId === String(userId) &&
    existingModal.dataset.loading === 'true'
  ) {
    return;
  }

  // پنجره را قبل از درخواست سرور نمایش بده.
  showUserRolesModal(userName, [], true, userId);

  const modal = document.getElementById(modalId);

  if (!modal) return;

  try {
    const response = await PMS.Api.get(
      '/users/' + encodeURIComponent(userId) + '/roles'
    );

    const assignedData = PMS.Api.extractData(response);
    const assignedItems = normalizeList(assignedData, 'roles');

    const hasRoleNames = assignedItems.some(function (item) {
      return item.Name || item.name || item.RoleName || item.roleName;
    });

    let assignedRoles;

    if (hasRoleNames) {
      assignedRoles = assignedItems;
    } else {
      if (!state.roles.length) {
        await loadRoles();
      }

      assignedRoles = assignedItems.map(function (item) {
        const roleId = item.RoleID || item.roleId || item.ID || item.id;

        const matchedRole = state.roles.find(function (role) {
          const id = role.ID || role.id;
          return String(id) === String(roleId);
        });

        return matchedRole || {
          ID: roleId || '',
          Name: roleId
            ? 'نقش با شناسه ' + roleId
            : 'نامشخص',
          Code: '-',
          Status: '-'
        };
      });
    }

    // اگر پنجره در این فاصله بسته شده، آن را دوباره باز نکن.
    const currentModal = document.getElementById(modalId);

    if (!currentModal || currentModal.dataset.userId !== String(userId)) {
      return;
    }

    showUserRolesModal(userName, assignedRoles, false, userId);

  } catch (error) {
    console.error('Loading user roles failed:', error);

    const currentModal = document.getElementById(modalId);

    if (currentModal && currentModal.dataset.userId === String(userId)) {
      const body = currentModal.querySelector('.modal-body');

      if (body) {
        body.innerHTML =
          '<div class="table-empty" role="alert">' +
          'دریافت نقش‌ها ناموفق بود. ' +
          esc(error && error.message ? error.message : 'لطفاً دوباره تلاش کنید.') +
          '</div>';
      }

      currentModal.dataset.loading = 'false';
    }
  }
}

function showUserRolesModal(userName, data, loading, userId) {
  const roles = normalizeList(data, 'roles');

  let rows = '';

  roles.forEach(function (role) {
    rows += '<tr><td>' +
      esc(role.Name || role.name || role.RoleName || role.roleName || '-') +
      '</td><td>' +
      esc(role.Code || role.code || '-') +
      '</td><td>' +
      renderStatus(role.Status || role.status || '-') +
      '</td></tr>';
  });

  let content;

  if (loading) {
    content =
      '<div class="table-empty" style="padding:28px;text-align:center">' +
      '<span style="display:inline-block;margin-left:8px">' +
      '⏳' +
      '</span>' +
      'در حال دریافت نقش‌های کاربر...' +
      '</div>';
  } else {
    content = roles.length
      ? '<table class="data-table"><thead><tr>' +
        '<th>نام نقش</th><th>کد نقش</th><th>وضعیت</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>'
      : '<div class="table-empty">نقشی برای این کاربر ثبت نشده است.</div>';
  }

  closeModal();

  const modal = document.createElement('div');
  modal.id = 'user-roles-modal';
  modal.className = 'modal-overlay';
  modal.dataset.userId = String(userId || '');
  modal.dataset.loading = loading ? 'true' : 'false';

  modal.innerHTML =
    '<div class="modal">' +
      '<div class="modal-header">' +
        '<h3>نقش‌های کاربر: ' + esc(userName) + '</h3>' +
        '<button type="button" class="modal-close" aria-label="بستن">×</button>' +
      '</div>' +
      '<div class="modal-body">' + content + '</div>' +
    '</div>';

  document.body.appendChild(modal);

  modal.querySelector('.modal-close').addEventListener('click', function () {
    modal.remove();
  });

  modal.addEventListener('click', function (event) {
    if (event.target === modal) {
      modal.remove();
    }
  });
}
  function closeModal() {
    [
      'user-create-modal',
      'user-edit-modal',
      'user-roles-modal'
    ].forEach(function (id) {
      const element = document.getElementById(id);
      if (element) element.remove();
    });
  }

  function getDepartmentName(departmentId) {
    if (!departmentId) return '-';

    const department = state.departments.find(function (item) {
      return String(item.ID || item.id) === String(departmentId);
    });

    return department
      ? (department.Name || department.name || departmentId)
      : departmentId;
  }

  function renderStatus(status) {
    const value = String(status || '').toUpperCase();
    const label = value === 'ACTIVE'
      ? 'فعال'
      : value === 'INACTIVE'
        ? 'غیرفعال'
        : (status || '-');

    return '<span class="status-badge status-' +
      esc(value.toLowerCase()) + '">' + esc(label) + '</span>';
  }

  function formatDate(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString('fa-IR');
  }

  function showError(error) {
    showMessage(error && error.message ? error.message : 'خطایی رخ داد.');
  }

  function showMessage(message) {
    if (window.PMS && PMS.Alert && typeof PMS.Alert.info === 'function') {
      PMS.Alert.info(message);
    } else {
      alert(message);
    }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  window.PMS.Users = {
    init: init,
    load: loadUsers,
    render: render
  };

  window.PMS.Modules.Users = window.PMS.Users;
})();

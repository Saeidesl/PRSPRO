
(function () {
  'use strict';

  const CACHE_KEY = PMS.Cache.keys.EVENT_TYPES;

  const state = {
    eventTypes: [],
    search: '',
    selectedEventTypeId: null,
    selectedEventTypeName: '',
    fields: [],
    departments: [],
    workflows: [],
    workflowSteps: [],
    modalBusy: false
  };

  const CATEGORY_OPTIONS = [
    { value: 'PROCESS', label: 'فرآیند' },
    { value: 'MATERIAL', label: 'مواد' },
    { value: 'QUALITY', label: 'کیفیت' },
    { value: 'WAREHOUSE', label: 'انبار' },
    { value: 'ADMIN', label: 'اداری' },
    { value: 'SYSTEM', label: 'سیستم' }
  ];

  const FIELD_TYPE_OPTIONS = [
    { value: 'text', label: 'متن' },
    { value: 'number', label: 'عدد' },
    { value: 'date', label: 'تاریخ' },
    { value: 'datetime', label: 'تاریخ و زمان' },
    { value: 'select', label: 'فهرست انتخابی' },
    { value: 'textarea', label: 'متن چندخطی' },
    { value: 'boolean', label: 'بله/خیر' }
  ];

  function init() {
    bindEvents();

    const cached = PMS.Cache.get(CACHE_KEY);

    if (cached !== null) {
      state.eventTypes = normalizeEventTypes(cached);
      render();
    }

    loadEventTypes();
  }

  function bindEvents() {
    const searchInput = document.getElementById('event-type-search');

    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';

      searchInput.addEventListener('input', function (event) {
        state.search = event.target.value.trim().toLowerCase();
        render();
      });
    }

    const createButton = document.getElementById('event-type-create-button');

    if (createButton && !createButton.dataset.bound) {
      createButton.dataset.bound = 'true';

      createButton.addEventListener('click', function () {
        openEventTypeForm(null);
      });
    }
  }

  async function loadEventTypes() {
    const loading = document.getElementById('event-types-loading');
    const errorBox = document.getElementById('event-types-error');

    if (loading && state.eventTypes.length === 0) {
      loading.hidden = false;
    }

    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }

    try {
      const result = await PMS.Api.getCached(
        '/event-types',
        CACHE_KEY,
        {
          onRefresh: function (data) {
            state.eventTypes = normalizeEventTypes(data);
            render();
          },
          onError: function (error) {
            console.warn('Event Types refresh failed:', error);
            showError(error, state.eventTypes.length > 0);
          }
        }
      );

      state.eventTypes = normalizeEventTypes(
        result && result.data !== undefined ? result.data : result
      );

      render();
    } catch (error) {
      console.error('Event Types loading failed:', error);

      if (state.eventTypes.length === 0) {
        showError(error, false);
      }
    } finally {
      if (loading) loading.hidden = true;
    }
  }

  function normalizeEventTypes(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.eventTypes)) return data.eventTypes;
    if (data && data.data) return normalizeEventTypes(data.data);
    return [];
  }

  function normalizeFields(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.fields)) return data.fields;
    if (data && data.data) return normalizeFields(data.data);
    return [];
  }

  function normalizeList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.departments)) return data.departments;
    if (data && Array.isArray(data.workflows)) return data.workflows;
    if (data && data.data) return normalizeList(data.data);
    return [];
  }

  function getId(item) {
    return item && (item.ID || item.id) || '';
  }

  function getName(item) {
    return item && (item.Name || item.name) || '';
  }

  function getFilteredEventTypes() {
    let result = state.eventTypes.slice();

    if (state.search) {
      result = result.filter(function (item) {
        const searchable = [
          item.ID, item.Name, item.name,
          item.Code, item.code,
          item.Description, item.description,
          item.Category, item.category,
          item.Status, item.status
        ].filter(Boolean).join(' ').toLowerCase();

        return searchable.indexOf(state.search) !== -1;
      });
    }

    return result;
  }

  function render() {
    const container = document.getElementById('event-types-table-container');
    const empty = document.getElementById('event-types-empty');

    if (!container) return;

    const eventTypes = getFilteredEventTypes();

    if (eventTypes.length === 0) {
      container.innerHTML = '';
      container.hidden = true;

      if (empty) {
        empty.hidden = false;
        empty.textContent = state.search
          ? 'نوع رویداد موردنظر پیدا نشد.'
          : 'نوع رویدادی برای نمایش وجود ندارد.';
      }

      return;
    }

    if (empty) empty.hidden = true;

    let html = '<table class="data-table"><thead><tr>';
    html += '<th>نام نوع رویداد</th>';
    html += '<th>کد</th>';
    html += '<th>دسته‌بندی</th>';
    html += '<th>نسخه</th>';
    html += '<th>وضعیت</th>';
    html += '<th>فایل پیوست</th>';
    html += '<th>عملیات</th>';
    html += '</tr></thead><tbody>';

    eventTypes.forEach(function (item) {
      const id = getId(item);
      const name = getName(item) || '-';
      const code = item.Code || item.code || '-';
      const category = item.Category || item.category || '-';
      const version = item.Version || item.version || '-';
      const status = item.Status || item.status || '-';
      const allowAttachments =
        item.AllowAttachments === true ||
        String(item.AllowAttachments).toLowerCase() === 'true';

      html += '<tr>';
      html += '<td>' + escapeHtml(name) + '</td>';
      html += '<td>' + escapeHtml(code) + '</td>';
      html += '<td>' + escapeHtml(categoryLabel(category)) + '</td>';
      html += '<td>' + escapeHtml(String(version)) + '</td>';
      html += '<td>' + renderStatus(status) + '</td>';
      html += '<td>' + (allowAttachments ? 'مجاز' : 'غیرمجاز') + '</td>';
      html += '<td class="event-type-actions">';

      html += '<button type="button" class="btn btn-sm btn-secondary event-type-edit" data-id="' +
        escapeAttribute(id) + '">ویرایش</button> ';

      html += '<button type="button" class="btn btn-sm btn-secondary event-type-fields" data-id="' +
        escapeAttribute(id) + '" data-name="' + escapeAttribute(name) +
        '">فیلدهای پویا</button>';

      html += '</td></tr>';
    });

    html += '</tbody></table>';

    container.innerHTML = html;
    container.hidden = false;

    container.querySelectorAll('.event-type-edit').forEach(function (button) {
      button.addEventListener('click', function () {
        openEventTypeForm(button.dataset.id);
      });
    });

    container.querySelectorAll('.event-type-fields').forEach(function (button) {
      button.addEventListener('click', function () {
        loadFields(button.dataset.id, button.dataset.name);
      });
    });
  }

  async function openEventTypeForm(eventTypeId) {
    const editing = Boolean(eventTypeId);
    const item = editing
      ? state.eventTypes.find(function (entry) {
          return String(getId(entry)) === String(eventTypeId);
        })
      : null;

    if (editing && !item) {
      showMessage('نوع رویداد انتخاب‌شده پیدا نشد.');
      return;
    }

    let departments = state.departments;

    try {
      if (!departments.length) {
        const result = await PMS.Api.get('/departments');
        departments = normalizeList(result && result.data !== undefined ? result.data : result);
        state.departments = departments;
      }
    } catch (error) {
      console.error('Departments loading failed:', error);
      showMessage('دریافت فهرست بخش‌ها ناموفق بود. لطفاً دوباره تلاش کن.');
      return;
    }

    const modal = createModal(
      editing ? 'ویرایش نوع رویداد' : 'ثبت نوع رویداد',
      'event-type-form-modal'
    );

    const categoryOptions = CATEGORY_OPTIONS.map(function (option) {
      return '<option value="' + option.value + '">' +
        escapeHtml(option.label) + '</option>';
    }).join('');

    const departmentOptions = '<option value="">انتخاب بخش</option>' +
      departments.filter(isActive).map(function (department) {
        return '<option value="' + escapeAttribute(getId(department)) + '">' +
          escapeHtml(getName(department)) + '</option>';
      }).join('');

    const status = item && item.Status || 'ACTIVE';
    const allowAttachments = item && (
      item.AllowAttachments === true ||
      String(item.AllowAttachments).toLowerCase() === 'true'
    );

    modal.body.innerHTML =
      '<form id="event-type-form">' +
        '<div class="form-group"><label for="et-name">نام نوع رویداد *</label>' +
        '<input id="et-name" name="Name" required maxlength="150"></div>' +

        '<div class="form-group"><label for="et-code">کد نوع رویداد *</label>' +
        '<input id="et-code" name="Code" required maxlength="100"></div>' +

        '<div class="form-group"><label for="et-description">توضیحات</label>' +
        '<textarea id="et-description" name="Description" rows="3"></textarea></div>' +

        '<div class="form-group"><label for="et-category">دسته‌بندی</label>' +
        '<select id="et-category" name="Category"><option value="">انتخاب دسته‌بندی</option>' +
        categoryOptions + '</select></div>' +

        '<div class="form-group"><label for="et-department">بخش مرتبط</label>' +
        '<select id="et-department" name="DepartmentID">' +
        departmentOptions + '</select></div>' +

        '<div class="form-group"><label for="et-version">نسخه</label>' +
        '<input id="et-version" name="Version" type="number" min="1" step="1"></div>' +

        '<div class="form-group"><label for="et-status">وضعیت</label>' +
        '<select id="et-status" name="Status">' +
        '<option value="ACTIVE">فعال</option>' +
        '<option value="INACTIVE">غیرفعال</option>' +
        '</select></div>' +

        '<div class="form-group"><label>' +
        '<input id="et-attachments" name="AllowAttachments" type="checkbox"> اجازه فایل پیوست</label></div>' +

        '<div class="form-group"><label>' +
        '<input id="et-moves" name="MovesProjectToStep" type="checkbox"> این رویداد پروژه را به مرحله دیگری منتقل می‌کند</label></div>' +

        '<div class="form-group" id="et-step-help">' +
        '<small>مرحله مقصد بر اساس تخصیص بخش به مرحله در Workflow پروژه تعیین می‌شود. انتخاب مستقیم مرحله در این فرم انجام نمی‌شود.</small>' +
        '</div>' +

        '<div class="modal-actions">' +
        '<button type="submit" class="btn btn-primary">' +
        (editing ? 'ذخیره تغییرات' : 'ثبت نوع رویداد') + '</button>' +
        '<button type="button" class="btn btn-secondary" id="et-cancel">انصراف</button>' +
        '</div>' +
      '</form>';

    if (item) {
      modal.body.querySelector('#et-name').value = item.Name || '';
      modal.body.querySelector('#et-code').value = item.Code || '';
      modal.body.querySelector('#et-description').value = item.Description || '';
      modal.body.querySelector('#et-category').value = item.Category || '';
      modal.body.querySelector('#et-department').value = item.DepartmentID || '';
      modal.body.querySelector('#et-version').value = item.Version || 1;
      modal.body.querySelector('#et-status').value = status;
      modal.body.querySelector('#et-attachments').checked = Boolean(allowAttachments);
      modal.body.querySelector('#et-moves').checked =
        item.MovesProjectToStep === true ||
        String(item.MovesProjectToStep).toLowerCase() === 'true';
    } else {
      modal.body.querySelector('#et-version').value = 1;
    }

    modal.body.querySelector('#et-cancel').addEventListener('click', modal.close);

    modal.body.querySelector('#event-type-form').addEventListener('submit', async function (event) {
      event.preventDefault();

      const form = event.currentTarget;
      const saveButton = form.querySelector('[type="submit"]');

      const payload = {
        Name: form.Name.value.trim(),
        Code: form.Code.value.trim(),
        Description: form.Description.value.trim(),
        Category: form.Category.value,
        DepartmentID: form.DepartmentID.value,
        Version: Number(form.Version.value || 1),
        Status: form.Status.value,
        AllowAttachments: form.AllowAttachments.checked,
        MovesProjectToStep: form.MovesProjectToStep.checked
      };

      if (!payload.Name || !payload.Code) {
        showMessage('نام و کد نوع رویداد الزامی است.');
        return;
      }

      if (!Number.isFinite(payload.Version) || payload.Version < 1) {
        showMessage('نسخه باید عددی برابر یا بزرگ‌تر از ۱ باشد.');
        return;
      }

      setButtonBusy(saveButton, true, 'در حال ذخیره...');

      try {
        if (editing) {
          await PMS.Api.put(
            '/event-types/' + encodeURIComponent(eventTypeId),
            payload
          );
        } else {
          await PMS.Api.post('/event-types', payload);
        }

        modal.close();
        invalidateEventTypeCaches();
        showMessage(editing ? 'نوع رویداد ویرایش شد.' : 'نوع رویداد ثبت شد.');
        await loadEventTypes();
      } catch (error) {
        console.error('Saving event type failed:', error);
        showMessage(error.message || 'ذخیره نوع رویداد ناموفق بود.');
      } finally {
        setButtonBusy(saveButton, false);
      }
    });
  }

  async function loadFields(eventTypeId, eventTypeName) {
    state.selectedEventTypeId = eventTypeId;
    state.selectedEventTypeName = eventTypeName || '';

    const cacheKey = PMS.Cache.keys.EVENT_FIELDS + '_' + eventTypeId;
    const cached = PMS.Cache.get(cacheKey);

    if (cached !== null) {
      state.fields = normalizeFields(cached);
      showFieldsModal();
    }

    try {
      const result = await PMS.Api.getCached(
        '/event-types/' + encodeURIComponent(eventTypeId) + '/fields',
        cacheKey,
        {
          onRefresh: function (data) {
            state.fields = normalizeFields(data);
            showFieldsModal();
          },
          onError: function (error) {
            console.warn('Event fields refresh failed:', error);
          }
        }
      );

      state.fields = normalizeFields(
        result && result.data !== undefined ? result.data : result
      );

      showFieldsModal();
    } catch (error) {
      console.error('Event fields loading failed:', error);

      if (cached === null) {
        showMessage(error.message || 'دریافت فیلدهای پویا ناموفق بود.');
      }
    }
  }

  function showFieldsModal() {
    const eventTypeId = state.selectedEventTypeId;
    const eventTypeName = state.selectedEventTypeName;

    const modal = createModal(
      'فیلدهای پویا: ' + (eventTypeName || ''),
      'event-type-fields-modal'
    );

    let html =
      '<div class="modal-actions" style="margin-bottom:12px">' +
      '<button type="button" class="btn btn-primary" id="field-create-button">+ افزودن فیلد</button>' +
      '</div>';

    const fields = state.fields.slice().sort(function (a, b) {
      return Number(a.FieldOrder || 0) - Number(b.FieldOrder || 0);
    });

    if (fields.length === 0) {
      html += '<div class="table-empty">فیلد پویایی برای این نوع رویداد ثبت نشده است.</div>';
    } else {
      html += '<div class="table-wrapper"><table class="data-table"><thead><tr>' +
        '<th>ترتیب</th><th>نام فیلد</th><th>کد</th><th>نوع</th>' +
        '<th>اجباری</th><th>مقدار پیش‌فرض</th><th>وضعیت</th><th>عملیات</th>' +
        '</tr></thead><tbody>';

      fields.forEach(function (field) {
        const id = getId(field);
        const required =
          field.IsRequired === true ||
          String(field.IsRequired).toLowerCase() === 'true';

        const active = String(field.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';

        html += '<tr>';
        html += '<td>' + escapeHtml(String(field.FieldOrder || 0)) + '</td>';
        html += '<td>' + escapeHtml(field.Name || '-') + '</td>';
        html += '<td>' + escapeHtml(field.Code || '-') + '</td>';
        html += '<td>' + escapeHtml(fieldTypeLabel(field.FieldType)) + '</td>';
        html += '<td>' + (required ? 'بله' : 'خیر') + '</td>';
        html += '<td>' + escapeHtml(field.DefaultValue || '-') + '</td>';
        html += '<td>' + renderStatus(field.Status || 'ACTIVE') + '</td>';
        html += '<td>';

        html += '<button type="button" class="btn btn-sm btn-secondary field-edit" data-id="' +
          escapeAttribute(id) + '">ویرایش</button> ';

        if (active) {
          html += '<button type="button" class="btn btn-sm btn-secondary field-disable" data-id="' +
            escapeAttribute(id) + '">غیرفعال‌سازی</button>';
        }

        html += '</td></tr>';
      });

      html += '</tbody></table></div>';
    }

    modal.body.innerHTML = html;

    modal.body.querySelector('#field-create-button').addEventListener('click', function () {
      openFieldForm(null);
    });

    modal.body.querySelectorAll('.field-edit').forEach(function (button) {
      button.addEventListener('click', function () {
        const field = state.fields.find(function (entry) {
          return String(getId(entry)) === String(button.dataset.id);
        });

        if (field) openFieldForm(field);
      });
    });

    modal.body.querySelectorAll('.field-disable').forEach(function (button) {
      button.addEventListener('click', function () {
        disableField(button.dataset.id);
      });
    });
  }

  function openFieldForm(field) {
    const eventTypeId = state.selectedEventTypeId;
    const editing = Boolean(field);
    const modal = createModal(
      editing ? 'ویرایش فیلد پویا' : 'افزودن فیلد پویا',
      'event-field-form-modal'
    );

    const typeOptions = FIELD_TYPE_OPTIONS.map(function (option) {
      return '<option value="' + option.value + '">' +
        escapeHtml(option.label) + '</option>';
    }).join('');

    modal.body.innerHTML =
      '<form id="event-field-form">' +
        '<div class="form-group"><label for="ef-name">نام فیلد *</label>' +
        '<input id="ef-name" name="Name" required maxlength="150"></div>' +

        '<div class="form-group"><label for="ef-code">کد فیلد *</label>' +
        '<input id="ef-code" name="Code" required maxlength="100"></div>' +

        '<div class="form-group"><label for="ef-type">نوع فیلد *</label>' +
        '<select id="ef-type" name="FieldType" required>' +
        typeOptions + '</select></div>' +

        '<div class="form-group"><label>' +
        '<input type="checkbox" name="IsRequired" id="ef-required"> فیلد اجباری است</label></div>' +

        '<div class="form-group"><label for="ef-default">مقدار پیش‌فرض</label>' +
        '<input id="ef-default" name="DefaultValue"></div>' +

        '<div class="form-group"><label for="ef-options">گزینه‌ها (برای فهرست انتخابی، هر گزینه در یک خط)</label>' +
        '<textarea id="ef-options" name="Options" rows="3"></textarea></div>' +

        '<div class="form-group"><label for="ef-validation">قاعده اعتبارسنجی (اختیاری)</label>' +
        '<input id="ef-validation" name="ValidationRule"></div>' +

        '<div class="form-group"><label for="ef-order">ترتیب نمایش</label>' +
        '<input id="ef-order" name="FieldOrder" type="number" min="0" step="1"></div>' +

        '<div class="form-group"><label for="ef-status">وضعیت</label>' +
        '<select id="ef-status" name="Status">' +
        '<option value="ACTIVE">فعال</option>' +
        '<option value="INACTIVE">غیرفعال</option>' +
        '</select></div>' +

        '<div class="modal-actions">' +
        '<button type="submit" class="btn btn-primary">' +
        (editing ? 'ذخیره تغییرات' : 'افزودن فیلد') + '</button>' +
        '<button type="button" class="btn btn-secondary" id="ef-cancel">انصراف</button>' +
        '</div>' +
      '</form>';

    const form = modal.body.querySelector('#event-field-form');

    if (field) {
      form.Name.value = field.Name || '';
      form.Code.value = field.Code || '';
      form.FieldType.value = field.FieldType || 'text';
      form.IsRequired.checked =
        field.IsRequired === true ||
        String(field.IsRequired).toLowerCase() === 'true';
      form.DefaultValue.value = field.DefaultValue || '';
      form.Options.value = field.Options || '';
      form.ValidationRule.value = field.ValidationRule || '';
      form.FieldOrder.value = field.FieldOrder || 0;
      form.Status.value = field.Status || 'ACTIVE';
    } else {
      form.FieldOrder.value = state.fields.length + 1;
    }

    form.querySelector('#ef-cancel').addEventListener('click', modal.close);

    form.querySelector('#ef-type').addEventListener('change', function () {
      const options = form.querySelector('#ef-options');
      options.disabled = form.FieldType.value !== 'select';
      if (options.disabled) options.value = '';
    });

    form.querySelector('#ef-type').dispatchEvent(new Event('change'));

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const saveButton = form.querySelector('[type="submit"]');
      const payload = {
        Name: form.Name.value.trim(),
        Code: form.Code.value.trim(),
        FieldType: form.FieldType.value,
        IsRequired: form.IsRequired.checked,
        DefaultValue: form.DefaultValue.value,
        Options: form.Options.value,
        ValidationRule: form.ValidationRule.value,
        FieldOrder: Number(form.FieldOrder.value || 0),
        Status: form.Status.value
      };

      if (!payload.Name || !payload.Code) {
        showMessage('نام و کد فیلد الزامی است.');
        return;
      }

      if (!Number.isFinite(payload.FieldOrder) || payload.FieldOrder < 0) {
        showMessage('ترتیب نمایش باید صفر یا عددی مثبت باشد.');
        return;
      }

      if (payload.FieldType === 'select' && !payload.Options.trim()) {
        showMessage('برای فیلد انتخابی، گزینه‌ها را وارد کن.');
        return;
      }

      setButtonBusy(saveButton, true, 'در حال ذخیره...');

      try {
        if (editing) {
          await PMS.Api.put(
            '/event-fields/' + encodeURIComponent(getId(field)),
            payload
          );
        } else {
          payload.EventTypeID = eventTypeId;
          await PMS.Api.post(
            '/event-types/' + encodeURIComponent(eventTypeId) + '/fields',
            payload
          );
        }

        modal.close();
        invalidateFieldCache(eventTypeId);
        showMessage(editing ? 'فیلد پویا ویرایش شد.' : 'فیلد پویا اضافه شد.');
        await loadFields(eventTypeId, state.selectedEventTypeName);
      } catch (error) {
        console.error('Saving event field failed:', error);
        showMessage(error.message || 'ذخیره فیلد ناموفق بود.');
      } finally {
        setButtonBusy(saveButton, false);
      }
    });
  }

  async function disableField(fieldId) {
    const confirmed = window.confirm(
      'این فیلد غیرفعال می‌شود و اطلاعات رویدادهای قبلی حذف نخواهد شد. ادامه می‌دهی؟'
    );

    if (!confirmed) return;

    try {
      await PMS.Api.delete('/event-fields/' + encodeURIComponent(fieldId));

      invalidateFieldCache(state.selectedEventTypeId);
      showMessage('فیلد غیرفعال شد.');
      await loadFields(
        state.selectedEventTypeId,
        state.selectedEventTypeName
      );
    } catch (error) {
      console.error('Disabling event field failed:', error);
      showMessage(error.message || 'غیرفعال‌سازی فیلد ناموفق بود.');
    }
  }

  function createModal(title, id) {
    const previous = document.getElementById(id);
    if (previous) previous.remove();

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'modal-overlay';

    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>' + escapeHtml(title) + '</h3>' +
          '<button type="button" class="modal-close" aria-label="بستن">×</button>' +
        '</div>' +
        '<div class="modal-body"></div>' +
      '</div>';

    document.body.appendChild(overlay);

    const close = function () {
      overlay.remove();
    };

    overlay.querySelector('.modal-close').addEventListener('click', close);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) close();
    });

    return {
      overlay: overlay,
      body: overlay.querySelector('.modal-body'),
      close: close
    };
  }

  function invalidateEventTypeCaches() {
    if (PMS.Cache && typeof PMS.Cache.invalidate === 'function') {
      PMS.Cache.invalidate(CACHE_KEY);
    }

    if (PMS.Cache && typeof PMS.Cache.remove === 'function') {
      PMS.Cache.remove(CACHE_KEY);
    }
  }

  function invalidateFieldCache(eventTypeId) {
    const cacheKey = PMS.Cache.keys.EVENT_FIELDS + '_' + eventTypeId;

    if (PMS.Cache && typeof PMS.Cache.invalidate === 'function') {
      PMS.Cache.invalidate(cacheKey);
    }

    if (PMS.Cache && typeof PMS.Cache.remove === 'function') {
      PMS.Cache.remove(cacheKey);
    }
  }

  function isActive(item) {
    return String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;

    if (busy) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = label || 'در حال انجام...';
    } else {
      button.disabled = false;
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function categoryLabel(value) {
    const option = CATEGORY_OPTIONS.find(function (item) {
      return item.value === String(value || '').toUpperCase();
    });

    return option ? option.label : (value || '-');
  }

  function fieldTypeLabel(value) {
    const option = FIELD_TYPE_OPTIONS.find(function (item) {
      return item.value === String(value || '').toLowerCase();
    });

    return option ? option.label : (value || '-');
  }

  function renderStatus(status) {
    const value = String(status || '').toUpperCase();
    const labels = {
      ACTIVE: 'فعال',
      INACTIVE: 'غیرفعال',
      DELETED: 'حذف‌شده',
      VOID: 'باطل'
    };

    return '<span class="status-badge status-' +
      escapeAttribute(value.toLowerCase()) + '">' +
      escapeHtml(labels[value] || status || '-') + '</span>';
  }

  function showError(error, cachedAvailable) {
    const errorBox = document.getElementById('event-types-error');
    if (!errorBox) return;

    errorBox.textContent = cachedAvailable
      ? 'اتصال به سرور برقرار نشد؛ اطلاعات ذخیره‌شده نمایش داده می‌شود.'
      : (error && error.message ? error.message : 'دریافت انواع رویداد با خطا مواجه شد.');

    errorBox.hidden = false;
  }

  function showMessage(message) {
    if (window.PMS && PMS.Alert && typeof PMS.Alert.info === 'function') {
      PMS.Alert.info(message);
    } else {
      window.alert(message);
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

  window.PMS.EventTypes = {
    init: init,
    load: loadEventTypes,
    render: render
  };

  window.PMS.Modules.EventTypes = window.PMS.EventTypes;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

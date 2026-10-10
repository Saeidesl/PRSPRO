(function () {
  'use strict';

  const Layout = {
    navItems: [
      { route: 'dashboard', label: 'داشبورد', icon: '⌂' },
      { route: 'projects', label: 'پروژه‌ها', icon: '▣' },
      { route: 'events', label: 'رویدادها', icon: '◈' },
      { route: 'workflows', label: 'Workflowها', icon: '↔' },
      { route: 'event-types', label: 'انواع رویداد', icon: '⚙' },
      { route: 'attachments', label: 'فایل‌ها', icon: '▤' },
      { route: 'reports', label: 'گزارش‌ها', icon: '▥' },
      { route: 'users', label: 'کاربران', icon: '♙' },
      { route: 'departments', label: 'واحدها', icon: '▦' },
      { route: 'roles', label: 'نقش‌ها', icon: '♟' },
      { route: 'permissions', label: 'دسترسی‌ها', icon: '✓' },
      { route: 'audit', label: 'گزارش فعالیت‌ها', icon: '◷' },
      { route: 'settings', label: 'تنظیمات', icon: '⚙' },
      { route: 'admin', label: 'مدیریت سامانه', icon: '▦' }
    ],

    syncListener: null,
    userDetailsRequest: null,

    isAdmin: function (user) {
      user = user || this.getCurrentUser() || {};

      return (
        user.IsAdmin === true ||
        String(user.IsAdmin).toLowerCase() === 'true' ||
        String(user.DepartmentCode || '').trim().toUpperCase() === 'ADMIN'
      );
    },

    getVisibleNavItems: function () {
      if (this.isAdmin()) {
        return this.navItems;
      }

      return this.navItems.filter(function (item) {
        return item.route === 'events';
      });
    },

    render: function () {
      const app = document.getElementById('app');
      if (!app) return;

      app.innerHTML = `
        <div class="app-layout">
          <aside class="app-sidebar" id="app-sidebar">
            <div class="sidebar-header">
              <div class="sidebar-brand">
                <div class="sidebar-brand-icon">P</div>
                <div class="sidebar-brand-text">
                  <div class="sidebar-brand-title">مدیریت تولید</div>
                  <div class="sidebar-brand-subtitle">Production Management</div>
                </div>
              </div>
            </div>

            <nav class="sidebar-nav">
              <ul class="sidebar-nav-list">
                ${this.renderNavItems()}
              </ul>
            </nav>

            <div class="sidebar-footer">
              <div class="sidebar-user">
                <div class="sidebar-user-avatar" id="sidebar-user-avatar">-</div>
                <div class="sidebar-user-info">
                  <div class="sidebar-user-name" id="sidebar-user-name">کاربر</div>
                  <div class="sidebar-user-role" id="sidebar-user-role">کاربر رویدادها</div>
                </div>
              </div>
            </div>
          </aside>

          <div class="sidebar-overlay" id="sidebar-overlay"></div>

          <main class="app-main">
            <header class="app-header">
              <div class="app-header-left">
                <button
                  type="button"
                  class="sidebar-toggle"
                  id="sidebar-toggle"
                  aria-label="باز کردن منو"
                >☰</button>

                <h1 class="app-header-title" id="app-header-title">رویدادها</h1>
              </div>

              <div class="app-header-right">
                <div
                  class="header-sync-status status-idle"
                  id="header-sync-status"
                  role="status"
                  aria-live="polite"
                  title="وضعیت درخواست‌های دریافت اطلاعات"
                >
                  <span class="sync-status-dot"></span>
                  <span class="sync-status-text" id="sync-status-text">
                    در انتظار دریافت اطلاعات
                  </span>
                </div>

                <div class="header-user">
                  <div class="header-user-avatar" id="header-user-avatar">-</div>
                  <div class="header-user-details">
                    <span class="header-user-name" id="header-user-name">کاربر</span>
                    <span class="header-user-meta" id="header-user-meta">کاربر رویدادها</span>
                  </div>
                </div>

                <button
                  type="button"
                  class="btn btn-light btn-sm"
                  id="logout-button"
                >خروج</button>
              </div>
            </header>

            <div class="page-content" id="page-content"></div>
          </main>
        </div>
      `;

      this.bindEvents();
      this.updateUser();
      this.bindSyncStatus();
      this.setActiveRoute();

      // دریافت اطلاعات مدیریتی فقط برای ادمین
      if (this.isAdmin()) {
        this.loadUserDetails();
      }
    },

    renderNavItems: function () {
      return this.getVisibleNavItems().map((item) => `
        <li class="sidebar-nav-item">
          <a
            href="#${this.escapeHtml(item.route)}"
            class="sidebar-nav-link"
            data-route="${this.escapeHtml(item.route)}"
          >
            <span class="sidebar-nav-icon">${this.escapeHtml(item.icon)}</span>
            <span class="sidebar-nav-label">${this.escapeHtml(item.label)}</span>
          </a>
        </li>
      `).join('');
    },

    bindEvents: function () {
      const toggle = document.getElementById('sidebar-toggle');
      const overlay = document.getElementById('sidebar-overlay');
      const sidebar = document.getElementById('app-sidebar');
      const logout = document.getElementById('logout-button');

      if (toggle) {
        toggle.addEventListener('click', function () {
          if (!sidebar) return;

          sidebar.classList.toggle('mobile-open');

          if (overlay) {
            overlay.classList.toggle(
              'active',
              sidebar.classList.contains('mobile-open')
            );
          }
        });
      }

      if (overlay) {
        overlay.addEventListener('click', function () {
          Layout.closeSidebar();
        });
      }

      document.querySelectorAll('.sidebar-nav-link').forEach(function (link) {
        link.addEventListener('click', function () {
          Layout.closeSidebar();
        });
      });

      if (logout) {
        logout.addEventListener('click', function () {
          Layout.logout();
        });
      }
    },

    openSidebar: function () {
      const sidebar = document.getElementById('app-sidebar');
      const overlay = document.getElementById('sidebar-overlay');

      if (sidebar) sidebar.classList.add('mobile-open');
      if (overlay) overlay.classList.add('active');
    },

    closeSidebar: function () {
      const sidebar = document.getElementById('app-sidebar');
      const overlay = document.getElementById('sidebar-overlay');

      if (sidebar) sidebar.classList.remove('mobile-open');
      if (overlay) overlay.classList.remove('active');
    },

    updateUser: function () {
      const user = this.getCurrentUser();
      if (!user) return;

      const name =
        user.Name ||
        user.name ||
        user.FullName ||
        user.fullName ||
        user.Username ||
        user.username ||
        'کاربر';

      const initials = this.getInitials(name);

      ['sidebar-user-avatar', 'header-user-avatar'].forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.textContent = initials;
      });

      ['sidebar-user-name', 'header-user-name'].forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.textContent = name;
      });

      const meta = document.getElementById('header-user-meta');
      const sidebarRole = document.getElementById('sidebar-user-role');

      const description = this.isAdmin(user)
        ? 'مدیر سیستم'
        : 'کاربر رویدادها';

      if (meta) meta.textContent = description;
      if (sidebarRole) sidebarRole.textContent = description;
    },

    getCurrentUser: function () {
      try {
        if (
          window.PMS &&
          PMS.Session &&
          typeof PMS.Session.getUser === 'function'
        ) {
          return PMS.Session.getUser();
        }
      } catch (error) {
        console.warn('خطا در خواندن اطلاعات نشست کاربر:', error);
      }

      return null;
    },

    getEmbeddedRoleNames: function (user) {
      const raw =
        user.Roles ||
        user.roles ||
        user.RoleNames ||
        user.roleNames ||
        user.RoleName ||
        user.roleName ||
        user.Role ||
        user.role ||
        [];

      const list = Array.isArray(raw) ? raw : [raw];

      return list.map(function (item) {
        if (typeof item === 'string') return item.trim();

        if (item && typeof item === 'object') {
          return (
            item.RoleName ||
            item.roleName ||
            item.Name ||
            item.name ||
            item.Title ||
            item.title ||
            ''
          ).toString().trim();
        }

        return '';
      }).filter(Boolean);
    },

    loadUserDetails: async function () {
      const user = this.getCurrentUser();

      if (!user || !this.isAdmin(user) || !window.PMS || !PMS.Api) {
        return;
      }

      const userId =
        user.ID ??
        user.id ??
        user.UserID ??
        user.userId;

      const departmentId =
        user.DepartmentID ??
        user.departmentID ??
        user.departmentId;

      if (this.userDetailsRequest) return;

      this.userDetailsRequest = true;

      try {
        const jobs = [];

        if (
          departmentId !== undefined &&
          departmentId !== null &&
          departmentId !== ''
        ) {
          jobs.push(
            this.loadDepartmentName(departmentId).catch(function () {
              return '';
            })
          );
        } else {
          jobs.push(Promise.resolve(''));
        }

        jobs.push(
          this.loadAssignedRoles(userId).catch(() => this.getEmbeddedRoleNames(user))
        );

        const results = await Promise.all(jobs);

        const departmentName =
          results[0] ||
          user.DepartmentName ||
          user.departmentName ||
          '';

        const roleNames = Array.isArray(results[1]) ? results[1] : [];

        const metaParts = [];
        if (departmentName) metaParts.push(departmentName);
        if (roleNames.length) metaParts.push(roleNames.join('، '));

        const meta = document.getElementById('header-user-meta');
        const sidebarRole = document.getElementById('sidebar-user-role');

        if (meta) {
          meta.textContent = metaParts.join(' | ') || 'مدیر سیستم';
          meta.title = meta.textContent;
        }

        if (sidebarRole) {
          sidebarRole.textContent =
            roleNames.join('، ') || departmentName || 'مدیر سیستم';
          sidebarRole.title = sidebarRole.textContent;
        }
      } catch (error) {
        console.warn('دریافت جزئیات کاربر انجام نشد:', error);
      } finally {
        this.userDetailsRequest = null;
      }
    },

    loadDepartmentName: async function (departmentId) {
      if (!PMS.Api) return '';

      let result;

      if (typeof PMS.Api.getCached === 'function') {
        result = await PMS.Api.getCached(
          '/departments',
          'PMS_HEADER_DEPARTMENTS'
        );
      } else if (typeof PMS.Api.get === 'function') {
        result = await PMS.Api.get('/departments');
      } else {
        return '';
      }

      const data = this.extractData(result);
      const departments = this.normalizeList(data);

      const department = departments.find(function (item) {
        const id =
          item.ID ??
          item.id ??
          item.DepartmentID ??
          item.departmentId;

        return String(id) === String(departmentId);
      });

      return department
        ? (
            department.Name ||
            department.name ||
            department.DepartmentName ||
            department.departmentName ||
            ''
          )
        : '';
    },

    loadAssignedRoles: async function (userId) {
      const user = this.getCurrentUser();
      const embeddedRoles = this.getEmbeddedRoleNames(user || {});

      if (userId === undefined || userId === null || userId === '') {
        return embeddedRoles;
      }

      if (!PMS.Api || typeof PMS.Api.get !== 'function') {
        return embeddedRoles;
      }

      try {
        const response = await PMS.Api.get(
          '/users/' + encodeURIComponent(userId) + '/roles'
        );

        const roles = this.normalizeList(this.extractData(response));

        const names = roles.map(function (role) {
          if (typeof role === 'string') return role.trim();

          return (
            role.RoleName ||
            role.roleName ||
            role.Name ||
            role.name ||
            role.Title ||
            role.title ||
            ''
          ).toString().trim();
        }).filter(Boolean);

        return names.length ? Array.from(new Set(names)) : embeddedRoles;
      } catch (error) {
        return embeddedRoles;
      }
    },

    extractData: function (response) {
      if (response && typeof response === 'object' && 'data' in response) {
        return response.data;
      }

      return response;
    },

    normalizeList: function (data) {
      if (Array.isArray(data)) return data;
      if (!data || typeof data !== 'object') return [];

      if (Array.isArray(data.items)) return data.items;
      if (Array.isArray(data.rows)) return data.rows;
      if (Array.isArray(data.departments)) return data.departments;
      if (Array.isArray(data.roles)) return data.roles;
      if (Array.isArray(data.users)) return data.users;

      return [];
    },

    bindSyncStatus: function () {
      if (this.syncListener) {
        window.removeEventListener(
          'pms:sync-status',
          this.syncListener
        );
      }

      this.syncListener = function (event) {
        Layout.updateSyncStatus(
          event && event.detail ? event.detail : {}
        );
      };

      window.addEventListener(
        'pms:sync-status',
        this.syncListener
      );

      if (
        window.PMS &&
        PMS.Api &&
        typeof PMS.Api.getSyncStatus === 'function'
      ) {
        this.updateSyncStatus(PMS.Api.getSyncStatus());
      } else {
        this.updateSyncStatus({ status: 'idle' });
      }
    },

    updateSyncStatus: function (state) {
      const container = document.getElementById('header-sync-status');
      const label = document.getElementById('sync-status-text');

      if (!container || !label) return;

      const status = state.status || 'idle';

      const labels = {
        idle: 'در انتظار دریافت اطلاعات',
        cached: 'نمایش اطلاعات ذخیره‌شده',
        'cached-refreshing': 'بررسی به‌روزرسانی اطلاعات...',
        fetching: 'در حال دریافت از سرور...',
        updated: 'آخرین دریافت موفق',
        error: 'خطا در دریافت اطلاعات'
      };

      const classes = [
        'status-idle',
        'status-cached',
        'status-fetching',
        'status-updated',
        'status-error'
      ];

      container.classList.remove(...classes);
      container.classList.add(this.getSyncStatusClass(status));

      label.textContent =
        labels[status] || 'وضعیت دریافت اطلاعات نامشخص';

      const details = [];

      if (Number(state.activeRequests) > 0) {
        details.push('درخواست‌های فعال: ' + state.activeRequests);
      }

      if (state.lastUpdated) {
        const date = new Date(state.lastUpdated);

        if (!Number.isNaN(date.getTime())) {
          details.push(
            'آخرین دریافت: ' + date.toLocaleTimeString('fa-IR')
          );
        }
      }

      if (state.lastError) {
        details.push(
          typeof state.lastError === 'string'
            ? state.lastError
            : 'یکی از درخواست‌ها با خطا مواجه شده است'
        );
      }

      container.title = details.length
        ? details.join(' | ')
        : 'وضعیت درخواست‌های دریافت اطلاعات؛ نه وضعیت کامل همه اطلاعات سامانه';
    },

    getSyncStatusClass: function (status) {
      if (status === 'cached') return 'status-cached';

      if (
        status === 'cached-refreshing' ||
        status === 'fetching'
      ) {
        return 'status-fetching';
      }

      if (status === 'updated') return 'status-updated';
      if (status === 'error') return 'status-error';

      return 'status-idle';
    },

    getInitials: function (name) {
      const value = String(name || '').trim();

      if (!value) return '؟';

      const parts = value.split(/\s+/);

      if (parts.length === 1) {
        return parts[0].charAt(0);
      }

      return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
      );
    },

    setActiveRoute: function () {
      const hash = window.location.hash.replace(/^#/, '');
      const route = hash.split('/')[0] || 'dashboard';

      document.querySelectorAll('.sidebar-nav-link').forEach(function (link) {
        const linkRoute = link.getAttribute('data-route');

        link.classList.toggle(
          'active',
          linkRoute === route
        );
      });

      const item = this.getVisibleNavItems().find(function (nav) {
        return nav.route === route;
      });

      const title = document.getElementById('app-header-title');

      if (title && item) {
        title.textContent = item.label;
      }
    },

    logout: async function () {
      try {
        if (
          window.PMS.Auth &&
          typeof PMS.Auth.logout === 'function'
        ) {
          await PMS.Auth.logout();
          return;
        }

        if (
          window.PMS.Session &&
          typeof PMS.Session.clear === 'function'
        ) {
          PMS.Session.clear();
        }
      } catch (error) {
        console.error('خطا هنگام خروج:', error);
      }

      window.location.hash = '#login';
    },

    escapeHtml: function (value) {
      const div = document.createElement('div');

      div.textContent = String(value ?? '');

      return div.innerHTML;
    }
  };

  window.PMS = window.PMS || {};
  window.PMS.Layout = Layout;
})();
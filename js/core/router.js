
(function () {
  'use strict';

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  const Router = {
    pages: {
      login: 'pages/login.html',
      dashboard: 'pages/dashboard.html',
      projects: 'pages/projects.html',
      'project-detail': 'pages/project-detail.html',
      events: 'pages/events.html',
      workflows: 'pages/workflows.html',
      'event-types': 'pages/event-types.html',
      attachments: 'pages/attachments.html',
      reports: 'pages/reports.html',
      users: 'pages/users.html',
      departments: 'pages/departments.html',
      roles: 'pages/roles.html',
      permissions: 'pages/permissions.html',
      audit: 'pages/audit.html',
      settings: 'pages/settings.html',
      admin: 'pages/admin.html'
    },

    currentPage: null,
    layoutRendered: false,
    handling: false,

    isLoggedIn: function () {
      return !!(
        window.PMS.Session &&
        typeof window.PMS.Session.isAuthenticated === 'function' &&
        window.PMS.Session.isAuthenticated()
      );
    },

    getUser: function () {
      if (
        window.PMS.Session &&
        typeof window.PMS.Session.getUser === 'function'
      ) {
        return window.PMS.Session.getUser() || {};
      }

      return {};
    },

    isAdmin: function () {
      const user = Router.getUser();

      return (
        user.IsAdmin === true ||
        String(user.IsAdmin).toLowerCase() === 'true' ||
        String(user.DepartmentCode || '').trim().toUpperCase() === 'ADMIN'
      );
    },

    getHomeRoute: function () {
      return Router.isAdmin() ? 'dashboard' : 'events';
    },

    init: function () {
      window.addEventListener('hashchange', function () {
        Router.handle();
      });

      Router.handle();
    },

    handle: async function () {
      if (Router.handling) return;

      Router.handling = true;

      try {
        let route = window.location.hash.replace(/^#/, '').trim();

        if (!route) {
          route = Router.getHomeRoute();
        }

        let mainRoute = route.split('/')[0];

        if (!Router.pages[mainRoute]) {
          route = Router.getHomeRoute();
          mainRoute = route;
        }

        // کاربر واردنشده فقط صفحه ورود را می‌بیند.
        if (!Router.isLoggedIn() && mainRoute !== 'login') {
          Router.changeRoute('login', true);
          route = 'login';
          mainRoute = 'login';
        }

        // کاربر واردشده از صفحه ورود به صفحه اصلی خود می‌رود.
        if (Router.isLoggedIn() && mainRoute === 'login') {
          route = Router.getHomeRoute();
          mainRoute = route;
          Router.changeRoute(route, true);
        }

        // کاربران عادی فقط به صفحه رویدادها دسترسی دارند.
        if (
          Router.isLoggedIn() &&
          !Router.isAdmin() &&
          mainRoute !== 'events'
        ) {
          route = 'events';
          mainRoute = 'events';
          Router.changeRoute('events', true);
        }

        // صفحه ورود بدون قالب اصلی برنامه بارگذاری می‌شود.
        if (mainRoute === 'login') {
          await Router.loadLogin();
          return;
        }

        if (!Router.layoutRendered) {
          Router.renderLayout();
        }

        await Router.loadPage(mainRoute, route);

      } catch (error) {
        console.error('Router Error:', error);
      } finally {
        Router.handling = false;
      }
    },

    changeRoute: function (route, replace) {
      const target = '#' + (route || Router.getHomeRoute());

      if (window.location.hash === target) return;

      if (replace) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname +
          window.location.search +
          target
        );
      } else {
        window.location.hash = target;
      }
    },

    renderLayout: function () {
      if (
        !window.PMS.Layout ||
        typeof window.PMS.Layout.render !== 'function'
      ) {
        console.error('PMS.Layout.render پیدا نشد.');
        return;
      }

      window.PMS.Layout.render();
      Router.layoutRendered = true;

      if (typeof window.PMS.Layout.setActiveRoute === 'function') {
        window.PMS.Layout.setActiveRoute();
      }
    },

    loadLogin: async function () {
      const app = document.getElementById('app');

      if (!app) {
        console.error('عنصر app پیدا نشد.');
        return;
      }

      try {
        const pageUrl = new URL(
          Router.pages.login,
          document.baseURI
        );

        const response = await fetch(pageUrl.href, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(
            'خطا در بارگذاری صفحه ورود: ' + response.status
          );
        }

        const html = await response.text();

        app.innerHTML = html;
        Router.layoutRendered = false;

        await Router.executePageScripts(app, pageUrl.href);
        Router.initPageModule('login');

      } catch (error) {
        console.error('Login Router Error:', error);

        app.innerHTML =
          '<div class="alert alert-danger">' +
          'خطا در بارگذاری صفحه ورود. کنسول مرورگر را بررسی کنید.' +
          '</div>';
      }
    },

    loadPage: async function (page, route) {
      const content = document.getElementById('page-content');

      if (!content) {
        console.error('page-content پیدا نشد.');
        return;
      }

      const pagePath = Router.pages[page];

      if (!pagePath) return;

      try {
        const pageUrl = new URL(pagePath, document.baseURI);
        const response = await fetch(pageUrl.href, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(
            'خطا در بارگذاری صفحه: ' + response.status
          );
        }

        const html = await response.text();

        content.innerHTML = html;
        Router.currentPage = route;

        await Router.executePageScripts(content, pageUrl.href);

        if (
          window.PMS.Layout &&
          typeof window.PMS.Layout.setActiveRoute === 'function'
        ) {
          window.PMS.Layout.setActiveRoute();
        }

        Router.initPageModule(page);

      } catch (error) {
        console.error('Router Error:', error);

        content.innerHTML =
          '<div class="alert alert-danger">' +
          'خطا در بارگذاری صفحه. کنسول مرورگر را بررسی کنید.' +
          '</div>';
      }
    },

    executePageScripts: async function (container, pageUrl) {
      const scripts = Array.from(container.querySelectorAll('script'));

      for (const oldScript of scripts) {
        const newScript = document.createElement('script');

        Array.from(oldScript.attributes).forEach(function (attribute) {
          newScript.setAttribute(attribute.name, attribute.value);
        });

        if (oldScript.hasAttribute('src')) {
const originalSrc = oldScript.getAttribute('src');

if (
  originalSrc.startsWith('/') ||
  /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(originalSrc)
) {
  newScript.src = new URL(
    originalSrc,
    document.baseURI
  ).href;
} else {
  newScript.src = new URL(
    originalSrc,
    document.baseURI
  ).href;
}
        } else {
          newScript.textContent = oldScript.textContent;
        }

        const loaded = new Promise(function (resolve, reject) {
          if (!newScript.hasAttribute('src')) {
            resolve();
            return;
          }

          newScript.onload = resolve;
          newScript.onerror = function () {
            reject(
              new Error('بارگذاری اسکریپت ناموفق بود: ' + newScript.src)
            );
          };
        });

        oldScript.parentNode.replaceChild(newScript, oldScript);

        if (newScript.hasAttribute('src')) {
          await loaded;
        }
      }
    },

    initPageModule: function (page) {
      const moduleMap = {
        dashboard: 'Dashboard',
        projects: 'Projects',
        'project-detail': 'ProjectDetail',
        events: 'Events',
        workflows: 'Workflows',
        'event-types': 'EventTypes',
        attachments: 'Attachments',
        reports: 'Reports',
        users: 'Users',
        departments: 'Departments',
        roles: 'Roles',
        permissions: 'Permissions',
        audit: 'Audit',
        settings: 'Settings',
        admin: 'Admin',
        login: 'Auth'
      };

      const moduleName = moduleMap[page];

      if (!moduleName) return;

      const module = window.PMS.Modules[moduleName];

      if (!module || typeof module.init !== 'function') {
        console.warn('ماژول صفحه پیدا نشد:', moduleName);
        return;
      }

      try {
        module.init();
      } catch (error) {
        console.error('خطا در اجرای init ماژول:', moduleName, error);
      }
    },

    go: function (route) {
      route = route || Router.getHomeRoute();

      if (
        Router.isLoggedIn() &&
        !Router.isAdmin() &&
        route.split('/')[0] !== 'events'
      ) {
        route = 'events';
      }

      window.location.hash = route;
    },

    getCurrentRoute: function () {
      return (
        window.location.hash.replace(/^#/, '').trim() ||
        Router.getHomeRoute()
      );
    }
  };

  Router.navigate = function (route, replace) {
    route = route || Router.getHomeRoute();

    if (
      Router.isLoggedIn() &&
      !Router.isAdmin() &&
      route.split('/')[0] !== 'events'
    ) {
      route = 'events';
    }

    Router.changeRoute(route, !!replace);

    // اگر آدرس تغییر نکرده باشد، مسیر را دستی اجرا می‌کنیم.
    if (
      Router.getCurrentRoute() === route &&
      !Router.handling
    ) {
      Router.handle();
    }
  };

  window.PMS.Router = Router;
})();

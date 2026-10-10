(function () {
  'use strict';

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  const Auth = {
    init: function () {
      const form = document.getElementById('login-form');

      if (!form) {
        console.warn('فرم ورود با شناسه login-form پیدا نشد.');
        return;
      }

      if (form.dataset.authInitialized === 'true') {
        return;
      }

      form.dataset.authInitialized = 'true';

      form.addEventListener('submit', async function (event) {
        event.preventDefault();

        const usernameInput = form.querySelector('[name="username"]');
        const passwordInput = form.querySelector('[name="password"]');
        const submitButton = form.querySelector('[type="submit"]');

        const username = usernameInput
          ? usernameInput.value.trim()
          : '';

        const password = passwordInput
          ? passwordInput.value
          : '';

        try {
          if (submitButton) {
            submitButton.disabled = true;
          }

          const data = await Auth.login(username, password);

          const user = data.user || {};
          const isAdmin =
            user.IsAdmin === true ||
            String(user.IsAdmin).toLowerCase() === 'true' ||
            String(user.DepartmentCode || '').trim().toUpperCase() === 'ADMIN';

          await PMS.Router.navigate(
            isAdmin ? 'dashboard' : 'events',
            true
          );

        } catch (error) {
          console.error('Login Error:', error);

          const message =
            document.getElementById('login-error') ||
            document.getElementById('login-message');

          if (message) {
            message.textContent =
              error.message || 'ورود ناموفق بود.';

            message.style.display = 'block';
          } else {
            alert(error.message || 'ورود ناموفق بود.');
          }

        } finally {
          if (submitButton) {
            submitButton.disabled = false;
          }
        }
      });
    },

    login: async function (username, password) {
      if (!username || !password) {
        throw new Error('نام کاربری و رمز عبور الزامی است.');
      }

      const result = await PMS.Api.post('/auth/login', {
        username: username,
        password: password
      });

      if (!result || !result.data) {
        throw new Error('اطلاعات ورود از سرور دریافت نشد.');
      }

      const data = result.data;

      if (!data.token) {
        throw new Error('نشست کاربر ایجاد نشد.');
      }

      PMS.Session.save({
        token: data.token,
        user: data.user || null
      });

      if (
        data.permissions &&
        Array.isArray(data.permissions) &&
        PMS.Permissions &&
        typeof PMS.Permissions.set === 'function'
      ) {
        PMS.Permissions.set(data.permissions);
      }

      return data;
    },

    logout: async function () {
      // ابتدا نشست محلی را پاک می‌کنیم تا درخواست‌های جدید
      // با نشست قبلی ارسال نشوند.
      try {
        if (
          PMS.Permissions &&
          typeof PMS.Permissions.clear === 'function'
        ) {
          PMS.Permissions.clear();
        }
      } catch (error) {
        console.warn('پاک‌سازی مجوزهای محلی انجام نشد:', error);
      }

      try {
        if (
          PMS.Session &&
          typeof PMS.Session.clear === 'function'
        ) {
          PMS.Session.clear();
        }
      } catch (error) {
        console.error('پاک‌سازی نشست محلی انجام نشد:', error);
      }

      // تلاش برای بستن نشست سرور؛ خطای سرور نباید مانع خروج شود.
      try {
        if (PMS.Api && typeof PMS.Api.post === 'function') {
          await PMS.Api.post('/auth/logout', {});
        }
      } catch (error) {
        console.warn(
          'بستن نشست سرور انجام نشد؛ نشست محلی پاک شده است.',
          error
        );
      }

      if (PMS.Router && typeof PMS.Router.navigate === 'function') {
        PMS.Router.navigate('login', true);
      } else {
        window.location.hash = '#login';
      }
    },

    me: async function () {
      const result = await PMS.Api.get('/auth/me');

      if (result && result.data) {
        PMS.Session.setUser(result.data);
      }

      return result;
    },

    isLoggedIn: function () {
      return PMS.Session.isAuthenticated();
    }
  };

  window.PMS.Auth = Auth;
  window.PMS.Modules.Auth = Auth;
})();
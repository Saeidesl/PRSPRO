(function () {
  'use strict';

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  const Settings = {
    init: function () {
      const message = document.getElementById('settings-message');

      if (message) {
        message.textContent =
          'تنظیمات عمومی فعلاً فقط قابل مشاهده هستند.';
      }
    }
  };

  window.PMS.Settings = Settings;
  window.PMS.Modules.Settings = Settings;
})();
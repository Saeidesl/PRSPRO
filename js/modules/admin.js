(function () {
  'use strict';

  window.PMS = window.PMS || {};
  window.PMS.Modules = window.PMS.Modules || {};

  const Admin = {
    init: function () {
      console.log('صفحه مدیریت سامانه بارگذاری شد.');
    }
  };

  window.PMS.Admin = Admin;
  window.PMS.Modules.Admin = Admin;
})();
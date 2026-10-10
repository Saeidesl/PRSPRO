/**
 * ============================================================
 * PRODUCTION MANAGEMENT SYSTEM
 * APPLICATION CORE
 * ============================================================
 */

(function () {

  'use strict';


  const App = {

    initialized: false,


    init: function () {

      if (this.initialized) {
        return;
      }

      this.initialized = true;

      this.removeLoading();

      this.start();

    },


    start: function () {

      const authenticated =
        PMS.Session.isAuthenticated();


      if (!authenticated) {

        PMS.Router.navigate(
          'login',
          true
        );

        return;

      }


      PMS.Layout.render();

      PMS.Router.init();

    },


    removeLoading: function () {

      const loading =
        document.getElementById(
          'app-loading'
        );

      if (loading) {
        loading.remove();
      }

    }

  };


  window.PMS =
    window.PMS || {};

  window.PMS.App =
    App;


  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      function () {
        App.init();
      }
    );

  } else {

    App.init();

  }

})();
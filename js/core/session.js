/**
 * ============================================================
 * PRODUCTION MANAGEMENT SYSTEM
 * SESSION
 * ============================================================
 */

(function () {

  'use strict';

  const KEY = 'pms_session';

  const Session = {

    save: function (data) {

      if (!data) {
        return;
      }

      localStorage.setItem(
        KEY,
        JSON.stringify(data)
      );

      if (data.token) {
        PMS.Api.setToken(data.token);
      }

    },


    get: function () {

      try {

        const value =
          localStorage.getItem(KEY);

        if (!value) {
          return null;
        }

        return JSON.parse(value);

      } catch (error) {

        return null;

      }

    },


    getUser: function () {

      const session =
        this.get();

      return session &&
        session.user
        ? session.user
        : null;

    },


    getToken: function () {

      const session =
        this.get();

      if (
        session &&
        session.token
      ) {

        return session.token;

      }

      return PMS.Api.getToken();

    },


    isAuthenticated: function () {

      return !!this.getToken();

    },


    clear: function () {

      localStorage.removeItem(KEY);

      PMS.Api.clearToken();

    },


    setUser: function (user) {

      const session =
        this.get() || {};

      session.user =
        user;

      this.save(session);

    }

  };


  window.PMS =
    window.PMS || {};

  window.PMS.Session =
    Session;

})();
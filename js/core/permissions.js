/**
 * ============================================================
 * PRODUCTION MANAGEMENT SYSTEM
 * PERMISSIONS
 * ============================================================
 */

(function () {

  'use strict';

  const Permissions = {

    list: [],


    set: function (permissions) {

      this.list =
        Array.isArray(permissions)
          ? permissions
          : [];

    },


    has: function (permission) {

      if (!permission) {
        return false;
      }

      return this.list.indexOf(
        permission
      ) !== -1;

    },


    hasAny: function (permissions) {

      if (
        !Array.isArray(permissions)
      ) {

        return false;

      }

      for (
        let i = 0;
        i < permissions.length;
        i++
      ) {

        if (
          this.has(
            permissions[i]
          )
        ) {

          return true;

        }

      }

      return false;

    },


    hasAll: function (permissions) {

      if (
        !Array.isArray(permissions)
      ) {

        return false;

      }

      for (
        let i = 0;
        i < permissions.length;
        i++
      ) {

        if (
          !this.has(
            permissions[i]
          )
        ) {

          return false;

        }

      }

      return true;

    },


    clear: function () {

      this.list = [];

    }

  };


  window.PMS =
    window.PMS || {};

  window.PMS.Permissions =
    Permissions;

})();
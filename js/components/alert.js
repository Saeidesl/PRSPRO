(function () {
  'use strict';

  const Alert = {

    show: function (
      message,
      type,
      duration
    ) {

      type =
        type ||
        'info';

      duration =
        duration === undefined
          ? 4000
          : duration;

      const container =
        this.getContainer();

      const element =
        document.createElement('div');

      element.className =
        'alert alert-' +
        this.normalizeType(type);

      element.textContent =
        message || '';

      container.appendChild(
        element
      );

      if (duration > 0) {

        setTimeout(
          function () {

            if (element.parentNode) {
              element.remove();
            }

          },
          duration
        );
      }

      return element;
    },

    success: function (
      message,
      duration
    ) {

      return this.show(
        message,
        'success',
        duration
      );
    },

    error: function (
      message,
      duration
    ) {

      return this.show(
        message,
        'danger',
        duration
      );
    },

    warning: function (
      message,
      duration
    ) {

      return this.show(
        message,
        'warning',
        duration
      );
    },

    info: function (
      message,
      duration
    ) {

      return this.show(
        message,
        'info',
        duration
      );
    },

    getContainer: function () {

      let container =
        document.getElementById(
          'pms-alert-container'
        );

      if (container) {
        return container;
      }

      container =
        document.createElement('div');

      container.id =
        'pms-alert-container';

      container.style.position =
        'fixed';

      container.style.top =
        '20px';

      container.style.left =
        '20px';

      container.style.right =
        '20px';

      container.style.zIndex =
        '9999';

      container.style.display =
        'flex';

      container.style.flexDirection =
        'column';

      container.style.gap =
        '8px';

      document.body.appendChild(
        container
      );

      return container;
    },

    normalizeType: function (
      type
    ) {

      if (type === 'error') {
        return 'danger';
      }

      return type;
    }
  };

  window.PMS =
    window.PMS || {};

  window.PMS.Alert =
    Alert;

})();
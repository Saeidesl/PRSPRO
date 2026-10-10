(function () {
  'use strict';

  const Loading = {

    show: function (
      container,
      message
    ) {

      const target =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;

      if (!target) {
        return;
      }

      target.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <div>
            ${this.escapeHtml(
              message ||
              'در حال بارگذاری...'
            )}
          </div>
        </div>
      `;

      return target;
    },

    hide: function (
      container
    ) {

      const target =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;

      if (!target) {
        return;
      }

      target.innerHTML = '';
    },

    overlay: function (
      message
    ) {

      let element =
        document.getElementById(
          'pms-loading-overlay'
        );

      if (element) {
        return element;
      }

      element =
        document.createElement('div');

      element.id =
        'pms-loading-overlay';

      element.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">
          ${this.escapeHtml(
            message ||
            'در حال پردازش...'
          )}
        </div>
      `;

      element.style.position =
        'fixed';

      element.style.inset =
        '0';

      element.style.zIndex =
        '10000';

      element.style.display =
        'flex';

      element.style.flexDirection =
        'column';

      element.style.alignItems =
        'center';

      element.style.justifyContent =
        'center';

      element.style.gap =
        '12px';

      element.style.background =
        'rgba(255,255,255,.75)';

      document.body.appendChild(
        element
      );

      return element;
    },

    hideOverlay: function () {

      const element =
        document.getElementById(
          'pms-loading-overlay'
        );

      if (element) {
        element.remove();
      }
    },

    escapeHtml: function (
      value
    ) {

      const div =
        document.createElement('div');

      div.textContent =
        String(value ?? '');

      return div.innerHTML;
    }
  };

  window.PMS =
    window.PMS || {};

  window.PMS.Loading =
    Loading;

})();
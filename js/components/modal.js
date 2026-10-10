(function () {
  'use strict';

  const Modal = {

    open: function (options) {

      options = options || {};

      const id =
        options.id ||
        'pms-modal';

      this.close(id);

      const title =
        options.title ||
        'اطلاعات';

      const content =
        options.content ||
        '';

      const footer =
        options.footer ||
        '';

      const modal = document.createElement('div');

      modal.id = id;

      modal.className = 'modal-overlay';

      modal.innerHTML = `
        <div class="modal">

          <div class="modal-header">

            <h3>
              ${this.escapeHtml(title)}
            </h3>

            <button
              type="button"
              class="modal-close"
              data-modal-close
            >
              ×
            </button>

          </div>

          <div class="modal-body">
            ${content}
          </div>

          ${
            footer
              ? `
                <div class="modal-footer">
                  ${footer}
                </div>
              `
              : ''
          }

        </div>
      `;

      document.body.appendChild(modal);

      const closeButton =
        modal.querySelector(
          '[data-modal-close]'
        );

      if (closeButton) {

        closeButton.addEventListener(
          'click',
          () => this.close(id)
        );
      }

      modal.addEventListener(
        'click',
        function (event) {

          if (
            event.target === modal &&
            options.closeOnOverlay !== false
          ) {
            Modal.close(id);
          }
        }
      );

      document.body.classList.add(
        'modal-open'
      );

      if (typeof options.onOpen === 'function') {
        options.onOpen(modal);
      }

      return modal;
    },

    close: function (id) {

      const modal =
        document.getElementById(
          id || 'pms-modal'
        );

      if (modal) {
        modal.remove();
      }

      if (
        !document.querySelector(
          '.modal-overlay'
        )
      ) {
        document.body.classList.remove(
          'modal-open'
        );
      }
    },

    closeAll: function () {

      document
        .querySelectorAll('.modal-overlay')
        .forEach(function (modal) {
          modal.remove();
        });

      document.body.classList.remove(
        'modal-open'
      );
    },

    escapeHtml: function (value) {

      const div =
        document.createElement('div');

      div.textContent =
        String(value ?? '');

      return div.innerHTML;
    }
  };

  window.PMS =
    window.PMS || {};

  window.PMS.Modal =
    Modal;

})();
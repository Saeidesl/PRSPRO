(function () {
  'use strict';

  const Timeline = {

    render: function (
      container,
      items,
      options
    ) {

      options =
        options || {};

      const target =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;

      if (!target) {
        return;
      }

      items =
        Array.isArray(items)
          ? items
          : [];

      if (!items.length) {

        target.innerHTML = `
          <div class="table-empty">
            ${this.escapeHtml(
              options.emptyText ||
              'موردی برای نمایش وجود ندارد.'
            )}
          </div>
        `;

        return;
      }

      target.innerHTML = `
        <div class="timeline">
          ${items
            .map(
              function (item) {

                return `
                  <div class="timeline-item">

                    <div class="timeline-dot"></div>

                    <div class="timeline-content">

                      <div class="timeline-header">

                        <strong>
                          ${this.escapeHtml(
                            item.title ||
                            item.Title ||
                            item.name ||
                            item.Name ||
                            'رویداد'
                          )}
                        </strong>

                        <span class="timeline-meta">
                          ${this.escapeHtml(
                            item.date ||
                            item.OccurredAt ||
                            item.CreatedAt ||
                            ''
                          )}
                        </span>

                      </div>

                      ${
                        item.description ||
                        item.Description
                          ? `
                            <div class="timeline-description">
                              ${this.escapeHtml(
                                item.description ||
                                item.Description
                              )}
                            </div>
                          `
                          : ''
                      }

                    </div>

                  </div>
                `;

              }.bind(this)
            )
            .join('')}
        </div>
      `;
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

  window.PMS.Timeline =
    Timeline;

})();
(function () {
  'use strict';

  const Table = {

    render: function (
      container,
      columns,
      rows,
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

      rows =
        Array.isArray(rows)
          ? rows
          : [];

      columns =
        Array.isArray(columns)
          ? columns
          : [];

      if (!rows.length) {

        target.innerHTML = `
          <div class="table-empty">
            ${this.escapeHtml(
              options.emptyText ||
              'داده‌ای برای نمایش وجود ندارد.'
            )}
          </div>
        `;

        return;
      }

      let html = `
        <div class="table-wrapper">

          <table class="data-table">

            <thead>
              <tr>
      `;

      columns.forEach(
        function (column) {

          html += `
            <th>
              ${this.escapeHtml(
                column.label ||
                column.key ||
                ''
              )}
            </th>
          `;

        }.bind(this)
      );

      html += `
              </tr>
            </thead>

            <tbody>
      `;

      rows.forEach(
        function (row) {

          html += '<tr>';

          columns.forEach(
            function (column) {

              let value = '';

              if (
                typeof column.render ===
                'function'
              ) {

                value =
                  column.render(
                    row
                  );

              } else {

                value =
                  row[column.key];
              }

              html += `
                <td>
                  ${
                    column.raw
                      ? String(
                          value ?? ''
                        )
                      : this.escapeHtml(
                          value ?? ''
                        )
                  }
                </td>
              `;

            }.bind(this)
          );

          html += '</tr>';

        }.bind(this)
      );

      html += `
            </tbody>

          </table>

        </div>
      `;

      target.innerHTML =
        html;
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

  window.PMS.Table =
    Table;

})();
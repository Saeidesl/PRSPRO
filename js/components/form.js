(function () {
  'use strict';

  const Form = {

    serialize: function (
      form
    ) {

      const target =
        typeof form === 'string'
          ? document.querySelector(form)
          : form;

      if (!target) {
        return {};
      }

      const data = {};

      const elements =
        target.querySelectorAll(
          'input, select, textarea'
        );

      elements.forEach(
        function (element) {

          if (!element.name) {
            return;
          }

          if (
            element.type === 'checkbox'
          ) {

            data[element.name] =
              element.checked;

            return;
          }

          if (
            element.type === 'radio'
          ) {

            if (element.checked) {

              data[element.name] =
                element.value;
            }

            return;
          }

          data[element.name] =
            element.value;
        }
      );

      return data;
    },

    fill: function (
      form,
      data
    ) {

      const target =
        typeof form === 'string'
          ? document.querySelector(form)
          : form;

      if (!target || !data) {
        return;
      }

      const elements =
        target.querySelectorAll(
          'input, select, textarea'
        );

      elements.forEach(
        function (element) {

          if (!element.name) {
            return;
          }

          if (
            data[element.name] ===
            undefined
          ) {
            return;
          }

          if (
            element.type === 'checkbox'
          ) {

            element.checked =
              Boolean(
                data[element.name]
              );

            return;
          }

          if (
            element.type === 'radio'
          ) {

            element.checked =
              element.value ===
              String(
                data[element.name]
              );

            return;
          }

          element.value =
            data[element.name] ?? '';
        }
      );
    },

    reset: function (
      form
    ) {

      const target =
        typeof form === 'string'
          ? document.querySelector(form)
          : form;

      if (!target) {
        return;
      }

      target.reset();
    },

    setDisabled: function (
      form,
      disabled
    ) {

      const target =
        typeof form === 'string'
          ? document.querySelector(form)
          : form;

      if (!target) {
        return;
      }

      target
        .querySelectorAll(
          'input, select, textarea, button'
        )
        .forEach(
          function (element) {

            element.disabled =
              disabled;
          }
        );
    }
  };

  window.PMS =
    window.PMS || {};

  window.PMS.Form =
    Form;

})();
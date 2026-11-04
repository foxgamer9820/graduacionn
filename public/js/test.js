// Pantalla del test: reloj, guardado automático de cada respuesta y entrega al acabarse el tiempo
$(function () {
  // ----- Reloj -----
  const $reloj = $('#reloj');
  let restantes = Number($reloj.data('segundos')) || 0;
  const fin = Date.now() + restantes * 1000;
  let entregado = false;
  function pintar() {
    restantes = Math.max(0, Math.round((fin - Date.now()) / 1000));
    const m = Math.floor(restantes / 60), s = restantes % 60;
    $('#reloj-texto').text(m + ':' + String(s).padStart(2, '0'));
    $reloj.toggleClass('poco-tiempo', restantes <= 60);
    if (restantes === 300 || restantes === 60) $reloj.attr('aria-live', 'assertive');
    if (restantes <= 0 && !entregado) {
      entregado = true;
      $('#opcion-tiempo').val($('input[name=opcion]:checked').val() || '');
      $('#form-tiempo').trigger('submit');
    }
  }
  if ($reloj.length) { pintar(); setInterval(pintar, 1000); }

  // ----- Guardado automático al elegir una opción -----
  const $form = $('#form-respuesta');
  const $estado = $('#estado-guardado');
  $form.find('input[name=opcion]').on('change', function () {
    $estado.text('Guardando…').removeClass('error');
    $.post($form.data('ajax'), { opcion: this.value, ajax: '1' })
      .done(function (r) {
        if (r.terminado) { window.location = r.url; return; }
        $estado.text('Respuesta guardada');
        $('.punto-nav.actual').addClass('respondida');
      })
      .fail(function (x) {
        if (x.responseJSON && x.responseJSON.terminado) { window.location = x.responseJSON.url; return; }
        $estado.text('No se pudo guardar. Revisa tu conexión: se guardará al pasar de pregunta.').addClass('error');
      });
  });
});

// Marca la opción elegida (para navegadores sin :has)
$(function () {
  $('.opcion-test input').on('change', function () {
    $('.opcion-test').removeClass('marcada');
    $(this).closest('.opcion-test').addClass('marcada');
  }).filter(':checked').closest('.opcion-test').addClass('marcada');
});

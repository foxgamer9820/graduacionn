// JavaScript del navegador (se usa jQuery, como indica el guion)
$(function () {
  // Abrir y cerrar el menú en el celular
  $('.boton-menu').on('click', function () {
    const abierto = $('.menu').toggleClass('abierto').hasClass('abierto');
    $(this).attr('aria-expanded', abierto);
  });
  $(document).on('click', function (e) {
    if (!$(e.target).closest('.menu, .boton-menu').length) $('.menu').removeClass('abierto');
  });

  // Mostrar u ocultar la contraseña
  $('.ver-clave').on('click', function () {
    const campo = $(this).siblings('input');
    const visible = campo.attr('type') === 'text';
    campo.attr('type', visible ? 'password' : 'text');
    $(this).attr('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });

  // Revisa en vivo los requisitos de la nueva contraseña
  const $nueva = $('#nueva');
  const $confirmar = $('#confirmar');
  function revisar() {
    const n = $nueva.val() || '';
    const c = $confirmar.val() || '';
    $('[data-req="largo"]').toggleClass('ok', n.length >= 8);
    $('[data-req="numero"]').toggleClass('ok', /\d/.test(n));
    $('[data-req="letra"]').toggleClass('ok', /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(n));
    $('[data-req="coinciden"]').toggleClass('ok', n.length > 0 && n === c);
  }
  $nueva.add($confirmar).on('input', revisar);

  // Confirmación antes de acciones delicadas
  $('form[data-confirmar]').on('submit', function () {
    return window.confirm($(this).data('confirmar'));
  });

  // Imprimir los datos de la cuenta creada
  $('.imprimir').on('click', function () { window.print(); });

  // Enviar filtros al cambiar una lista desplegable
  $('.filtros select').on('change', function () { $(this).closest('form').trigger('submit'); });
});

// ---------- Sprint 2: inscribir estudiantes en un tema ----------
$(function () {
  const $casillas = $('.lista-inscribir .casilla');
  if (!$casillas.length) return;
  function contar() { $('#conteo-inscritos').text($casillas.find('input:checked').length); }
  $('#filtro').on('input', function () {
    const texto = $(this).val().toLowerCase().trim();
    $casillas.each(function () { $(this).toggleClass('oculta', texto !== '' && $(this).data('buscar').indexOf(texto) === -1); });
  });
  $('#marcar-todos').on('click', function () { $casillas.not('.oculta').find('input').prop('checked', true); contar(); });
  $('#desmarcar-todos').on('click', function () { $casillas.not('.oculta').find('input').prop('checked', false); contar(); });
  $casillas.find('input').on('change', contar);
});

// ---------- Sprint 3: marcar la respuesta correcta (para navegadores sin :has) ----------
$(function () {
  $('.opcion input[type=radio]').on('change', function () {
    $('.opcion').removeClass('es-correcta');
    $(this).closest('.opcion').addClass('es-correcta');
  });
  // Si se elige un archivo, la descripción de la imagen pasa a ser obligatoria
  $('#imagen').on('change', function () { $('#imagen_alt').prop('required', this.files.length > 0); });
});

// Gráfica de línea en SVG (sin librerías externas) para mostrar calificaciones en el tiempo
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// puntos: [{ etiqueta: '04/11', valor: 80, aprobado: true, titulo: 'Algoritmos básicos' }]
function lineaCalificaciones(puntos, opciones = {}) {
  const ancho = 640, alto = 260;
  const m = { izq: 40, der: 16, arr: 16, aba: 40 };
  const w = ancho - m.izq - m.der, h = alto - m.arr - m.aba;
  const y = (v) => m.arr + h - (Math.max(0, Math.min(100, v)) / 100) * h;
  const x = (i) => m.izq + (puntos.length === 1 ? w / 2 : (i / (puntos.length - 1)) * w);
  const descripcion = opciones.descripcion || `Gráfica de ${puntos.length} calificaciones`;

  let svg = `<svg class="grafica-linea" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${escapar(descripcion)}" preserveAspectRatio="xMidYMid meet">`;
  // Líneas guía
  for (const v of [0, 25, 50, 75, 100]) {
    svg += `<line x1="${m.izq}" x2="${ancho - m.der}" y1="${y(v)}" y2="${y(v)}" class="guia"/>`;
    svg += `<text x="${m.izq - 8}" y="${y(v) + 4}" class="eje" text-anchor="end">${v}</text>`;
  }
  if (opciones.notaMinima !== undefined && opciones.notaMinima !== null) {
    svg += `<line x1="${m.izq}" x2="${ancho - m.der}" y1="${y(opciones.notaMinima)}" y2="${y(opciones.notaMinima)}" class="minima"/>`;
    svg += `<text x="${ancho - m.der}" y="${y(opciones.notaMinima) - 6}" class="eje" text-anchor="end">Nota mínima ${opciones.notaMinima}</text>`;
  }
  if (puntos.length > 1) {
    svg += `<polyline class="trazo" points="${puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')}"/>`;
  }
  // Etiquetas del eje horizontal: como máximo 8 para que no se encimen
  const cada = Math.max(1, Math.ceil(puntos.length / 8));
  puntos.forEach((p, i) => {
    svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="6" class="${p.aprobado ? 'aprobado' : 'reprobado'}"><title>${escapar(`${p.titulo || ''} ${p.etiqueta}: ${p.valor}`)}</title></circle>`;
    if (i % cada === 0 || i === puntos.length - 1) {
      svg += `<text x="${x(i).toFixed(1)}" y="${alto - 14}" class="eje" text-anchor="middle">${escapar(p.etiqueta)}</text>`;
    }
  });
  return svg + '</svg>';
}

module.exports = { lineaCalificaciones };

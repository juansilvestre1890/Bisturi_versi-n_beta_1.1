// STL binario y ZIP sin compresión (sin dependencias).

export function stlBinario(m, nombre = 'pieza') {
  const nf = m.tri.length / 3, buf = new ArrayBuffer(84 + 50 * nf), dv = new DataView(buf), p = m.pos;
  const cab = ('Bisturi 3D - ' + nombre).slice(0, 80);
  for (let i = 0; i < cab.length; i++) dv.setUint8(i, cab.charCodeAt(i) & 0x7f);
  dv.setUint32(80, nf, true);
  for (let f = 0; f < nf; f++) {
    const o = 84 + 50 * f, a = 3 * m.tri[3 * f], b = 3 * m.tri[3 * f + 1], c = 3 * m.tri[3 * f + 2];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
    for (const [k, v] of [a, b, c].entries()) for (let d = 0; d < 3; d++) dv.setFloat32(o + 12 + 12 * k + 4 * d, p[v + d], true);
  }
  return new Uint8Array(buf);
}

// Lee STL binario o ASCII y devuelve la sopa de triángulos.
export function leerSTL(buffer) {
  const bytes = new Uint8Array(buffer), dv = new DataView(buffer);
  if (bytes.length >= 84) {
    const n = dv.getUint32(80, true);
    if (84 + 50 * n === bytes.length) {
      const p = new Float32Array(9 * n);
      for (let f = 0; f < n; f++) for (let k = 0; k < 9; k++) p[9 * f + k] = dv.getFloat32(84 + 50 * f + 12 + 4 * k, true);
      return p;
    }
  }
  const texto = new TextDecoder().decode(bytes), numeros = [];
  const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
  let r;
  while ((r = re.exec(texto))) numeros.push(+r[1], +r[2], +r[3]);
  if (!numeros.length || numeros.length % 9) throw new Error('El archivo STL no se pudo leer.');
  return Float32Array.from(numeros);
}

const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(d) { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = TABLA[(c ^ d[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export function zip(archivos) {
  const enc = new TextEncoder(), partes = [], central = [];
  let desplaz = 0;
  for (const { nombre, datos } of archivos) {
    const n = enc.encode(nombre), crc = crc32(datos), loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true);
    loc.setUint32(14, crc, true); loc.setUint32(18, datos.length, true); loc.setUint32(22, datos.length, true); loc.setUint16(26, n.length, true);
    partes.push(new Uint8Array(loc.buffer), n, datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, datos.length, true); cen.setUint32(24, datos.length, true); cen.setUint16(28, n.length, true); cen.setUint32(42, desplaz, true);
    central.push(new Uint8Array(cen.buffer), n);
    desplaz += 30 + n.length + datos.length;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0), fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, desplaz, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)], salida = new Uint8Array(todo.reduce((s, x) => s + x.length, 0));
  let o = 0; for (const x of todo) { salida.set(x, o); o += x.length; }
  return salida;
}

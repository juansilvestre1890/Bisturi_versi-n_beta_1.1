// Panel «Herramientas exactas (núcleo v2f)»: operaciones de la v2f sobre la pieza seleccionada.
// El cálculo ocurre en nucleo-trabajador.js; aquí solo se prepara la entrada y se confirma el resultado.
export function setupNucleoPanel(THREE, api) {
  const box = document.createElement('div');
  box.className = 'nucleo-tools';
  box.innerHTML = `<h2>Herramientas exactas (núcleo v2f)</h2>
  <p class="hint">Actúan sobre la pieza seleccionada. Cada resultado se comprueba (sólidos cerrados, volumen conservado) y se puede deshacer.</p>
  <button id="nucleoPartes" class="secondary full" type="button">Separar partes sueltas</button>
  <button id="nucleoReparar" class="secondary full" type="button">Cerrar agujeros</button>
  <button id="nucleoCama" class="secondary full" type="button">Dividir para que quepa en la cama activa</button>
  <button id="nucleoColor" class="secondary full" type="button">Separar por color en piezas macizas</button>
  <button id="nucleoCancelar" class="secondary full" type="button" hidden>Cancelar cálculo</button>
  <div id="nucleoInfo" class="hint" role="status" aria-live="polite"></div>`;
  const anchor = document.querySelector('.left .tools .connector-form') || document.querySelector('.left .tools');
  anchor.parentNode.insertBefore(box, anchor);
  const $ = id => box.querySelector('#' + id);
  const botones = ['nucleoPartes', 'nucleoReparar', 'nucleoCama', 'nucleoColor'];
  let worker = null;
  const info = t => { $('nucleoInfo').textContent = t; api.status(t); };
  const ocupado = on => { for (const id of botones) $(id).disabled = on; $('nucleoCancelar').hidden = !on; };
  function cancelar() { if (worker) { worker.terminate(); worker = null; ocupado(false); info('Cálculo cancelado.'); } }
  $('nucleoCancelar').onclick = cancelar;

  // Un color por cara: grupos de material o, si no hay, colores de vértice cuantizados.
  function coloresPorCara(mesh) {
    const g = mesh.geometry, nf = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (Array.isArray(mesh.material) && g.groups.length > 1) {
      const c = new Int16Array(nf).fill(0);
      for (const gr of g.groups) for (let f = gr.start / 3; f < (gr.start + gr.count) / 3 && f < nf; f++) c[f] = gr.materialIndex;
      return { color: c, paleta: mats.map(m => m?.color?.getHex?.() ?? 0xcccccc) };
    }
    const vc = g.getAttribute('color');
    if (vc && mats.some(m => m?.vertexColors)) {
      const c = new Int16Array(nf), paleta = [], clave = new Map();
      for (let f = 0; f < nf; f++) {
        const v = g.index ? g.index.getX(3 * f) : 3 * f;
        const k = [vc.getX(v), vc.getY(v), vc.getZ(v)].map(x => Math.round(Math.min(1, Math.max(0, x)) * 15)).join(',');
        if (!clave.has(k)) { if (paleta.length >= 64) throw new Error('Demasiados colores distintos (más de 64) para separar.'); clave.set(k, paleta.length); paleta.push(new THREE.Color(vc.getX(v), vc.getY(v), vc.getZ(v)).getHex()); }
        c[f] = clave.get(k);
      }
      return paleta.length > 1 ? { color: c, paleta } : null;
    }
    return null;
  }

  function ejecutar(op, extra = {}) {
    cancelar();
    let token;
    try {
      token = api.capture();
      const src = token.source, g = src.geometry, p = g.getAttribute('position');
      if (src.isSkinnedMesh || g.morphAttributes?.position?.length) throw Error('Aplica la deformación de la pieza antes de esta operación.');
      src.updateWorldMatrix(true, false);
      const m = src.matrixWorld, v = new THREE.Vector3(), positions = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); positions[3 * i] = v.x; positions[3 * i + 1] = v.y; positions[3 * i + 2] = v.z; }
      const index = g.index ? new Uint32Array(g.index.array) : null;
      const colores = op === 'color' ? coloresPorCara(src) : null;
      if (op === 'color' && !colores) throw Error('La pieza no tiene varios colores (materiales o colores de vértice) que separar.');
      ocupado(true); info('Preparando…');
      const w = new Worker(new URL('./nucleo-trabajador.js', import.meta.url), { type: 'module' }); worker = w;
      w.onerror = e => { if (worker !== w) return; w.terminate(); worker = null; ocupado(false); info('No se pudo iniciar el cálculo: ' + (e.message || 'error del Worker')); };
      w.onmessage = ({ data }) => {
        if (worker !== w) return;
        if (data.type === 'progress') { info(data.text); return; }
        w.terminate(); worker = null; ocupado(false);
        if (data.type === 'error') { info('No se aplicó: ' + data.message); return; }
        try {
          if (!api.isCurrent(token)) throw Error('La pieza cambió durante el cálculo. Vuelve a intentarlo.');
          const inv = src.matrixWorld.clone().invert(), geoms = data.result.piezas.map(pz => {
            const pos = pz.positions;
            for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(inv); pos[i] = v.x; pos[i + 1] = v.y; pos[i + 2] = v.z; }
            const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(pz.index, 1)); geo.computeVertexNormals(); geo.computeBoundingBox();
            let hex = null;
            if (pz.color && colores) { const cuenta = new Map(); for (const c of pz.color) if (c >= 0) cuenta.set(c, (cuenta.get(c) || 0) + 1); let mejor = -1, n = -1; for (const [k, c] of cuenta) if (c > n) { n = c; mejor = k; } if (mejor >= 0) hex = colores.paleta[mejor]; }
            return { geometry: geo, color: hex };
          });
          api.commit(token, geoms, op);
          info(data.result.informe + ' Usa Deshacer para revertir.');
        } catch (e) { info('No se aplicó: ' + e.message); }
      };
      const transfers = [positions.buffer]; if (index) transfers.push(index.buffer); if (colores) transfers.push(colores.color.buffer);
      w.postMessage({ op, positions, index, color: colores ? colores.color : null, ...extra }, transfers);
    } catch (e) { ocupado(false); info(e.message); }
  }
  $('nucleoPartes').onclick = () => ejecutar('partes');
  $('nucleoReparar').onclick = () => ejecutar('reparar');
  $('nucleoCama').onclick = () => { try { const b = api.bed(); ejecutar('cama', { cama: [b.x, b.z, b.y] }); } catch (e) { info(e.message); } };
  $('nucleoColor').onclick = () => ejecutar('color', { boquilla: api.nozzle() });
  return { cancel: cancelar };
}

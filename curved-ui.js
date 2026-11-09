// Interfaz y operación reversible; el cálculo pesado ocurre en curved-worker.js.
import {validateSurface} from './curved-cut.js';
export function setupCurvedPanel(THREE,api){
 const panel=document.createElement('section');panel.id='curvedPanel';panel.hidden=true;panel.className='curved-panel';panel.setAttribute('aria-label','Corte curvo experimental');
 panel.innerHTML=`<div class="sheet-heading"><h2>Corte por región o curva</h2><button id="curveClose" aria-label="Cerrar corte curvo">✕</button></div>
 <p class="hint">«Exacto» separa lo marcado siguiendo sus aristas reales y lo cierra con una tapa interior compartida. Calcula dos piezas conservando el exterior. Revisa la vista previa antes de confirmar. Las nuevas piezas se muestran sin texturas.</p>
 <label>Método<select id="curveMode"><option value="exact">Exacto por el borde marcado (recomendado)</option><option value="manual">Curva ajustable</option><option value="selection">Curva ajustada a la selección (aproximada)</option><option value="saved">Superficie guardada</option></select></label>
 <label>Eje de altura local<select id="curveAxis"><option value="auto">Automático para selección · Z para curva ajustable</option><option value="0">X</option><option value="1">Y</option><option value="2">Z</option></select></label>
 <div id="curveManual"><label>Posición (%)<input id="curveFraction" type="number" value="65" min="1" max="99"></label><label>Curvatura (%)<input id="curveBend" type="number" value="20" min="-100" max="100"></label></div>
 <div id="curveSaved" hidden><input id="curveFile" type="file" accept=".json"><button id="curveReference" class="secondary full">Cargar superficie del STL de referencia</button><p id="curveFileName" class="hint">Sin superficie cargada.</p></div>
 <button id="curveCalculate" class="full">Calcular y previsualizar</button><button id="curveCancel" class="full secondary" hidden>Cancelar cálculo</button>
 <div id="curveReport" role="status" aria-live="polite">Selecciona una pieza en el visor.</div>
 <div id="curvePreview" hidden><label>Vista previa<select id="curveView"><option value="both">Ambas piezas ensambladas</option><option value="0">Solo pieza A</option><option value="1">Solo pieza B</option><option value="cap">Solo superficie interior</option><option value="mismatch" disabled>Comparar con la selección</option></select></label>
 <p id="curveFitLegend" class="hint" hidden>Comparación por centros de triángulos. Rojo: marcado que quedaría fuera de A. Violeta: no marcado que entraría en A. Revisa también los bordes reales del corte.</p><button id="curveConfirm" class="full">Confirmar separación</button><button id="curveDiscard" class="secondary full">Descartar vista previa</button></div>
 <button id="curveSaveSurface" class="secondary full" disabled>Guardar superficie de corte</button><button id="curveSaveReport" class="secondary full" disabled>Descargar comprobación</button>
 <p class="hint">Se comprueban cierre, orientación y volumen. La curva aproxima la selección; no certifica ausencia de todas las autointersecciones ni ajuste de impresión.</p>`;
 document.body.append(panel);const $=id=>panel.querySelector('#'+id);
 const launch=document.createElement('button');launch.textContent='Corte curvo';launch.id='curvedCutBtn';launch.type='button';launch.className='full secondary';document.querySelector('.left .tools').prepend(launch);
 const mobile=document.createElement('button');mobile.textContent='CURVO';mobile.id='mobileCurvedCut';mobile.type='button';document.querySelector('.mobile-dock').append(mobile);
 let worker=null,preview=null,lastSurface=null,lastReport=null,saved=null,opener=launch;
 function report(t){$('curveReport').textContent=t;api.status(t);}
 function busy(on){$('curveCalculate').disabled=on;for(const id of ['curveMode','curveAxis','curveFraction','curveBend','curveFile','curveReference'])$(id).disabled=on;$('curveCancel').hidden=!on;}
 function cancel(){if(worker){worker.terminate();worker=null;busy(false);report('Cálculo cancelado.');}}
 function disposeGeometry(g){if(g.userData.bisturiSharedPosition)g.deleteAttribute('position');if(g.userData.bisturiSharedIndex)g.setIndex(null);g.dispose();}
 function discard(){if(!preview)return;const p=preview;preview=null;p.group.removeFromParent();for(const m of p.meshes){disposeGeometry(m.geometry);m.material.dispose();}p.source.visible=p.visible;$('curvePreview').hidden=true;}
 function close(){cancel();discard();panel.hidden=true;opener.focus();}
 document.addEventListener('click',e=>{if((worker||preview)&&!panel.contains(e.target)&&e.target.closest('button,input,select,a')){cancel();discard();}},true);
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){cancel();discard();}},true);
 function open(button){document.dispatchEvent(new CustomEvent('bisturi:close-mobile-panels',{detail:{except:'curved'}}));panel.hidden=false;opener=button;$('curveClose').focus();}
 launch.onclick=()=>open(launch);mobile.onclick=()=>open(mobile);
 for(const id of ['curveFromSelection','mobileCurveFromSelection']){const button=document.getElementById(id);if(button)button.onclick=()=>{open(button);$('curveMode').value='exact';$('curveAxis').value='auto';mode();report('Se cortará exactamente por el borde de la región marcada. Pulsa «Calcular y previsualizar».');};}$('curveClose').onclick=close;$('curveCancel').onclick=cancel;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();e.preventDefault();}});
 document.addEventListener('bisturi:close-mobile-panels',e=>{if(e.detail?.except!=='curved'&&!panel.hidden)close();});
 function mode(){discard();$('curveManual').hidden=$('curveMode').value!=='manual';$('curveAxis').closest('label').hidden=$('curveMode').value==='exact';$('curveSaved').hidden=$('curveMode').value!=='saved';}
 $('curveMode').onchange=mode;for(const id of ['curveAxis','curveFraction','curveBend'])$(id).oninput=discard;
 $('curveFile').onchange=async e=>{try{discard();const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('El archivo de superficie es demasiado grande.');saved=validateSurface(JSON.parse(await file.text()));$('curveAxis').value=String(saved.axis);$('curveFileName').textContent=file.name;}catch(e){saved=null;report(e.message);}};
 $('curveReference').onclick=async()=>{try{const r=await fetch('./superficie_referencia.json');if(!r.ok)throw Error('No se pudo cargar la superficie de referencia.');saved=validateSurface(await r.json());$('curveAxis').value=String(saved.axis);$('curveFileName').textContent='STL de referencia: coordenadas originales.';}catch(e){report(e.message);}};
 function geometry(part){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(part.positions,3));g.setIndex(new THREE.BufferAttribute(part.index,1));g.computeVertexNormals();g.computeBoundingBox();return g;}
 function view(){if(!preview)return;const v=$('curveView').value;preview.meshes.forEach((m,i)=>m.visible=v==='both'?i<2:v==='cap'?i===2:v==='mismatch'?i>=3:i===Number(v));$('curveFitLegend').hidden=v!=='mismatch';}
 $('curveView').onchange=view;$('curveDiscard').onclick=()=>{discard();report('Vista previa descartada.');};
 function showResult(token,result){
 const source=token.source,group=new THREE.Group(),geometries=result.parts?[...result.parts,result.cap].map(geometry):[new THREE.BufferGeometry(),new THREE.BufferGeometry(),new THREE.BufferGeometry()],colors=[0x5ba8ec,0xefb272,0xffed70];
     group.position.copy(source.position);group.quaternion.copy(source.quaternion);group.scale.copy(source.scale);
     const meshes=geometries.map((g,i)=>{const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:colors[i],roughness:.65,side:THREE.DoubleSide}));m.raycast=()=>{};group.add(m);return m;});
     if(result.comparison){
      const original=source.geometry,position=original.getAttribute('position');
      for(const [ids,color,opacity] of [[null,0xaab9c9,.3],[result.comparison.missing,0xff453a,.95],[result.comparison.extra,0xc75bff,.95]]){
       const geo=new THREE.BufferGeometry();geo.userData.bisturiSharedPosition=true;geo.setAttribute('position',position);
       if(ids){const array=new Uint32Array(ids.length*3);let k=0;for(const face of ids)for(let j=0;j<3;j++)array[k++]=original.index?original.index.getX(3*face+j):3*face+j;geo.setIndex(new THREE.BufferAttribute(array,1));}
       else if(original.index){geo.setIndex(original.index);geo.userData.bisturiSharedIndex=true;}
       const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:!ids,polygonOffset:!!ids,polygonOffsetFactor:-2}));mesh.raycast=()=>{};mesh.renderOrder=ids?22:21;meshes.push(mesh);group.add(mesh);
      }
     }
     $('curveView').querySelector('[value="mismatch"]').disabled=!result.comparison;
     preview={group,meshes,source,token,visible:source.visible,result,valid:!!result.parts};source.parent.add(group);source.visible=false;
     lastSurface=result.surface;lastReport=result.report;for(const option of $('curveView').options)if(option.value!=='mismatch')option.disabled=!result.parts;$('curveView').value=result.parts?'both':'mismatch';$('curveConfirm').disabled=!result.parts;$('curvePreview').hidden=false;$('curveSaveSurface').disabled=false;$('curveSaveReport').disabled=false;view();
     const r=result.report,adjustment=r.selectionOptimization?.accepted?` Ajuste automático: +${(100*(r.selectionOptimization.candidateAreaIou-r.selectionOptimization.baselineAreaIou)).toFixed(2)} puntos de coincidencia.`:'',capStatus=r.containment?` Tapa comprobada en ${r.containment.samples.toLocaleString('es')} puntos${r.containment.refinement?.addedVertices?'; corrección interior aplicada':''}.`: '',fit=r.selectionFit?` Coincidencia por área: ${(100*r.selectionFit.areaIou).toFixed(1)} %. De lo marcado, la propuesta conservaría ${(100*r.selectionFit.selectedCoverage).toFixed(1)} %. A añadiría ${r.selectionFit.extra.toLocaleString('es')} caras no marcadas y dejaría fuera ${r.selectionFit.missing.toLocaleString('es')} marcadas. Usa «Comparar con la selección».`:'';
     if(r.method==='exacto-v2f'){$('curveSaveSurface').disabled=true;report(`Vista previa exacta: A (lo marcado) ${r.parts[0].triangles.toLocaleString('es')} triángulos en ${r.parts[0].components} pieza(s); B ${r.parts[1].triangles.toLocaleString('es')} triángulos en ${r.parts[1].components} pieza(s). Borde = aristas marcadas; exterior intacto. ${r.loops} contorno(s) cerrados con tapa ${[...new Set(r.capMethods)].join(', ')} (${r.capTriangles.toLocaleString('es')} triángulos). Error de volumen: ${(r.relativeVolumeError*100).toExponential(2)} %.${r.adjustedFaces?` Se añadieron ${r.adjustedFaces} caras para cerrar puntas del borde.`:''}${r.cleanup&&(r.cleanup.islas||r.cleanup.huecos||r.cleanup.dientes)?` Corrección automática: ${[r.cleanup.islas&&`${r.cleanup.islas} isla(s) suelta(s) quitada(s)`,r.cleanup.huecos&&`${r.cleanup.huecos} hueco(s) rellenado(s)`,r.cleanup.dientes&&`${r.cleanup.dientes} cara(s) de borde en diente ajustadas`].filter(Boolean).join(', ')}.`:''}${r.smoothing?` Borde suavizado (${r.smoothing.vertices} vértices; volumen ${(r.smoothing.cambioVolumen*100).toFixed(3)} %).`:''} Las diferencias con lo pintado se ven en «Comparar con la selección».`);return;}
     report(result.parts?`Vista previa: ${r.parts.map((p,i)=>`${i?'B':'A'}: ${p.triangles.toLocaleString('es')} triángulos, ${p.components} componente(s)`).join('; ')}. Exterior intacto: ${(100*r.unchangedExteriorAreaRatio).toFixed(4)} %. Error de volumen: ${(r.relativeVolumeError*100).toExponential(2)} %.${capStatus}${fit}${adjustment}`:`No se aplicó el corte: ${r.cutError}${fit} La comparación no es una pieza cortada.`);
 }
 $('curveCalculate').onclick=()=>{
  cancel();discard();let token;
  try {
   token=api.capture();const source=token.source,g=source.geometry,p=g.getAttribute('position');
   if(source.isSkinnedMesh||g.morphAttributes?.position?.length)throw Error('Aplica la deformación de la pieza antes del corte.');
   if(source.userData?.locked)throw Error('Desbloquea la pieza para cortarla.');
   const positions=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){positions[3*i]=p.getX(i);positions[3*i+1]=p.getY(i);positions[3*i+2]=p.getZ(i);}
   const index=g.index?new Uint32Array(g.index.array):null,mode=$('curveMode').value,axis=$('curveAxis').value==='auto'?null:Number($('curveAxis').value);let mask=null;
   if(mode==='selection'||mode==='exact'){const set=api.selection(source);if(!set?.size)throw Error('Este corte necesita una zona pintada: elegir la pieza no basta. Píntala con «Selección (Pincel)» o «Varita mágica» (se ve en amarillo). Para cortar la pieza entera con un plano recto, cierra este panel y usa «Aplicar corte por plano» en Corte manual.');mask=new Uint8Array((index?index.length:p.count)/3);for(const f of set)mask[f]=1;}
   if(mode==='saved'&&!saved)throw Error('Carga una superficie guardada.');
   busy(true);report('Preparando corte curvo…');const instance=new Worker(new URL('./curved-worker.js',import.meta.url),{type:'module'});worker=instance;
   const error=(message,data=null)=>{if(worker!==instance)return;instance.terminate();worker=null;busy(false);if(data?.comparison&&api.isCurrent(token)){try{showResult(token,{surface:data.surface,comparison:data.comparison,report:{selectionFit:data.comparison.metrics,cutError:message}});}catch(e){discard();report(e.message);}}else report('No se aplicó el corte: '+message);};
   instance.onerror=e=>error(e.message||'No pudo iniciarse el motor del corte.');
   instance.onmessage=({data})=>{
    if(worker!==instance)return;if(data.type==='progress'){report(data.text);return;}if(data.type==='error'){error(data.message,data);return;}
    instance.terminate();worker=null;busy(false);
    try{
     if(!api.isCurrent(token))throw Error('La pieza cambió durante el cálculo. Vuelve a calcular.');
     showResult(token,data.result);
    }catch(e){discard();report(e.message);}
   };
   const transfers=[positions.buffer];if(index)transfers.push(index.buffer);if(mask)transfers.push(mask.buffer);
   instance.postMessage({positions,index,mask,mode,axis,surface:mode==='saved'?{...saved,axis:axis??saved.axis}:null,fraction:Number($('curveFraction').value)/100,curvature:Number($('curveBend').value)/100},transfers);
  } catch(e){busy(false);report(e.message);}
 };
 $('curveConfirm').onclick=()=>{
  if(!preview||!preview.valid)return;const p=preview;
  try{if(!api.isCurrent(p.token))throw Error('El modelo cambió. Calcula de nuevo la vista previa.');
   p.source.visible=p.visible; // save() must capture the original visibility.
   const geometries=p.meshes.slice(0,2).map(m=>m.geometry);api.commit(p.token,geometries,p.result);
   p.group.removeFromParent();p.meshes.forEach((m,i)=>{if(i>=2)disposeGeometry(m.geometry);m.material.dispose();});preview=null;$('curvePreview').hidden=true;
   report('Corte curvo aplicado. Usa Atrás para deshacer. Las piezas conservan su posición de ensamblaje; puedes asignarlas a camas por separado.');
  }catch(e){discard();report('No se aplicó el corte: '+e.message);}
 };
 $('curveSaveSurface').onclick=()=>api.download(JSON.stringify(lastSurface,null,2),'superficie_curva.json','application/json');
 $('curveSaveReport').onclick=()=>api.download(JSON.stringify(lastReport,null,2),'comprobacion_corte_curvo.json','application/json');
 mode();
 return {cancel:()=>{cancel();discard();}};
}

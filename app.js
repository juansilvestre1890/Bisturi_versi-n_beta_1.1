import {loadRaycastAcceleration,accelerateSurfaceMeshes} from './raycast-acceleration.js';
import {createSurfaceSelector} from './selection-client.js';
import {setupCurvedPanel} from './curved-ui.js';
import {setupNucleoPanel} from './nucleo-ui.js';
import {sampleMushroom,guijarro,apoyarSopa} from './ejemplos-v2f.js';
import {organicSelectionRepairCandidates} from './organic-label-repair.js';
import {refineOrganicBoundaryLocal} from './organic-local-refine.js';
import {refineOrganicBoundary} from './organic-graph-refine.js';
import {extractOrganicPieceGeometry} from './organic-piece-extract.js';
import {growToRidge} from './organic-ridge-grow.js';
import {adjustSurfaceBoundary} from './surface-boundary-edit.js';
import {selectionBoundary} from './selection-boundary.js';
import {requireSingleSolid} from './solid-connectivity.js';
import {inspectOrganicSeam} from './organic-seam.js';
import {selectedSurfaceIslands} from './surface-islands.js';
import {islandContainingFace} from './surface-island-anchor.js';
import {surfacePreviewCounts} from './surface-preview.js';
import {validateAlignmentPinSpec} from './alignment-pin.js';
import {validateDovetailSpec,assertDovetailVolumeChange} from './dovetail-connector.js';
import {dovetailGeometry,cylindricalGeometry} from './connector-geometry.js';
import {aplicarEncastreExacto,prismaSuelto,colaDeMilano} from './encastre-exacto.js';
import {encastresEnCorte,diagnostico as diagEncastre} from './nucleo-encastres.js?v=20261108a';
import {dovetailOutline} from './dovetail-connector.js';
import {assertRectangularVolumeChange} from './rectangular-connector.js';
import {recoverBedLayout,assertBedLayoutRoundTrip} from './bed-project-roundtrip.js';
import {bedViewTransition,captureBedPlacementState} from './bed-view-switch.js';
import {sliceMeshByWorldPlane} from './plane-cut.js';
import {setupBisturi} from './bisturi-herramientas.js?v=20261108m';
import {repararUnionesT} from './mesh-tjunction.js?v=20261108a';
import {cruzaCuadrado,pegarFuera} from './plano-finito.js?v=20261108c';
import {detectarZona} from './bisturi-auto.js?v=20261108l';
import {orientar as orientarNucleo} from './nucleo-malla.js?v=2.10';
import {cortarPorSeleccion} from './nucleo-corte.js?v=2.10';
import {buildSelectionCaps,appendCap} from './surface-cap.js';
import {analyzeMeshGeometry} from './mesh-quality.js';
import {verifyOperationInput} from './operation-preflight.js';
import {assertCutVolumeConservation,signedMeshVolume} from './volume-integrity.js';
import {assertConnectorBooleanVolumeChanges} from './connector-volume-integrity.js';
import {assertCutHalfspaces} from './cut-result-integrity.js';
import {assertMatchingCutSeams} from './cut-seam-integrity.js';
import {inspectConnectorSpec, assertConnectorDepthFits, assertRadialWallSamples, assertConnectorPostBooleanMeasurements} from './connector-validation.js';
import {classifyImportedMesh} from './import-diagnostics.js';
import {buildGeneralReport} from './general-report.js';
import {chooseModelBundle,resourceName} from './model-bundle.js';
import {prepareSmallHoleRepair} from './mesh-repair.js';
import {repararMalla} from './reparar-malla.js?v=20261108i';
import {transferBetweenBeds,restoreDragPlacement,validateUniqueBedAssignments,validateFullBedBounds} from './bed-view-integrity.js';
import {planAutomaticBedLayout} from './bed-auto-layout.js';
import {convexHull,convexFootprintsOverlap,convexFootprintsDistance,rectangleFootprintDistance} from './bed-footprint.js';
import {inspectBedExportClearance,projectedSTLFootprint} from './bed-export-integrity.js';
import {inspectBinarySTL,inspectBinarySTLTopology} from './stl-validation.js';
import {convertSTLToSlicerZUp} from './stl-slicer-orientation.js';
import {assertCombinedBedSTLIntegrity} from './bed-combined-integrity.js';
import {summarizeRecoveredExport} from './recovered-export-audit.js';
import {inspectExpectedVertexMoments,assertSTLTransformIntegrity} from './export-geometry-integrity.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/+esm';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/controls/OrbitControls.js/+esm';
import {TransformControls} from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/controls/TransformControls.js/+esm';
import {STLLoader} from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/STLLoader.js/+esm';
import {OBJLoader} from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/OBJLoader.js/+esm';
import {MTLLoader} from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/MTLLoader.js/+esm';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js/+esm';
import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/FBXLoader.js/+esm';
import {ThreeMFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/3MFLoader.js/+esm';
import {STLExporter} from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/exporters/STLExporter.js/+esm';
const $=id=>document.getElementById(id),viewport=$('viewport');
let csgPromise=null;
async function loadCSG(){
  const button=$('pegApplyBtn');button.disabled=true;
  try{
    if(!csgPromise)csgPromise=import('three-bvh-csg').catch(()=>import('https://cdn.jsdelivr.net/npm/three-bvh-csg@0.0.17/+esm')).catch(error=>{csgPromise=null;throw error});
    const module=await csgPromise;
    if(!module.Brush||!module.Evaluator||module.ADDITION===undefined||module.SUBTRACTION===undefined)throw Error('Módulo CSG incompleto.');
    return module;
  }catch(error){csgPromise=null;throw Error('No se pudo cargar el motor de encastres. Comprueba la conexión e inténtalo de nuevo.');}
  finally{button.disabled=false;}
}
const scene=new THREE.Scene();scene.background=new THREE.Color('#0a1a2e');
const camera=new THREE.PerspectiveCamera(45,1,.01,100000);camera.position.set(160,110,190);
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(error){$('status').textContent='No se pudo iniciar la vista 3D: este navegador no permite WebGL.';viewport.textContent='WebGL no disponible. Prueba un navegador con aceleración gráfica.';throw error;}renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;viewport.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x526c94,2.3));const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(100,180,130);scene.add(key);
const grid=new THREE.GridHelper(400,24,0x2384b4,0x284963);scene.add(grid);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.08;
const transform=new TransformControls(camera,renderer.domElement);transform.addEventListener('dragging-changed',e=>orbit.enabled=!e.value);scene.add(transform.getHelper());
// El manipulador se coloca en el centro de la pieza (centro de su caja), no en su origen:
// se mueve un pivote invisible y la pieza sigue la misma transformación.
const gizmoPivot=new THREE.Object3D();gizmoPivot.name='Pivote del manipulador';scene.add(gizmoPivot);
let gizmoTarget=null;const gizmoStart={pivot:new THREE.Matrix4(),target:new THREE.Matrix4()};
function syncGizmoPivot(){
  if(!gizmoTarget)return;
  gizmoTarget.updateWorldMatrix(true,false);
  const box=new THREE.Box3().setFromObject(gizmoTarget),c=box.isEmpty()?gizmoTarget.getWorldPosition(new THREE.Vector3()):box.getCenter(new THREE.Vector3());
  gizmoPivot.position.copy(c);gizmoTarget.getWorldQuaternion(gizmoPivot.quaternion);gizmoPivot.scale.set(1,1,1);gizmoPivot.updateMatrixWorld(true);
  gizmoStart.pivot.copy(gizmoPivot.matrixWorld);gizmoStart.target.copy(gizmoTarget.matrixWorld);
}
function attachGizmo(obj){gizmoTarget=obj;syncGizmoPivot();transform.attach(gizmoPivot);}
transform.addEventListener('mouseDown',()=>syncGizmoPivot());
transform.addEventListener('objectChange',()=>{
  if(!gizmoTarget||transform.object!==gizmoPivot)return;
  gizmoPivot.updateMatrixWorld(true);
  // nueva matriz de la pieza = (pivote actual · pivote inicial⁻¹) · pieza inicial
  const delta=gizmoPivot.matrixWorld.clone().multiply(gizmoStart.pivot.clone().invert()),world=delta.multiply(gizmoStart.target);
  const parentInv=gizmoTarget.parent.matrixWorld.clone().invert(),local=parentInv.multiply(world);
  local.decompose(gizmoTarget.position,gizmoTarget.quaternion,gizmoTarget.scale);gizmoTarget.updateMatrixWorld(true);
});
transform.addEventListener('mouseUp',()=>syncGizmoPivot());
// Guía de corte transparente. No cambia la geometría ni ejecuta el corte.
const cutGuide=new THREE.Group();scene.add(cutGuide);
const guideSurface=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x35d8ff,transparent:true,opacity:.4,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
const guideBorder=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1,1)),new THREE.LineBasicMaterial({color:0x8ef2ff,transparent:true,opacity:.98,depthTest:false}));
cutGuide.add(guideSurface,guideBorder);cutGuide.visible=false;
let showCutGuide=false,cutPair=null,touchPlaneActive=false,planeDrag=null;
// Asa 3D que facilita tomar el plano desde una pantalla táctil.
const planeHandle=new THREE.Mesh(new THREE.SphereGeometry(.025,20,14),new THREE.MeshBasicMaterial({color:0xffdf71,depthTest:false}));
cutGuide.add(planeHandle);planeHandle.renderOrder=25;

function planeNormal(){const axis=$('cutOrientation').value;if(axis==='X')return new THREE.Vector3(1,0,0);if(axis==='Z')return new THREE.Vector3(0,0,1);if(axis==='inclinado'){const x=Number($('cutAngleX').value),z=Number($('cutAngleZ').value);if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Ángulos no válidos.');return new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(THREE.MathUtils.degToRad(x),0,THREE.MathUtils.degToRad(z),'XYZ')).normalize()}return new THREE.Vector3(0,1,0)}
function refreshCutGuide(){
  if(!showCutGuide||!selected||bedMode||explode||!meshes.includes(selected)||!selected.visible){cutGuide.visible=false;return}
  const position=selected.geometry?.getAttribute('position');if(!position){cutGuide.visible=false;return}
  let normal;try{normal=planeNormal()}catch(e){cutGuide.visible=false;status(e.message);return}
  const percent=Number($('cutPercent').value);if(!Number.isFinite(percent)||percent<=0||percent>=100){cutGuide.visible=false;return}
  selected.updateWorldMatrix(true,false);
  const vertex=new THREE.Vector3(),world=new THREE.Vector3();let low=Infinity,high=-Infinity;
  for(let i=0;i<position.count;i++){vertex.fromBufferAttribute(position,i);world.copy(vertex).applyMatrix4(selected.matrixWorld);const d=world.dot(normal);low=Math.min(low,d);high=Math.max(high,d)}
  if(!(high>low)){cutGuide.visible=false;return}
  const level=THREE.MathUtils.lerp(low,high,percent/100);
  const center=new THREE.Box3().setFromObject(selected).getCenter(new THREE.Vector3());
  const onPlane=center.addScaledVector(normal,level-center.dot(normal));
  const extent=new THREE.Box3().setFromObject(selected).getSize(new THREE.Vector3()).length()*1.3;
  cutGuide.position.copy(onPlane);cutGuide.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);cutGuide.scale.set(Math.max(extent,1),Math.max(extent,1),1);planeHandle.visible=touchPlaneActive;cutGuide.visible=true;
}
function setGuide(on){showCutGuide=on;if(!on)planeDrag=null;refreshCutGuide();$('previewCutBtn').textContent=on?'Ocultar plano de corte':'Mostrar plano de corte';$('mobilePreviewCut').textContent=on?'Ocultar plano':'Ver plano'}
function syncResultButtons(){const can=!!cutPair&&cutPair.every(m=>meshes.includes(m));$('showCutResult').disabled=!can;$('mobileShowCutResult').disabled=!can;const label=explode?'Reunir piezas':'Separar piezas para revisar';$('showCutResult').textContent=label;$('mobileShowCutResult').textContent=label;}

function syncPlaneTouchUI(){
  for(const id of ['touchPlaneBtn','mobileTouchPlane']){
    const el=$(id);if(!el)continue;el.classList.toggle('active',touchPlaneActive);
    el.textContent=touchPlaneActive?'Desactivar ajuste táctil':'Ajustar plano con el dedo';
  }
  renderer.domElement.style.cursor=touchPlaneActive?'grab':'';
}
function togglePlaneTouch(){
  if(!touchPlaneActive){if(typeof pegTouchActive!=='undefined'&&pegTouchActive){status('Finaliza el movimiento de pasadores antes de ajustar el plano.');return;}if(['Pincel','Varita','Magnético'].includes(tool)){setTool('Seleccionar');}}
  touchPlaneActive=!touchPlaneActive;setGuide(touchPlaneActive||showCutGuide);
  if(touchPlaneActive){
    if(bedMode){touchPlaneActive=false;status('Sal de la vista de camas para ajustar el corte.');}
    else if(!selected){touchPlaneActive=false;status('Selecciona primero una malla.');}
    else status('Arrastra el punto amarillo del plano para subirlo o bajarlo.');
  }
  if(!touchPlaneActive)planeDrag=null;
  syncPlaneTouchUI();refreshCutGuide();
}
// Arrastre del plano: se calcula según la dirección de su normal proyectada en pantalla.
// Los movimientos de cámara no intervienen mientras se arrastra el asa.
const planeRay=new THREE.Raycaster(),planePointer=new THREE.Vector2();
function touchRay(e){const r=renderer.domElement.getBoundingClientRect();planePointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);planeRay.setFromCamera(planePointer,camera);return r;}
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!touchPlaneActive||!showCutGuide||!cutGuide.visible||!e.isPrimary||bedMode)return;
  const r=touchRay(e);
  // Permite iniciar desde el asa o desde la superficie del plano.
  const hit=planeRay.intersectObjects([planeHandle,guideSurface],false);
  if(!hit.length)return;
  const normal=planeNormal(),world=cutGuide.position.clone();
  const screenA=world.clone().project(camera),screenB=world.clone().addScaledVector(normal,Math.max(cutGuide.scale.x*.25,1)).project(camera);
  const dx=(screenB.x-screenA.x)*r.width*.5,dy=-(screenB.y-screenA.y)*r.height*.5;
  const screenLen=Math.hypot(dx,dy);
  const position=selected.geometry?.getAttribute('position');let low=Infinity,high=-Infinity;
  selected.updateWorldMatrix(true,false);
  const vertex=new THREE.Vector3();for(let i=0;i<position.count;i++){const d=vertex.fromBufferAttribute(position,i).applyMatrix4(selected.matrixWorld).dot(normal);low=Math.min(low,d);high=Math.max(high,d)}
  const normalSpan=high-low;
  if(!(normalSpan>0))return;
  const worldStep=Math.max(cutGuide.scale.x*.25,1);
  planeDrag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,percent:Number($('cutPercent').value),dx,dy,screenLen,worldStep,normalSpan};
  renderer.domElement.setPointerCapture(e.pointerId);orbit.enabled=false;renderer.domElement.style.cursor='grabbing';e.stopImmediatePropagation();e.preventDefault();
},true);
renderer.domElement.addEventListener('pointermove',e=>{
  if(!planeDrag||e.pointerId!==planeDrag.pointerId)return;
  const d=planeDrag,moveX=e.clientX-d.x,moveY=e.clientY-d.y;
  // Si la normal apunta a la cámara y se proyecta muy poco, el gesto vertical queda como alternativa.
  const deltaPercent=d.screenLen<8?(-moveY*.35):((moveX*d.dx+moveY*d.dy)/(d.screenLen*d.screenLen))*d.worldStep/d.normalSpan*100;
  const percent=Math.max(1,Math.min(99,Math.round(d.percent+deltaPercent)));
  $('cutPercent').value=String(percent);$('mobileCutPercent').value=String(percent);$('mobileCutValue').textContent=percent+'%';refreshCutGuide();
  e.stopImmediatePropagation();e.preventDefault();
},true);
const finishPlaneDrag=e=>{
  if(!planeDrag||e.pointerId!==planeDrag.pointerId)return;
  const previous=planeDrag.percent;planeDrag=null;orbit.enabled=true;renderer.domElement.style.cursor='grab';
  try{renderer.domElement.releasePointerCapture(e.pointerId)}catch(_){}
  if(e.type==='pointercancel'){$('cutPercent').value=String(previous);$('mobileCutPercent').value=String(previous);$('mobileCutValue').textContent=previous+'%';refreshCutGuide();status('Movimiento del plano cancelado; posición anterior restaurada.')}
  else status('Plano ajustado al '+$('cutPercent').value+' %. Confirma el corte cuando esté en la posición deseada.');
  e.stopImmediatePropagation();
};
renderer.domElement.addEventListener('pointerup',finishPlaneDrag,true);
renderer.domElement.addEventListener('pointercancel',finishPlaneDrag,true);

const root=new THREE.Group();scene.add(root);const bedStage=new THREE.Group();scene.add(bedStage);bedStage.visible=false;let bedMode=false,allBedsView=false,stagePick=new Map(),dragBed=null,bedOffsets=new Map(),bedPlates=new Map();let meshes=[],selected=null,modelLoaded=false,explode=false,xray=false,mode='Mixto',tool='Seleccionar',undo=[],redo=[],basePositions=new Map(),explodeOrigins=new Map(),originalMaterials=new Map(),dirty=false;
// Selección visual de triángulos; separación segura de componentes cerrados completos.
const surfaceSelections=new Map(),surfaceOverlays=new Map(),lastSurfaceTouch=new Map();
const boundaryOverlays=new Map();let boundaryVisible=false;
let surfaceDrag=null,surfaceRefreshQueued=false;
function surfaceMeshTriangles(m){const g=m.geometry,p=g?.getAttribute('position');return p?Math.floor((g.index?g.index.count:p.count)/3):0}
function faceVertices(m,face,out){const g=m.geometry,p=g.getAttribute('position'),idx=g.index;for(let j=0;j<3;j++){const i=idx?idx.getX(face*3+j):face*3+j;out[j].fromBufferAttribute(p,i)}return out}
function surfaceSet(m){if(!surfaceSelections.has(m.uuid))surfaceSelections.set(m.uuid,new Set());return surfaceSelections.get(m.uuid)}
let surfacePreview=null;
function disposeSurfaceGeometry(geometry){
 // Las superposiciones comparten posiciones con la pieza; no liberar su buffer GPU.
 if(geometry.userData.bisturiSharedPosition)geometry.deleteAttribute('position');
 geometry.dispose();
}
function clearSurfacePreview(){
  if(surfacePreview){surfacePreview.overlay.removeFromParent();disposeSurfaceGeometry(surfacePreview.overlay.geometry);surfacePreview.overlay.material.dispose();surfacePreview=null}
  for(const id of ['surfacePreviewInfo','mobileSurfacePreviewInfo']){const el=$(id);if(el)el.textContent='Vista previa desactivada.'}
  for(const id of ['surfacePreviewBtn','mobileSurfacePreview']){const el=$(id);if(el){el.textContent='Vista previa de separación';el.setAttribute('aria-pressed','false')}}
}
function toggleSurfacePreview(){
  if(surfacePreview){clearSurfacePreview();status('Vista previa de separación cerrada.');return}
  if(bedMode||explode||xray||!selected||!meshes.includes(selected)){status('Regresa al visor normal y selecciona una pieza antes de previsualizar.');return}
  const m=selected,faces=surfaceSelections.get(m.uuid),g=m.geometry,pos=g?.getAttribute('position');
  if(!pos||pos.itemSize!==3){status('La pieza no tiene geometría válida.');return}
  const total=surfaceMeshTriangles(m);let counts;
  try{counts=surfacePreviewCounts(total,faces||new Set())}catch(e){status('Vista previa: '+e.message);return}
  const idx=g.index,arr=new Uint32Array(counts.remainder*3);let k=0;
  for(let f=0;f<total;f++)if(!faces.has(f))for(let j=0;j<3;j++)arr[k++]=idx?idx.getX(f*3+j):f*3+j;
  const geometry=new THREE.BufferGeometry();geometry.userData.bisturiSharedPosition=true;geometry.setAttribute('position',pos);geometry.setIndex(new THREE.BufferAttribute(arr,1));
  const material=new THREE.MeshBasicMaterial({color:0x43b9ff,transparent:true,opacity:.58,depthTest:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3});
  const overlay=new THREE.Mesh(geometry,material);overlay.raycast=()=>{};overlay.renderOrder=19;m.add(overlay);
  surfacePreview={overlay,meshId:m.uuid};
  const msg=`Vista previa: amarillo = selección (${counts.selected.toLocaleString('es')} triángulos); azul = resto (${counts.remainder.toLocaleString('es')}). No se ha realizado ningún corte.`;
  for(const id of ['surfacePreviewInfo','mobileSurfacePreviewInfo']){const el=$(id);if(el)el.textContent=msg}
  for(const id of ['surfacePreviewBtn','mobileSurfacePreview']){const el=$(id);if(el){el.textContent='Cerrar vista previa';el.setAttribute('aria-pressed','true')}}
  status('Vista previa activa. Inspecciona la figura desde varios ángulos antes de separar.');
}
$('surfacePreviewBtn').onclick=toggleSurfacePreview;
$('mobileSurfacePreview').onclick=()=>{toggleSurfacePreview();};
function clearSurfaceOverlays(){cancelSurfaceWork();lastSurfaceTouch.clear();clearSurfacePreview();for(const overlay of surfaceOverlays.values()){overlay.removeFromParent();overlay.geometry.dispose();overlay.material.dispose()}surfaceOverlays.clear();for(const outline of boundaryOverlays.values()){outline.removeFromParent();outline.geometry.dispose();outline.material.dispose()}boundaryOverlays.clear();surfaceSelections.clear();updateSurfaceInfo()}
function updateSurfaceInfo(){const total=[...surfaceSelections.values()].reduce((n,v)=>n+v.size,0);const el=$('surfaceInfo');if(el)el.textContent=`${total.toLocaleString('es')} triángulos marcados. Usa Cortar región marcada para cortar exactamente por su borde.`;}
function updateSurfaceOverlay(m){
 if(surfacePreview)clearSurfacePreview();removeBoundaryOverlay(m);
 const faces=surfaceSelections.get(m.uuid);let overlay=surfaceOverlays.get(m.uuid);
 if(!faces?.size){if(overlay){overlay.removeFromParent();disposeSurfaceGeometry(overlay.geometry);overlay.material.dispose();surfaceOverlays.delete(m.uuid);}updateSurfaceInfo();return;}
 const source=m.geometry,pos=source.getAttribute('position'),idx=source.index,needed=faces.size*3;
 if(!overlay){
  const geo=new THREE.BufferGeometry();geo.userData.bisturiSharedPosition=true;geo.setAttribute('position',pos);
  overlay=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffd65b,transparent:true,opacity:.75,depthTest:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));
  overlay.raycast=()=>{};overlay.renderOrder=20;m.add(overlay);surfaceOverlays.set(m.uuid,overlay);
 }
 const geo=overlay.geometry;
 if(!geo.index||geo.index.count<needed){
  const capacity=Math.min(surfaceMeshTriangles(m)*3,Math.max(needed,Math.ceil((geo.index?.count||512)*1.5)));
  disposeSurfaceGeometry(geo);geo.setAttribute('position',pos);geo.setIndex(new THREE.BufferAttribute(new Uint32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
 }
 let t=0;for(const f of faces)for(let j=0;j<3;j++)geo.index.array[t++]=idx?idx.getX(f*3+j):f*3+j;
 geo.index.clearUpdateRanges();geo.index.addUpdateRange(0,needed);geo.index.needsUpdate=true;geo.setDrawRange(0,needed);
 if(!source.boundingSphere)source.computeBoundingSphere();geo.boundingSphere=source.boundingSphere.clone();updateSurfaceInfo();
 if(boundaryVisible&&surfaceMeshTriangles(m)<=250000)try{drawSelectionBoundary(m)}catch(e){status('Contorno: '+e.message);}
}
const surfaceSelector=createSurfaceSelector(THREE,{
 status,
 busy:on=>{for(const id of ['cancelSurfaceTask','mobileCancelSurfaceTask'])if($(id))$(id).hidden=!on;},
 isCurrent:(mesh,geometry)=>meshes.includes(mesh)&&mesh.geometry===geometry&&mesh.visible&&!bedMode&&!explode&&!xray,
 apply:(mesh,faces,erase,stroke,seed)=>{
  const set=surfaceSet(mesh);let changed=false;
  for(const face of faces)if(erase?set.has(face):!set.has(face)){changed=true;break;}
  if(!changed)return;
  if(!stroke.saved){save();stroke.saved=true;}
  for(const face of faces)if(erase)set.delete(face);else set.add(face);
  if(!erase)lastSurfaceTouch.set(mesh.uuid,seed);
  updateSurfaceOverlay(mesh);dirty=true;
 }
});
for(const id of ['cancelSurfaceTask','mobileCancelSurfaceTask'])if($(id))$(id).onclick=()=>{surfaceSelector.cancel();status('Cálculo de selección cancelado. Se conserva lo ya marcado; Atrás lo revierte.');};
// Cualquier acción sobre el proyecto invalida trabajos pendientes antes de mutarlo.
document.addEventListener('click',e=>{if(surfaceSelector.busy()&&e.target.closest('button,input,select,a'))cancelSurfaceWork();},true);
document.addEventListener('change',e=>{if(surfaceSelector.busy()&&e.target.matches('input,select'))cancelSurfaceWork();},true);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())||e.key==='Escape')cancelSurfaceWork();},true);
function cancelSurfaceWork(){surfaceSelector.cancel();if(surfaceDrag){try{renderer.domElement.releasePointerCapture(surfaceDrag.id)}catch(_){}surfaceDrag=null;orbit.enabled=true;}}
function surfaceRaycast(e){accelerateSurfaceMeshes(meshes);ray.firstHitOnly=true;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(meshes.filter(m=>m.visible),false)[0]}
function surfacePaint(e,knownHit=null){
 if(surfacePreview)clearSurfacePreview();const hit=knownHit||surfaceRaycast(e);if(!hit||!hit.object.isMesh)return;
 selected=hit.object;updateList();const direction=camera.getWorldPosition(new THREE.Vector3()).sub(hit.point).normalize();
 const kind=tool==='Pincel'?'brush':tool==='Varita'?'wand':'magnetic';
 surfaceSelector.paint(hit,{kind,radius:Number($('brushRadius').value),tolerance:Number($(kind==='wand'?'wandTolerance':'magneticColor').value)/100,angle:Number($('magneticAngle').value),reach:Number($('magneticReach').value),cameraDirection:direction.toArray(),erase:$('brushErase').checked},surfaceDrag.stroke);
}
renderer.domElement.addEventListener('pointerdown',e=>{
 if(bedMode||!['Pincel','Varita','Magnético'].includes(tool)||!e.isPrimary)return;
 if(explode||xray)return status('Reúne las piezas y desactiva Rayos X antes de pintar.');
 if(e.pointerType==='touch'&&e.width>45)return;const hit=surfaceRaycast(e);if(!hit)return;
 e.preventDefault();e.stopImmediatePropagation();surfaceDrag={id:e.pointerId,x:e.clientX,y:e.clientY,stroke:{saved:false}};
 orbit.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);surfacePaint(e,hit);
},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!surfaceDrag||surfaceDrag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();if(tool==='Pincel'&&Math.hypot(e.clientX-surfaceDrag.x,e.clientY-surfaceDrag.y)>5){surfaceDrag.x=e.clientX;surfaceDrag.y=e.clientY;surfacePaint(e)}},true);
function stopSurfaceStroke(e){if(!surfaceDrag||surfaceDrag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();try{renderer.domElement.releasePointerCapture(e.pointerId)}catch(_){}surfaceDrag=null;orbit.enabled=true;}
renderer.domElement.addEventListener('pointerup',stopSurfaceStroke,true);renderer.domElement.addEventListener('pointercancel',e=>{if(surfaceDrag?.id===e.pointerId){stopSurfaceStroke(e);surfaceSelector.cancel();status('Trazo interrumpido; se conserva lo marcado. Usa Atrás para revertirlo.')}},true);
function setSurfaceTool(t){if(surfacePreview)clearSurfacePreview();if(touchPlaneActive){touchPlaneActive=false;planeDrag=null;syncPlaneTouchUI();setGuide(false);}if(pegTouchActive)disablePegTouch();setTool(t);$('brushTool').classList.toggle('active',t==='Pincel');$('wandTool').classList.toggle('active',t==='Varita');$('magneticTool').classList.toggle('active',t==='Magnético');status(t==='Pincel'?'Pincel activo: toca o arrastra sobre la malla.':t==='Varita'?'Varita activa: toca una región de color.':'Magnético activo: toca una región; la selección seguirá bordes de forma y color.')}
$('brushTool').onclick=()=>setSurfaceTool('Pincel');$('wandTool').onclick=()=>setSurfaceTool('Varita');$('magneticTool').onclick=()=>setSurfaceTool('Magnético');
function removeBoundaryOverlay(mesh){
 const outline=boundaryOverlays.get(mesh.uuid);
 if(outline){outline.removeFromParent();outline.geometry.dispose();outline.material.dispose();boundaryOverlays.delete(mesh.uuid)}
}
function inspectSelectionBoundary(mesh){
 const g=mesh.geometry,p=g.getAttribute('position'),ix=g.index;
 if(!p)throw Error('La malla no contiene posiciones');
 return selectionBoundary(p.array,ix?ix.array:null,surfaceSelections.get(mesh.uuid)||new Set());
}
function drawSelectionBoundary(mesh){
 removeBoundaryOverlay(mesh);
 if(!boundaryVisible||!surfaceSelections.get(mesh.uuid)?.size)return;
 const result=inspectSelectionBoundary(mesh),array=new Float32Array(result.segments.length*6);
 result.segments.forEach(([a,b],i)=>array.set([...a,...b],i*6));
 if(array.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(array,3));
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xff3f86,depthTest:false,transparent:true,opacity:.98}));
  lines.raycast=()=>{};lines.renderOrder=31;mesh.add(lines);boundaryOverlays.set(mesh.uuid,lines)}
 return result;
}
function toggleSelectionBoundary(){
 boundaryVisible=!boundaryVisible;
 const button=$('boundaryPreviewBtn');button.textContent=boundaryVisible?'Ocultar contorno':'Mostrar contorno';button.setAttribute('aria-pressed',String(boundaryVisible));
 for(const outline of [...boundaryOverlays.keys()]){const mesh=meshes.find(m=>m.uuid===outline);if(mesh)removeBoundaryOverlay(mesh)}
 if(!boundaryVisible)return status('Contornos de selección ocultados.');
 try{
   let report=null;
   for(const mesh of meshes)if(surfaceSelections.get(mesh.uuid)?.size){const result=drawSelectionBoundary(mesh);if(mesh===selected)report=result}
   if(!report)return status('Contorno activado. Selecciona y pinta una parte del modelo.');
   status(`Contorno: ${report.edges} aristas, ${report.components} trazos, ${report.openNodes} extremos abiertos, ${report.branchNodes} ramificaciones. ${report.simpleLoop?'Un bucle simple.':'Revisa la selección antes de separar.'}`);
 }catch(e){status('No se pudo visualizar el contorno: '+e.message)}
}
$('boundaryPreviewBtn').onclick=toggleSelectionBoundary;
function refineSurfaceWithGraph(){
  if(bedMode||explode||xray||!selected)return status('Selecciona primero una figura en el visor normal.');
  const m=selected,faces=surfaceSelections.get(m.uuid);
  try{
    const result=refineOrganicBoundaryLocal(m.geometry,faces);
    if(result.changed){save();surfaceSelections.set(m.uuid,result.faces);updateSurfaceOverlay(m);dirty=true;}
    status(`Ajuste por relieve: ${result.changed} triángulos modificados. Revisa el contorno y pulsa «Verificar separación sin cortar». No se ha cortado la malla.`);
  }catch(e){status('Ajuste de contorno: '+e.message)}
}
// Ajuste atómico: solo conserva el contorno propuesto si las dos mitades
// superan la misma reconstrucción y las mismas comprobaciones que el corte.
function refineAndVerifyOrganicCut(){
  if(bedMode||explode||xray||!selected)return status('Selecciona una figura en el visor normal.');
  const mesh=selected,original=surfaceSelections.get(mesh.uuid);
  if(!original?.size)return status('Pinta primero el cabello o la región que quieres separar.');
  let candidate;
  try{candidate=refineOrganicBoundaryLocal(mesh.geometry,original)}
  catch(e){return status('Ajuste y verificación cancelados: '+e.message)}
  // Solo una sustitución temporal de la selección en memoria, SIN actualizar
  // la superposición visual ni el historial mientras se comprueba el corte.
  surfaceSelections.set(mesh.uuid,candidate.faces);
  let valid=false;
  try{valid=verifySurfaceSeparation()}
  catch(e){status('Error en verificación orgánica: '+e.message)}
  finally{surfaceSelections.set(mesh.uuid,original)}
  if(!valid)return status('Ajuste descartado: la reconstrucción completa no produjo dos sólidos válidos. Se conservó la selección anterior.');
  if(candidate.changed){save();surfaceSelections.set(mesh.uuid,candidate.faces);updateSurfaceOverlay(mesh);dirty=true}
  status('Ajuste verificado: '+candidate.changed+' triángulos corregidos; dos sólidos cerrados y volumen conservado en la simulación. La figura no se ha cortado. Pulsa «Separar selección» para confirmar.');
}
// Recuperación conservadora: ensaya errores pequeños sin comprometer el modelo.
function repairAndVerifyOrganicCut(){
 if(bedMode||explode||xray||!selected)return status('Selecciona una malla en el visor normal.');
 const mesh=selected,original=surfaceSelections.get(mesh.uuid);
 if(!original?.size)return status('Marca primero el cabello o la región deseada.');
 let candidates;try{candidates=organicSelectionRepairCandidates(mesh.geometry,original)}
 catch(e){return status('No se pudo analizar la selección: '+e.message)}
 if(!candidates.length)return status('No se encontraron defectos pequeños que puedan repararse automáticamente.');
 let chosen=null;
 try{
  for(const candidate of candidates){
   surfaceSelections.set(mesh.uuid,candidate.faces);
   let ok=false;try{ok=verifySurfaceSeparation()}catch(_e){ok=false}
   if(ok){chosen=candidate;break}
  }
 }finally{surfaceSelections.set(mesh.uuid,original)}
 if(!chosen)return status('No hubo una reparación verificable; se conserva la selección anterior.');
 save();surfaceSelections.set(mesh.uuid,chosen.faces);updateSurfaceOverlay(mesh);dirty=true;
 status('Selección reparada y verificada: '+chosen.changed+' triángulos corregidos. Pulsa «Separar selección» para confirmar.');
}
$('repairOrganicSelection').onclick=repairAndVerifyOrganicCut;
$('mobileRepairOrganicSelection').onclick=()=>{if(!$('mobileSurfaceSheet').hidden)$('mobileCloseSurface').click();repairAndVerifyOrganicCut()};
$('refineAndVerifyOrganic').onclick=refineAndVerifyOrganicCut;
$('mobileRefineAndVerifyOrganic').onclick=()=>{if(!$('mobileSurfaceSheet').hidden)$('mobileCloseSurface').click();refineAndVerifyOrganicCut()};
$('refineOrganicGraph').onclick=refineSurfaceWithGraph;
$('mobileRefineOrganicGraph').onclick=()=>{if(!$('mobileSurfaceSheet').hidden)$('mobileCloseSurface').click();refineSurfaceWithGraph()};

$('clearSurfaceSelection').onclick=()=>{save();clearSurfaceOverlays();status('Selección visual limpiada.')};
function isolateLargestSurfaceIsland(){
  if(bedMode||!selected)return status('Selecciona primero una malla en el visor del modelo.');
  const mesh=selected,faces=surfaceSelections.get(mesh.uuid);
  if(!faces?.size)return status('Marca una superficie antes de aislar su región principal.');
  let islands;
  try{islands=selectedSurfaceIslands(mesh.geometry,faces)}catch(e){return status('No se pudo analizar la selección: '+e.message)}
  if(islands.length===1)return status('La selección ya forma una única región conectada ('+islands[0].length+' triángulos).');
  save();surfaceSelections.set(mesh.uuid,new Set(islands[0]));updateSurfaceOverlay(mesh);
  dirty=true;
  status('Región principal aislada: '+islands[0].length+' triángulos. Se descartaron '+(islands.length-1)+' islas menores de la selección, sin modificar la figura.');
}
function isolateTouchedSurfaceIsland(){
  if(bedMode||!selected)return status('Selecciona una malla en el visor del modelo.');
  const mesh=selected,faces=surfaceSelections.get(mesh.uuid),anchor=lastSurfaceTouch.get(mesh.uuid);
  if(!faces?.size)return status('Marca primero una región de la figura.');
  if(!Number.isInteger(anchor)||!faces.has(anchor))return status('Toca con Pincel, Varita o Magnético la región que deseas conservar, sin borrar ese triángulo.');
  try{
    const islands=selectedSurfaceIslands(mesh.geometry,faces);
    const island=islandContainingFace(islands,anchor);
    if(!island)return status('La región tocada ya no pertenece a la selección. Vuelve a tocarla.');
    if(islands.length===1)return status('La selección ya corresponde a una región conectada.');
    save();surfaceSelections.set(mesh.uuid,new Set(island));updateSurfaceOverlay(mesh);dirty=true;
    status('Región tocada conservada: '+island.length+' triángulos. Se descartaron '+(islands.length-1)+' regiones adicionales. La malla no se modificó.');
  }catch(err){status('No se pudo aislar la región tocada: '+err.message)}
}
$('isolateTouchedSurfaceIsland').onclick=isolateTouchedSurfaceIsland;
$('mobileIsolateTouchedSurfaceIsland').onclick=isolateTouchedSurfaceIsland;
$('isolateSurfaceIsland').onclick=isolateLargestSurfaceIsland;
$('mobileIsolateSurfaceIsland').onclick=isolateLargestSurfaceIsland;

function adjustSelectedBoundary(direction){
  if(bedMode||!selected||!meshes.includes(selected))return status('Selecciona una malla en el visor del modelo.');
  const mesh=selected,faces=surfaceSelections.get(mesh.uuid);
  if(!faces?.size)return status('Marca primero la superficie que deseas ajustar.');
  try{
    const next=adjustSurfaceBoundary(mesh.geometry,faces,direction);
    if(next.faces.size===faces.size)return status('El borde ya no admite ese ajuste.');
    save();surfaceSelections.set(mesh.uuid,next.faces);
    if(!next.faces.has(lastSurfaceTouch.get(mesh.uuid)))lastSurfaceTouch.delete(mesh.uuid);
    updateSurfaceOverlay(mesh);dirty=true;
    status(direction==='grow'?`Selección ampliada en ${next.added} triángulos.`:`Selección reducida en ${next.removed} triángulos.`);
  }catch(err){status('Borde sin modificar: '+err.message)}
}
$('growSurfaceBoundary').onclick=()=>adjustSelectedBoundary('grow');
$('shrinkSurfaceBoundary').onclick=()=>adjustSelectedBoundary('shrink');
$('mobileGrowSurfaceBoundary').onclick=()=>adjustSelectedBoundary('grow');
$('mobileShrinkSurfaceBoundary').onclick=()=>adjustSelectedBoundary('shrink');
function growOrganicRelief(){
 if(bedMode||!selected||!meshes.includes(selected))return status('Selecciona una malla en el visor.');
 const mesh=selected,faces=surfaceSelections.get(mesh.uuid);
 if(!faces?.size)return status('Marca primero el cabello o la región que deseas ampliar.');
 try{
  const next=growToRidge(mesh.geometry,faces,{
   maxAngleDeg:Number($('magneticAngle').value),maxDistance:Number($('magneticReach').value),
   maxCumulativeBendDeg:Math.min(180,Math.max(45,Number($('magneticAngle').value)*2.5))
  });
  if(!next.added)return status('No hay más caras que cumplan el límite de relieve y alcance.');
  save();surfaceSelections.set(mesh.uuid,next.faces);updateSurfaceOverlay(mesh);dirty=true;
  status(`Crecimiento por relieve: ${next.added} triángulos añadidos. La curvatura acumulada está limitada; revisa el contorno antes de separar.`);
 }catch(err){status('No se modificó la selección: '+err.message)}
}
$('growOrganicRelief').onclick=growOrganicRelief;
$('mobileGrowOrganicRelief').onclick=growOrganicRelief;



// Separación conservadora de un componente ya cerrado en la malla. No inventa tapas para parches abiertos.
let previewOnlySeparation=false;
let separationPreviewPassed=false;
function verifySurfaceSeparation(){separationPreviewPassed=false;previewOnlySeparation=true;try{separateClosedSurface()}finally{previewOnlySeparation=false}return separationPreviewPassed}
function separateClosedSurface(){if(surfacePreview)clearSurfacePreview();
  if(bedMode)return status('Regresa al visor del modelo para separar.');
  if(!selected||!meshes.includes(selected))return status('Selecciona una malla con triángulos marcados.');
  if(explode||xray)return status('Desactiva Explosión y Rayos X antes de separar.');
  const source=selected,faces=surfaceSelections.get(source.uuid),total=surfaceMeshTriangles(source);
  if(!faces?.size)return status('Marca primero una región con el pincel o la varita.');
  if(faces.size>=total)return status('La selección abarca toda la malla. No queda otra pieza para separar.');
  // Evita separaciones ambiguas cuando el pincel ha marcado islas independientes.
  try{const islands=selectedSurfaceIslands(source.geometry,faces);
    if(islands.length!==1)return status('Hay '+islands.length+' regiones separadas en la selección. Usa «Aislar región principal» antes de separar.');
  }catch(e){return status('Selección no apta para separar: '+e.message)}

  // Primero comprueba la costura real entre superficies; nunca corta a través de agujeros.
  let seam;
  try { seam=inspectOrganicSeam(source.geometry,faces); }
  catch(e){return status('No es posible separar esta región: '+e.message)}
  if(total>250000)return status('Separación limitada a 250 000 triángulos por malla.');
  const g=source.geometry,pos=g.getAttribute('position'),idx=g.index;
  if(!pos||!pos.itemSize||pos.itemSize!==3)return status('La malla no contiene posiciones válidas.');
  // Los vértices se cuantizan solo para comprobar cierres. Una tolerancia pequeña evita unir piezas próximas.
  g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3()).length();
  const eps=Math.max(size*1e-7,1e-7);
  const quant=(x,y,z)=>[x,y,z].map(v=>Math.round(v/eps)).join(',');
  const edgeCounts=[new Map(),new Map()];
  const matGroups=[[],[]];
  for(let f=0;f<total;f++){
    const side=faces.has(f)?0:1;
    const vertices=[];
    for(let j=0;j<3;j++){
      const vi=idx?idx.getX(f*3+j):f*3+j;
      if(vi>=pos.count)return status('La malla contiene índices inválidos.');
      const key=quant(pos.getX(vi),pos.getY(vi),pos.getZ(vi));vertices.push(key);
    }
    if(new Set(vertices).size!==3)return status('Se encontraron triángulos degenerados; no se realizó separación.');
    for(let k=0;k<3;k++){
      const a=vertices[k],b=vertices[(k+1)%3],key=a<b?a+'|'+b:b+'|'+a;
      edgeCounts[side].set(key,(edgeCounts[side].get(key)||0)+1);
    }
    if(Array.isArray(source.material)){
      const offset=f*3;
      const group=g.groups.find(v=>offset>=v.start&&offset<v.start+v.count);
      matGroups[side].push(group?.materialIndex||0);
    }
  }
  const closed=counts=>counts.size>0&&[...counts.values()].every(n=>n===2);
  let caps=null,capKind=null;
  if(!closed(edgeCounts[0])||!closed(edgeCounts[1])){
    try{const closure=buildSelectionCaps(g,faces,THREE);caps=closure.caps;capKind=closure.kind}
    catch(e){return status('No se puede cerrar esta selección: '+e.message)}
  }
  // La extracción utilizada en el corte es ahora la misma que se ensaya con STL.
  const faceSets=[[],[]];
  for(let f=0;f<total;f++)faceSets[faces.has(f)?0:1].push(f);
  const build=(side)=>extractOrganicPieceGeometry(g,faceSets[side],THREE,{
    materialIndices:Array.isArray(source.material)?matGroups[side]:null
  });
  let geometries;
  try{geometries=[build(0),build(1)];if(caps)geometries=geometries.map((geometry,i)=>appendCap(geometry,caps[i],THREE));}catch(e){status('No se separó la selección: '+e.message);return}
  try{
    requireClosedResult(geometries[0],'Selección');
    requireClosedResult(geometries[1],'Resto');
    requireSingleSolid(geometries[0],'Selección');
    requireSingleSolid(geometries[1],'Resto');
    // Además de ser cerradas, ambas piezas deben conservar el volumen de la figura.
    // Esto detecta tapas invertidas y pérdidas de material que un simple conteo
    // de aristas manifold podría pasar por alto.
    assertCutVolumeConservation(g,geometries[0],geometries[1],{
      relativeTolerance:0.005,absoluteTolerance:1e-5
    });
  }catch(e){
    geometries.forEach(part=>part.dispose());
    status('Separación cancelada: '+e.message);
    return;
  }
  if(previewOnlySeparation){
    // Misma reconstrucción y validaciones que el corte definitivo, sin alterar
    // historial, selección, camas ni la figura original.
    const details=caps?'con tapa de costura '+capKind:'por componentes ya cerrados';
    const triangles=geometries.map(part=>part.getAttribute('position').count/3);
    geometries.forEach(part=>part.dispose());
    separationPreviewPassed=true;
    status('Verificación superada '+details+'. Piezas previstas: '+triangles.map(n=>Math.round(n)).join(' y ')+' triángulos. Puedes confirmar la separación; comprueba los STL finales en el laminador.');
    return;
  }
  save();(transform.detach(),gizmoTarget=null);clearSurfaceOverlays();
  const make=(geometry,suffix)=>{
    const part=new THREE.Mesh(geometry,source.material);
    part.name=source.name+' — '+suffix;
    part.position.copy(source.position);part.quaternion.copy(source.quaternion);part.scale.copy(source.scale);
    part.visible=source.visible;source.parent.add(part);
    basePositions.set(part.uuid,part.position.clone());originalMaterials.set(part.uuid,part.material);
    return part;
  };
  const a=make(geometries[0],'selección'),b=make(geometries[1],'resto');
  const index=meshes.indexOf(source);meshes.splice(index,1,a,b);source.removeFromParent();
  for(const bed of beds){
    if(!bed.items.includes(source.uuid))continue;
    bed.items=bed.items.filter(id=>id!==source.uuid);
    delete bed.placements[source.uuid];
    // Dejamos ambas piezas pendientes de ubicación manual para evitar superposición en la cama.
    // No declarar que ambas piezas están colocadas en la misma coordenada:
    // esa superposición impediría exportar la cama con seguridad.
    // Quedan fuera de las camas hasta que el usuario las distribuya.
  }
  selected=a;dirty=true;cutPair=null;syncResultButtons();refreshBeds();updateList();updateStats();fit();
  status(caps?'Separación con costura '+capKind+' y dos sólidos cerrados. Distribuye las nuevas piezas en las camas; revisa sus superficies en el laminador.':'Separadas dos mallas cerradas. Distribuye las nuevas piezas en las camas y comprueba dimensiones.');
}
$('verifySurfaceSeparation').onclick=verifySurfaceSeparation;
$('mobileVerifySurfaceSeparation').onclick=()=>{if(!$('mobileSurfaceSheet').hidden)$('mobileCloseSurface').click();verifySurfaceSeparation()};
$('separateSurfaceSelection').onclick=()=>separateClosedSurface();
(function setupMobileSurface(){const panel=$('mobileSurfaceSheet'),back=$('mobileSurfaceBackdrop');const close=()=>{panel.hidden=true;back.hidden=true;$('mobileSurface').setAttribute('aria-expanded','false');document.body.classList.toggle('mobile-sheet-open',!$('mobileCutSheet').hidden);$('mobileSurface').focus()};$('mobileSurface').setAttribute('aria-expanded','false');$('mobileSurface').onclick=()=>{document.dispatchEvent(new CustomEvent('bisturi:close-mobile-panels',{detail:{except:'surface'}}));panel.hidden=false;back.hidden=false;$('mobileSurface').setAttribute('aria-expanded','true');document.body.classList.add('mobile-sheet-open');$('mobileCloseSurface').focus()};document.addEventListener('bisturi:close-mobile-panels',e=>{if(e.detail?.except!=='surface'&&!panel.hidden)close()});$('mobileCloseSurface').onclick=close;back.onclick=close;$('mobileBrush').onclick=()=>{setSurfaceTool('Pincel');close()};$('mobileWand').onclick=()=>{setSurfaceTool('Varita');close()};$('mobileMagnetic').onclick=()=>{setSurfaceTool('Magnético');close()};$('mobileSurfaceClear').onclick=()=>{$('clearSurfaceSelection').click();close()};$('mobileSeparateSurface').onclick=()=>{close();separateClosedSurface()};for(const [a,b] of [['mobileBrushRadius','brushRadius'],['mobileWandTolerance','wandTolerance'],['mobileMagneticAngle','magneticAngle'],['mobileMagneticColor','magneticColor'],['mobileMagneticReach','magneticReach'],['mobileBrushErase','brushErase']]){$(a).addEventListener('input',()=>{$(b)[$(a).type==='checkbox'?'checked':'value']=$(a)[$(a).type==='checkbox'?'checked':'value']})}})();
// Barrera de seguridad: ninguna operación experimental sustituye una malla
// si la topología de sus resultados es abierta, degenerada o no verificable.
function requireClosedResult(geometry,label){
  const r=analyzeMeshGeometry(geometry,{tolerance:1e-6,maxTriangles:4000000});
  if(!r.ok)throw new Error(`${label}: resultado no seguro (${r.reason||r.level}; bordes ${r.boundary??'?'}, no manifold ${r.nonManifold??'?'}, degenerados ${r.degenerate??'?'}). Se conserva el original.`);
  return r;
}
function status(t){$('status').textContent=t}
function snapshot(){return {items:meshes.map(m=>({m,g:m.geometry,parent:m.parent,p:m.position.toArray(),r:m.rotation.toArray().slice(0,3),s:m.scale.toArray(),visible:m.visible})),beds:beds.map(b=>({...b,items:[...b.items],placements:structuredClone(b.placements)})),nextBedId,activeBed,selected:selected?.uuid||null,surfaces:[...surfaceSelections.entries()].map(([id,set])=>[id,[...set]]),surfaceTouches:[...lastSurfaceTouch.entries()],rootPosition:root.position.toArray(),rootScale:root.scale.toArray(),rootQuaternion:root.quaternion.toArray(),explode,xray,explodeOrigins:[...explodeOrigins.entries()].map(([id,v])=>[id,v.toArray()])}}
function save(){undo.push(snapshot());if(undo.length>50)undo.shift();redo=[];dirty=true}
function applyVisualState(){meshes.forEach(m=>{const mats=Array.isArray(m.material)?m.material:[m.material];mats.forEach(mat=>{if(!mat)return;mat.transparent=xray;mat.opacity=xray?.35:1;mat.depthWrite=!xray;mat.needsUpdate=true})});$('xrayBtn').classList.toggle('active',xray);$('explodeBtn').classList.toggle('active',explode)}
function restore(s){clearSurfaceOverlays();disablePegTouch();pegCustomOffsets=null;pegAutoInfo=null;clearPegMarkers();touchPlaneActive=false;syncPlaneTouchUI();setGuide(false);cutPair=null;syncResultButtons();(transform.detach(),gizmoTarget=null);const desired=new Set(s.items.map(v=>v.m));for(const m of meshes)if(!desired.has(m))m.removeFromParent();meshes=s.items.map(v=>v.m);for(const v of s.items){if(v.m.parent!==v.parent)v.parent.add(v.m);v.m.geometry=v.g;v.m.position.fromArray(v.p);v.m.rotation.set(...v.r);v.m.scale.fromArray(v.s);v.m.visible=v.visible!==false}root.position.fromArray(s.rootPosition||[0,0,0]);root.scale.fromArray(s.rootScale||[1,1,1]);root.quaternion.fromArray(s.rootQuaternion||[0,0,0,1]);explode=!!s.explode;xray=!!s.xray;explodeOrigins=new Map((s.explodeOrigins||[]).map(([id,v])=>[id,new THREE.Vector3().fromArray(v)]));beds=s.beds.map(b=>({...b,items:[...b.items],placements:structuredClone(b.placements)}));nextBedId=s.nextBedId||Math.max(...beds.map(b=>b.id),0)+1;activeBed=beds.some(b=>b.id===s.activeBed)?s.activeBed:beds[0].id;selected=meshes.find(m=>m.uuid===s.selected)||null;modelLoaded=meshes.length>0;for(const [id,faces] of (s.surfaces||[])){const mesh=meshes.find(m=>m.uuid===id);if(mesh){surfaceSelections.set(id,new Set(faces));updateSurfaceOverlay(mesh)}}for(const [id,face] of (s.surfaceTouches||[]))if(surfaceSelections.get(id)?.has(face))lastSurfaceTouch.set(id,face);applyVisualState();refreshBeds();updateList();updateStats();if(bedMode)updateBedStage();if(selected&&tool==='Mover'&&!bedMode&&!explode)attachGizmo(selected);syncResultButtons()}
function undoStep(){if(!undo.length)return;redo.push(snapshot());restore(undo.pop());status('Acción deshecha.')}
function redoStep(){if(!redo.length)return;undo.push(snapshot());restore(redo.pop());status('Acción rehecha.')}
function clear(){if($('importDiagnosis'))$('importDiagnosis').textContent='Carga un modelo para comprobar sus mallas.';clearSurfaceOverlays();disablePegTouch();pegCustomOffsets=null;pegAutoInfo=null;clearPegMarkers();touchPlaneActive=false;syncPlaneTouchUI();setGuide(false);cutPair=null;syncResultButtons();leaveBed();(transform.detach(),gizmoTarget=null);root.clear();root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.set(1,1,1);meshes=[];selected=null;undo=[];redo=[];basePositions.clear();explodeOrigins.clear();originalMaterials.clear();modelLoaded=false;dirty=false;explode=false;xray=false;applyVisualState();updateList();updateStats();resetBeds()}
function prepare(object,name){clear();root.add(object);root.updateMatrixWorld(true);object.traverse(child=>{if(!child.isMesh)return;if(!child.geometry?.attributes?.position)return;const mat=child.material;if(Array.isArray(mat))child.material=mat.map(m=>m.clone());else child.material=mat?.clone()||new THREE.MeshStandardMaterial({color:0x4da7eb});child.name=child.name||`Pieza ${meshes.length+1}`;meshes.push(child);originalMaterials.set(child.uuid,child.material);basePositions.set(child.uuid,child.position.clone());});modelLoaded=meshes.length>0;loadRaycastAcceleration().then(ok=>{if(ok&&modelLoaded)accelerateSurfaceMeshes(meshes)});$('projectName').value=name;fit();updateList();updateStats();refreshBeds();status(`${meshes.length} objeto(s) de malla cargado(s). Se pueden inspeccionar aunque tengan defectos.`);dirty=true;diagnoseAfterImport()}
let bvhTimer=0;function scheduleAcceleration(){clearTimeout(bvhTimer);bvhTimer=setTimeout(()=>loadRaycastAcceleration().then(ok=>{if(ok&&modelLoaded)accelerateSurfaceMeshes(meshes)}),400);}
function updateList(){scheduleAcceleration();const host=$('pieces');host.replaceChildren();if(!meshes.length){host.textContent='Sin piezas cargadas.';return}meshes.forEach((m,i)=>{const row=document.createElement('div');row.className='piece'+(selected===m?' selected':'');const name=document.createElement('span');name.className='piece-name';name.textContent=`${i+1}. ${m.name}`;name.onclick=()=>select(m);const location=document.createElement('small');location.style.color='#a8c9df';location.textContent=' '+(beds.find(b=>b.items.includes(m.uuid))?.name||'Sin cama');const eye=document.createElement('button');eye.className='ojo'+(m.visible?'':' apagado');eye.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';eye.setAttribute('aria-label',m.visible?'Ocultar pieza':'Mostrar pieza');eye.title='Mostrar/ocultar';eye.onclick=()=>{save();m.visible=!m.visible;updateList();if(bedMode)updateBedStage()};const swatch=document.createElement('span');swatch.className='muestra';const mat0=Array.isArray(m.material)?m.material[0]:m.material;swatch.style.background='#'+(mat0?.color?.getHexString?.()||'8aa');const more=document.createElement('button');more.className='mas';more.textContent='⋮';more.setAttribute('aria-label','Opciones de '+m.name);more.onclick=()=>{select(m);window.dispatchEvent(new Event('bisturi-menu-pieza'))};row.append(swatch,name,location,eye,more);host.append(row)})}
// Doble toque con la herramienta Seleccionar: quita la selección de pieza.
{let lastTap=null;let down=null;
renderer.domElement.addEventListener('pointerdown',e=>{down=e.isPrimary?{x:e.clientX,y:e.clientY,t:performance.now()}:null;});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!e.isPrimary||!down||tool!=='Seleccionar'||bedMode)return;
  const now=performance.now(),moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;
  if(moved>12){lastTap=null;return;}
  if(lastTap&&now-lastTap.t<350&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<30){lastTap=null;setTimeout(()=>{if(selected)select(null);},0);return;}
  lastTap={x:e.clientX,y:e.clientY,t:now};
});}
function select(m){if(surfacePreview&&surfacePreview.meshId!==m?.uuid)clearSurfacePreview();selected=m;refreshCutGuide();(transform.detach(),gizmoTarget=null);if(!bedMode&&tool==='Mover'&&m)attachGizmo(m);updateList();refreshBeds();syncPlacementFields();status(m?`Seleccionado: ${m.name}`:'Selección eliminada')}
function updateStats(){meshQualityLast=[];if($('qualityResults'))$('qualityResults').textContent='Modelo modificado. Vuelve a comprobar las piezas.';if(!modelLoaded){$('stats').textContent='Sin modelo';return}root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root),s=b.getSize(new THREE.Vector3());let triangles=0;meshes.forEach(m=>{const g=m.geometry;triangles+=g.index?g.index.count/3:g.attributes.position.count/3});$('stats').textContent=`Objetos de malla: ${meshes.length}\nTriángulos aprox.: ${Math.round(triangles).toLocaleString('es')}\nDimensiones (mm, si el archivo usa mm): ${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)}\nModo: ${mode}\nHerramienta: ${tool}`}
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let start=null;renderer.domElement.addEventListener('pointerdown',e=>{if(!e.isPrimary||surfaceDrag||planeDrag||pegDrag||touchPlaneActive||pegTouchActive||['Pincel','Varita','Magnético'].includes(tool)){start=null;return;}start={x:e.clientX,y:e.clientY,id:e.pointerId};if(bedMode&&e.isPrimary&&!dragBed){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects([...stagePick.keys()],false);if(hits.length){const item=stagePick.get(hits[0].object);if(item){const m=item.mesh;activeBed=item.bed.id;refreshBeds();select(m);const p=bedPointer(e);const place=item.bed.placements[m.uuid];const off=bedOffsets.get(item.bed.id)||{x:0,z:0};if(p&&place){save();dragBed={pointerId:e.pointerId,id:m.uuid,bedId:item.bed.id,initial:{...place},dx:place.x-(p.x-off.x),dy:place.y-(p.y-off.z)};orbit.enabled=false;renderer.domElement.setPointerCapture(e.pointerId)}}}}});renderer.domElement.addEventListener('pointermove',e=>{if(!dragBed||e.pointerId!==dragBed.pointerId)return;const p=bedPointer(e);if(!p)return;const b=beds.find(v=>v.id===dragBed.bedId);if(!b)return;const place=b.placements[dragBed.id];if(!place)return;const off=bedOffsets.get(b.id)||{x:0,z:0};place.x=Math.round((p.x-off.x+dragBed.dx)*10)/10;place.y=Math.round((p.y-off.z+dragBed.dy)*10)/10;updateBedStage();drawBed();syncPlacementFields();dirty=true});renderer.domElement.addEventListener('pointercancel',e=>{if(!dragBed||e.pointerId!==dragBed.pointerId)return;restoreDragPlacement(beds,dragBed);dragBed=null;start=null;orbit.enabled=true;if(bedMode)refreshBeds();status('Movimiento interrumpido; pieza restaurada.');});renderer.domElement.addEventListener('pointerup',e=>{if(surfaceDrag||planeDrag||pegDrag||touchPlaneActive||pegTouchActive||['Pincel','Varita','Magnético'].includes(tool)){start=null;return;}if(dragBed){

  if(e.pointerId!==dragBed.pointerId)return;
  const drag=dragBed;
  if(allBedsView){
    const p=bedPointer(e);
    const target=p&&beds.find(b=>{const o=bedOffsets.get(b.id);return o&&p.x>=o.x&&p.x<=o.x+b.x&&p.y>=o.z&&p.y<=o.z+b.y});
    if(target){
      const off=bedOffsets.get(target.id);
      const position={x:Math.round((p.x-off.x)*10)/10,y:Math.round((p.y-off.z)*10)/10};
      const result=transferBetweenBeds(beds,drag.id,drag.bedId,target.id,position,(dest,candidate)=>placementFitsInBed(dest,meshes.find(m=>m.uuid===drag.id),candidate));
      if(result.ok){activeBed=target.id;if(result.moved)status('Pieza trasladada a '+target.name+'. Comprueba los límites y solapamientos.');}
      else{restoreDragPlacement(beds,drag);status('Traslado cancelado: '+result.reason)}
    }else{restoreDragPlacement(beds,drag);status('La pieza regresó a su posición anterior: suéltala sobre una cama.');}
  }
  else {
    const b=beds.find(v=>v.id===drag.bedId),m=meshes.find(v=>v.uuid===drag.id);
    const result=b&&m?placementFitsInBed(b,m,b.placements[drag.id]):{ok:false,reason:'pieza no encontrada'};
    if(!result.ok){restoreDragPlacement(beds,drag);status('Movimiento cancelado: '+result.reason)}
  }
  dragBed=null;orbit.enabled=true;refreshBeds();updateBedStage();return;
} if(!start||start.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8){start=null;return;}const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(meshes.filter(m=>m.visible),false)[0];if(hit)select(hit.object);start=null});
function download(data,name,mime){
  // Safari/iOS: activar la descarga con un enlace conectado al documento y
  // mantener el Blob URL un tiempo suficiente para que el navegador lo consuma.
  const blob=data instanceof Blob?data:new Blob([data],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=name;
  a.style.display='none';
  document.body.appendChild(a);
  try{a.click()}finally{
    setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},30000);
  }
}
async function loadFile(files){if(!files?.length)return;let cleanup=()=>{},missingTextures=null;status('Leyendo archivos locales…');try{
  const bundle=chooseModelBundle(files),file=bundle.main,ext=file.name.split('.').pop().toLowerCase();
  const buf=await file.arrayBuffer();let object;
  if(ext==='stl'){const geo=new STLLoader().parse(buf);geo.computeVertexNormals();object=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x58b7f6,roughness:.6,side:THREE.DoubleSide}));object.name=file.name.replace(/\.stl$/i,'')}
  else if(ext==='obj'){
    const source=new TextDecoder().decode(buf),loader=new OBJLoader();
    if(bundle.mtl){
      const missing=new Set(),urls=[];
      const manager=new THREE.LoadingManager();
      manager.setURLModifier(url=>{
        const key=resourceName(url),asset=bundle.assets.get(key);
        if(!asset||asset===bundle.mtl){missing.add(key);return 'data:,'}
        const objectURL=URL.createObjectURL(asset);urls.push(objectURL);return objectURL;
      });
      let released=false;
      const release=()=>{if(released)return;released=true;urls.forEach(url=>URL.revokeObjectURL(url))};
      const timer=setTimeout(release,120000);
      cleanup=()=>{clearTimeout(timer);release()};
      manager.onLoad=()=>{clearTimeout(timer);release()};
      const materials=new MTLLoader(manager).parse(await bundle.mtl.text(),'');
      materials.preload();loader.setMaterials(materials);
      missingTextures=missing;
    }
    object=loader.parse(source);
  }
  else if(ext==='glb'){const gltf=await new GLTFLoader().parseAsync(buf,'');object=gltf.scene}
  else if(ext==='fbx'){object=new FBXLoader().parse(buf,'')}
  else if(ext==='3mf'){object=new ThreeMFLoader().parse(buf)}
  else throw Error('Formato no admitido');
  prepare(object,file.name.replace(/\.[^.]+$/,''));
  if(ext==='obj'&&bundle.mtl)status(`${meshes.length} malla(s) cargadas con materiales OBJ locales.${missingTextures?.size?' Faltan texturas: '+[...missingTextures].join(', ')+'.':''} Revisa el diagnóstico antes de cortar.`);
}catch(e){cleanup();console.error(e);status('No se pudo abrir el modelo: '+e.message)}}
$('openBtn').onclick=()=>$('file').click();$('file').onchange=e=>{loadFile(e.target.files);e.target.value=''};
$('demoBtn').onclick=()=>{const g=new THREE.Group();[['Cabeza',new THREE.SphereGeometry(22,24,16),0xf2b58c,[0,65,0]],['Torso',new THREE.BoxGeometry(40,55,24),0x348ae3,[0,15,0]],['Piernas',new THREE.BoxGeometry(35,44,22),0x525188,[0,-35,0]]].forEach(([name,geo,color,p])=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color}));m.name=name;m.position.set(...p);g.add(m)});prepare(g,'Figura de demostración');status('Modelo de ejemplo cargado: tres objetos geométricos independientes.')};

// Ejemplos de la v2f. Sus sopas usan Z hacia arriba; aquí se giran a Y hacia arriba.
function meshFromSoup(soup,colors,palette,name){
 const n=soup.length/9,order=Array.from({length:n},(_,i)=>i);if(colors)order.sort((a,b)=>colors[a]-colors[b]);
 const pos=new Float32Array(soup.length);
 order.forEach((f,i)=>{for(let k=0;k<3;k++){const o=9*f+3*k,d=9*i+3*k;pos[d]=soup[o];pos[d+1]=soup[o+2];pos[d+2]=-soup[o+1];}});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
 let material;
 if(colors&&palette){
  material=palette.map(p=>new THREE.MeshStandardMaterial({color:new THREE.Color(p.hex),roughness:.6}));
  let start=0;for(let i=1;i<=n;i++)if(i===n||colors[order[i]]!==colors[order[start]]){g.addGroup(3*start,3*(i-start),colors[order[start]]);start=i;}
 }else material=new THREE.MeshStandardMaterial({color:0x9fb3c4,roughness:.6});
 g.computeVertexNormals();g.computeBoundingBox();
 const m=new THREE.Mesh(g,material);m.name=name;return {mesh:m,order};
}
function loadMushroomExample(){
 const h=sampleMushroom(),{mesh}=meshFromSoup(h.pos,h.col,h.palette,'Hongo');
 const grp=new THREE.Group();grp.add(mesh);prepare(grp,'Ejemplo: hongo de 3 colores');selected=mesh;updateList();
 status('Hongo con 3 colores (sombrero, tallo y manchas). Prueba «Separar por color en piezas macizas», un corte por plano o marcar una mancha con la Varita y cortarla.');
}
function loadPebbleExample(){
 const soup=apoyarSopa(guijarro(5)),{mesh,order}=meshFromSoup(soup,null,null,'Guijarro');
 const grp=new THREE.Group();grp.add(mesh);prepare(grp,'Ejemplo: guijarro');selected=mesh;
 const faces=new Set();
 order.forEach((f,i)=>{const o=9*f;const cx=(soup[o]+soup[o+3]+soup[o+6])/3,cy=(soup[o+1]+soup[o+4]+soup[o+7])/3,cz=(soup[o+2]+soup[o+5]+soup[o+8])/3;if(Math.hypot(cx-4,cy-2,cz-47)<14)faces.add(i);});
 surfaceSelections.set(mesh.uuid,faces);updateSurfaceOverlay(mesh);updateSurfaceInfo();updateList();
 status('Guijarro orgánico con una selección de ejemplo (la «cabeza»). Pulsa «Cortar región marcada» y luego «Calcular y previsualizar».');
}
$('demoMushroomBtn').onclick=loadMushroomExample;$('demoPebbleBtn').onclick=loadPebbleExample;
$('scaleBtn').onclick=()=>{if(!modelLoaded)return status('Primero carga un modelo.');const h=Number($('height').value);if(!Number.isFinite(h)||h<=0)return status('Introduce una altura válida en centímetros.');const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());if(size.y<=0)return status('El modelo no tiene altura válida.');save();root.scale.multiplyScalar(h*10/size.y);fit();updateStats();status(`Altura ajustada proporcionalmente a ${h} cm (asumiendo unidades del modelo en mm).`)};
document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('active',x===b));updateStats();status('Modo '+mode+': las operaciones de segmentación se añadirán en próximas versiones.')});
function setTool(t){if(surfaceSelector.busy())cancelSurfaceWork();if(bedMode){leaveBed();}tool=t;(transform.detach(),gizmoTarget=null);if(t==='Mover'&&selected&&!explode)attachGizmo(selected);if(t==='Mover'&&explode)status('Reúne las piezas antes de moverlas para conservar su posición real.');$('selectTool').classList.toggle('active',t==='Seleccionar');$('moveTool').classList.toggle('active',t==='Mover');$('brushTool').classList.toggle('active',t==='Pincel');$('wandTool').classList.toggle('active',t==='Varita');updateStats()}
$('selectTool').onclick=()=>setTool('Seleccionar');$('moveTool').onclick=()=>setTool('Mover');transform.addEventListener('mouseDown',()=>save());let statsQueued=false;
transform.addEventListener('objectChange',()=>{dirty=true;if(!statsQueued){statsQueued=true;requestAnimationFrame(()=>{statsQueued=false;updateStats();});}});
// Resolución adaptable: mientras se gira la vista o se mueve una pieza se dibuja con menos píxeles.
const fullPixelRatio=Math.min(devicePixelRatio,2);let lowResTimer=0;
function sceneTriangles(){let n=0;for(const m of meshes){const g=m.geometry;n+=(g.index?g.index.count:g.attributes.position.count)/3;}return n;}
function interactionStart(){clearTimeout(lowResTimer);const n=sceneTriangles();if(n<150000)return;const low=n>1500000?.6:n>600000?.8:1;if(renderer.getPixelRatio()!==low){renderer.setPixelRatio(low);resize();}}
function interactionEnd(){clearTimeout(lowResTimer);lowResTimer=setTimeout(()=>{if(renderer.getPixelRatio()!==fullPixelRatio){renderer.setPixelRatio(fullPixelRatio);resize();}},250);}
orbit.addEventListener('start',interactionStart);orbit.addEventListener('end',interactionEnd);
transform.addEventListener('dragging-changed',e=>e.value?interactionStart():interactionEnd());
$('xrayBtn').onclick=()=>{if(!modelLoaded)return;save();xray=!xray;applyVisualState();dirty=true};
$('explodeBtn').onclick=()=>{if(!modelLoaded)return;save();if(!explode){explodeOrigins=new Map(meshes.map(m=>[m.uuid,m.position.clone()]));explode=true;(transform.detach(),gizmoTarget=null);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),dist=box.getSize(new THREE.Vector3()).length()*.22;meshes.forEach((m,i)=>{const world=new THREE.Vector3();m.getWorldPosition(world);const v=world.sub(center);if(v.length()<.01)v.set(Math.cos(i*2.4),.4,Math.sin(i*2.4));const localDelta=v.normalize().multiplyScalar(dist);if(m.parent){const parentScale=new THREE.Vector3();m.parent.getWorldScale(parentScale);localDelta.applyQuaternion(m.parent.getWorldQuaternion(new THREE.Quaternion()).invert());localDelta.set(localDelta.x/Math.max(1e-6,parentScale.x),localDelta.y/Math.max(1e-6,parentScale.y),localDelta.z/Math.max(1e-6,parentScale.z))}m.position.add(localDelta)})}else{meshes.forEach(m=>{const pos=explodeOrigins.get(m.uuid);if(pos)m.position.copy(pos)});explodeOrigins.clear();explode=false;if(tool==='Mover'&&selected&&!bedMode)attachGizmo(selected)}applyVisualState();refreshCutGuide();syncResultButtons();updateStats();dirty=true};
// Cortes por plano en ejes mundiales o normal inclinada (experimental).
$('previewCutBtn').onclick=()=>setGuide(!showCutGuide);
$('touchPlaneBtn').onclick=togglePlaneTouch;
$('mobileTouchPlane').onclick=()=>{if($('cutOrientation').value!==$('mobileCutOrientation').value){$('cutOrientation').value=$('mobileCutOrientation').value;$('cutAngles').hidden=$('cutOrientation').value!=='inclinado'}$('cutPercent').value=$('mobileCutPercent').value;$('cutAngleX').value=$('mobileCutAngleX').value;$('cutAngleZ').value=$('mobileCutAngleZ').value;togglePlaneTouch();};
$('showCutResult').onclick=()=>$('explodeBtn').click();
// Núcleo del corte por plano: corta «m» por el plano de normal mundial «normal» a la fracción
// indicada, comprueba el resultado y sustituye la pieza por sus dos mitades. Lanza un error
// (sin tocar nada) si no se puede. Lo usan «Aplicar corte por plano» y la herramienta Bisturí.
function cutMeshWithPlane(m,normal,fraction,{beforeChange=()=>{},strict=true}={}){
  let result;
  try{result=sliceMeshByWorldPlane(m,normal,fraction)}catch(e){throw Error('No se aplicó el corte: '+e.message)}
  try{
    if(strict&&!result.largeMesh){requireClosedResult(result.upper,'Mitad superior');requireClosedResult(result.lower,'Mitad inferior');}
    assertCutVolumeConservation(m.geometry,result.upper,result.lower);
    m.updateWorldMatrix(true,false);
    const worldPoint=new THREE.Vector3();
    assertCutHalfspaces(m.geometry,result.upper,result.lower,{
      offset:result.planeOffset,
      project:(x,y,z)=>normal.dot(worldPoint.set(x,y,z).applyMatrix4(m.matrixWorld))
    });
    if(strict&&!result.largeMesh)assertMatchingCutSeams(result.upper,result.lower,{
      offset:result.planeOffset,
      project:(x,y,z)=>normal.dot(worldPoint.set(x,y,z).applyMatrix4(m.matrixWorld))
    });
  }
  catch(e){result.upper.dispose();result.lower.dispose();throw Error('Corte cancelado: '+e.message)}
  beforeChange();(transform.detach(),gizmoTarget=null);
  const sourceBed=beds.find(b=>b.items.includes(m.uuid));
  const sourceMaterials=Array.isArray(m.material)?m.material:[m.material];
  const make=(geo,which)=>{
    const mat=sourceMaterials.map(material=>material?.clone?.()||new THREE.MeshStandardMaterial({color:0xffffff}));
    mat.push(new THREE.MeshStandardMaterial({color:0xd5c2a5,roughness:.8,side:THREE.DoubleSide}));
    const obj=new THREE.Mesh(geo,mat);obj.name=m.name+' '+which;
    obj.position.copy(m.position);obj.quaternion.copy(m.quaternion);obj.scale.copy(m.scale);
    m.parent.add(obj);basePositions.set(obj.uuid,obj.position.clone());originalMaterials.set(obj.uuid,obj.material);
    return obj;
  };
  const positive=make(result.upper,'lado positivo');
  const negative=make(result.lower,'lado negativo');
  if(result.connectorPoint){
    positive.updateWorldMatrix(true,false);const invCut=positive.matrixWorld.clone().invert();
    const info={point:result.connectorPoint.toArray(),normal:result.connectorNormal.toArray(),maxRadius:result.connectorRadius,
      localPoint:result.connectorPoint.clone().applyMatrix4(invCut).toArray(),localNormal:result.connectorNormal.clone().transformDirection(invCut).toArray()};
    positive.userData.bisturiCut={...info,mate:negative.uuid,side:'positive'};
    negative.userData.bisturiCut={...info,mate:positive.uuid,side:'negative'};
  }
  m.removeFromParent();meshes.splice(meshes.indexOf(m),1,positive,negative);
  if(sourceBed){sourceBed.items=sourceBed.items.filter(id=>id!==m.uuid);delete sourceBed.placements[m.uuid]}
  disablePegTouch();pegCustomOffsets=null;pegAutoInfo=null;clearPegMarkers();
  return {positive,negative,result};
}
$('cutPlaneBtn').onclick=async()=>{
  if(bedMode)return status('Vuelve a la vista de modelo antes de cortar.');
  if(!selected)return status('Selecciona una malla para cortarla.');
  if(explode)return status('Desactiva la vista explotada antes de cortar.');
  if(xray)return status('Desactiva Rayos X antes de cortar.');
  const m=selected;
  if(!m.geometry?.attributes?.position)return status('No hay geometría editable.');
  try{verifyOperationInput(m.geometry,'Corte por plano')}catch(e){return status(e.message)}
  const fraction=Number($('cutPercent').value)/100;
  const axis=$('cutOrientation').value;
  let normal;
  if(axis==='X')normal=new THREE.Vector3(1,0,0);
  else if(axis==='Z')normal=new THREE.Vector3(0,0,1);
  else if(axis==='inclinado'){
    const angleX=Number($('cutAngleX').value),angleZ=Number($('cutAngleZ').value);
    if(!Number.isFinite(angleX)||!Number.isFinite(angleZ))return status('Indica ángulos válidos.');
    normal=new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(THREE.MathUtils.degToRad(angleX),0,THREE.MathUtils.degToRad(angleZ),'XYZ'));
  }else normal=new THREE.Vector3(0,1,0);
  const triCount=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3;
  if(triCount>150000){status(`Cortando ${Math.round(triCount).toLocaleString('es')} triángulos… puede tardar unos segundos.`);$('cutPlaneBtn').disabled=true;await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,30)));$('cutPlaneBtn').disabled=false;if(selected!==m||!meshes.includes(m))return status('La selección cambió; vuelve a pulsar «Aplicar corte por plano».');}
  let out;
  try{out=cutMeshWithPlane(m,normal,fraction,{beforeChange:()=>{setGuide(false);save();}})}catch(e){return status(e.message)}
  const result=out.result;
  selected=out.positive;cutPair=[out.positive,out.negative];syncResultButtons();dirty=true;refreshBeds();updateList();updateStats();fit();
  status(`Corte ${axis} efectuado: dos mallas separadas. `+(result.warning||`Revisa que sus superficies sean válidas en el laminador.`));
};

// Encastres experimentales: distribución lineal en plano y operaciones CSG reales.
// La zona segura es una estimación conservadora del algoritmo de corte, no una prueba manifold.
const pegMarkers=new THREE.Group();scene.add(pegMarkers);
let pegTouchActive=false, pegDrag=null, pegCustomOffsets=null, pegAutoInfo=null, pegFastPreview=false;
const pegPointerRay=new THREE.Raycaster(),pegPointerNdc=new THREE.Vector2();
function pegPointFromPointer(event){
  const rect=renderer.domElement.getBoundingClientRect();
  pegPointerNdc.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  pegPointerRay.setFromCamera(pegPointerNdc,camera);
}
// Plano del corte en el mundo según la posición actual de una mitad (si se movió, el plano la acompaña).
function cutFrame(info,mesh){
  mesh=mesh||meshes.find(x=>x.userData?.bisturiCut===info);
  if(mesh&&info.localPoint){mesh.updateWorldMatrix(true,false);return {point:new THREE.Vector3().fromArray(info.localPoint).applyMatrix4(mesh.matrixWorld),normal:new THREE.Vector3().fromArray(info.localNormal).transformDirection(mesh.matrixWorld).normalize()};}
  return {point:new THREE.Vector3().fromArray(info.point),normal:new THREE.Vector3().fromArray(info.normal).normalize()};
}
function pegAxes(info,mesh){
  const frame=cutFrame(info,mesh),normal=frame.normal;
  const guide=Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
  const tangent=new THREE.Vector3().crossVectors(normal,guide).normalize();
  const bitangent=new THREE.Vector3().crossVectors(normal,tangent).normalize();
  return {normal,tangent,bitangent,point:frame.point};
}
function disablePegTouch(){
  pegTouchActive=false;pegDrag=null;orbit.enabled=true;
  const b=$('pegTouchBtn');if(b){b.classList.remove('active');b.textContent='Mover pasadores con el dedo';}
}
function syncPegTouchButton(){
  const b=$('pegTouchBtn');if(!b)return;
  b.classList.toggle('active',pegTouchActive);b.textContent=pegTouchActive?'Finalizar movimiento táctil':'Mover pasadores con el dedo';
}

function clearPegMarkers(){while(pegMarkers.children.length){const o=pegMarkers.children[0];o.removeFromParent();o.geometry?.dispose();o.material?.dispose()}}
function syncConnectorShape(){
  const isProfile=['rectangular','dovetail'].includes($('pegShape').value);
  $('rectFields').hidden=!isProfile;
  $('dovetailFields').hidden=$('pegShape').value!=='dovetail';
  $('pegDiameterLabel').hidden=isProfile;
  const dv=$('pegShape').value==='dovetail',lw=$('rectWidth').closest('label'),lh=$('rectHeight').closest('label');
  if(dv&&$('rectWidth').value==='5'&&$('rectHeight').value==='4'){$('rectWidth').value='8';$('rectHeight').value='10';$('dovetailTaper').value='1.5';}
  lw.firstChild.textContent=dv?'Ancho máximo del riel (mm)':'Ancho rectangular (mm)';lh.firstChild.textContent=dv?'Largo del riel (mm)':'Alto rectangular (mm)';
  $('pegCount').closest('label').firstChild.textContent=dv?'Cantidad de rieles':'Cantidad de pasadores';
  pegCustomOffsets=null;pegAutoInfo=null;disablePegTouch();clearPegMarkers();
  $('pegPreviewInfo').textContent='Elige Ver ubicación de pasadores para revisar la geometría.';
}
$('pegShape').addEventListener('change',syncConnectorShape);
['rectWidth','rectHeight','dovetailTaper'].forEach(id=>$(id).addEventListener('input',()=>{pegCustomOffsets=null;pegAutoInfo=null;disablePegTouch();clearPegMarkers();}));
function pegConfig(){
  const shape=$('pegShape').value;
  if(!['circular','rectangular','dovetail','alignment'].includes(shape))throw Error('Tipo de encastre no válido.');
  const width=Number($('rectWidth').value),height=Number($('rectHeight').value);
  if(['rectangular','dovetail'].includes(shape)&&(!Number.isFinite(width)||!Number.isFinite(height)||width<.5||height<.5||width>40||height>40))throw Error('Ancho y alto rectangulares deben estar entre 0.5 y 40 mm.');
  const diameter=shape==='dovetail'?Math.hypot(width+0.5,2*height+0.5):shape==='rectangular'?Math.hypot(width,height):Number($('pegDiameter').value),depth=Number($('pegDepth').value),clearance=Number($('pegClearance').value);
  const count=Number($('pegCount').value),spacing=Number($('pegSpacing').value),u=Number($('pegOffsetU').value),v=Number($('pegOffsetV').value);
  if(![diameter,depth,clearance,count,spacing,u,v].every(Number.isFinite)||diameter<.5||diameter>40||depth<1||depth>40||clearance<.05||clearance>1||diameter/2<=clearance||!Number.isInteger(count)||count<1||count>4||Math.abs(u)>100||Math.abs(v)>100||spacing<1||spacing>100)throw Error('Revisa cantidad, diámetro, profundidad, holgura, separación y desplazamientos.');
  if(count>1&&spacing<diameter+2*clearance+1)throw Error('Los pasadores se solapan o están demasiado próximos. Aumenta la separación.');
  // Comprueba la intención dimensional del pasador y su alojamiento (holgura radial).
  if(shape==='circular')inspectConnectorSpec({diameter,depth,clearance});
  if(shape==='alignment')validateAlignmentPinSpec({diameter,depth,clearance,count});
  else if(['rectangular','dovetail'].includes(shape)&&(width<=2*clearance||height<=2*clearance))throw Error('La holgura es demasiado grande respecto al conector.');
  const taper=shape==='dovetail'?Number($('dovetailTaper').value):0;
  if(shape==='dovetail')validateDovetailSpec({width,height,depth,clearance,taper});
  return {shape,width,height,diameter,depth,clearance,taper,count,spacing,u,v};
}
function pegPositions(info,c){
  const {normal,point,tangent,bitangent}=pegAxes(info);
  const centers=[],offsets=[],v2f=usesV2f(c);
  // Con pasadores redondos, la ubicación automática la decide el motor de la primera versión.
  const list=(pegCustomOffsets?.length&&(v2f||pegCustomOffsets.length===c.count))?pegCustomOffsets:(v2f&&pegAutoInfo?.offsets?.length)?pegAutoInfo.offsets:null;
  const count=list?list.length:c.count;
  for(let i=0;i<count;i++){
    // Reparto por defecto: en fila (2), triángulo (3) o cuadrado (4), centrado en el punto elegido.
    const auto=c.count===3?(()=>{const r=c.spacing/Math.sqrt(3),a=Math.PI/2+i*2*Math.PI/3;return [c.u+r*Math.cos(a),c.v+r*Math.sin(a)]})():c.count===4?[c.u+(i%2?.5:-.5)*c.spacing,c.v+(i<2?-.5:.5)*c.spacing]:[c.u+(i-(c.count-1)/2)*c.spacing,c.v];
    const [du,dv]=list?list[i]:auto;
    if(!v2f&&Math.hypot(du,dv)+c.diameter/2+c.clearance>info.maxRadius*.8)throw Error(c.shape==='dovetail'?'La cola de milano no cabe en la cara del corte: necesita el doble del largo del riel (canal y entrada). Acorta el riel o corta por una zona más ancha.':'Algún encastre queda fuera de la cara del corte. Reduce separación, tamaño o desplazamiento.');
    offsets.push([du,dv]);
    centers.push(point.clone().addScaledVector(tangent,du).addScaledVector(bitangent,dv));
  }
  if(!v2f)for(let i=0;i<centers.length;i++)for(let j=i+1;j<centers.length;j++){
    if(centers[i].distanceTo(centers[j])<c.diameter+2*c.clearance+1)throw Error('Dos pasadores están demasiado próximos. Sepáralos antes de aplicar.');
  }
  return {normal,centers,offsets};
}
// ---- Pasadores redondos con el motor de la primera versión (v2f) ----
// Busca la tapa común de las dos mitades, pone el encastre en el punto con más material
// alrededor, el agujero en la mitad más gruesa y ajusta la profundidad al grosor real.
// Solo rehace la tapa del corte: no exige que el resto de la malla esté perfecta.
function usesV2f(c){return c.shape==='circular'||c.shape==='alignment'}
function soupInFrame(mesh,M){
  const g=mesh.geometry,p=g.getAttribute('position'),idx=g.getIndex(),n=idx?idx.count:p.count,out=new Float32Array(n*3),e=M.elements;
  for(let i=0;i<n;i++){const k=idx?idx.getX(i):i,x=p.getX(k),y=p.getY(k),z=p.getZ(k);out[3*i]=e[0]*x+e[4]*y+e[8]*z+e[12];out[3*i+1]=e[1]*x+e[5]*y+e[9]*z+e[13];out[3*i+2]=e[2]*x+e[6]*y+e[10]*z+e[14];}
  return out;
}
function geometryFromSoup(sopa,col,inv){
  const nf=sopa.length/9,order=Array.from({length:nf},(_,i)=>i);order.sort((a,b)=>col[a]-col[b]);
  const out=new Float32Array(nf*9),e=inv.elements,g=new THREE.BufferGeometry();
  order.forEach((f,i)=>{for(let k=0;k<3;k++){const o=9*f+3*k,x=sopa[o],y=sopa[o+1],z=sopa[o+2],d=9*i+3*k;out[d]=e[0]*x+e[4]*y+e[8]*z+e[12];out[d+1]=e[1]*x+e[5]*y+e[9]*z+e[13];out[d+2]=e[2]*x+e[6]*y+e[10]*z+e[14];}});
  let start=0;for(let i=1;i<=nf;i++)if(i===nf||col[order[i]]!==col[order[start]]){g.addGroup(3*start,3*(i-start),Math.max(0,col[order[start]]));start=i;}
  g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));g.computeVertexNormals();g.computeBoundingBox();return g;
}
function v2fManual(c){return !!(pegCustomOffsets?.length)||c.u!==0||c.v!==0}
function runV2f(pair,c,{soloUbicar=false,evitar=null}={}){
  const {m,mate,info}=pair;
  m.updateWorldMatrix(true,false);mate.updateWorldMatrix(true,false);
  // Las dos mitades comparten el marco local del modelo original: se usan juntas aunque se hayan movido.
  const M=m.matrixWorld.clone();
  const pieces=[m,mate].map(mesh=>{const col=faceMaterials(mesh.geometry);return {sopa:soupInFrame(mesh,M),col,colNuevo:col[mainFaceIndex(mesh.geometry)]??0}});
  const frame=cutFrame(info,m),minWall=Number($('pegMinWall').value);
  if(!Number.isFinite(minWall)||minWall<0.6||minWall>10)throw Error('El espesor mínimo debe estar entre 0.6 y 10 mm.');
  const J={tipo:c.shape==='alignment'?'pasadores':'macho',d:c.diameter,profundidad:c.shape==='alignment'?c.depth/2:c.depth+0.5,holgura:2*c.clearance,pared:minWall,cantidad:c.count};
  let centros=null;
  if(v2fManual(c)){const saved=pegAutoInfo;pegAutoInfo=null;centros=pegPositions(info,c).centers.map(v=>v.toArray());pegAutoInfo=saved;}
  const r=encastresEnCorte(pieces,J,{plano:{punto:frame.point.toArray(),normal:frame.normal.toArray()},centros,soloUbicar,separacion:0,evitar});
  if(!r.ubicaciones.length){
    if(evitar&&(evitar[0].length||evitar[1].length))r.motivo='tapa-defectuosa';
    const why=r.motivo==='sin-tapa'?'No encuentro la tapa plana común de las dos mitades. Junta las mitades (Atrás) o vuelve a cortar.':r.motivo==='tapa-defectuosa'?'La cara del corte tiene defectos (grietas o cáscaras superpuestas) justo donde cabría el encastre. Mueve el plano de corte unos milímetros y vuelve a intentarlo.':r.motivo==='poco-grosor'?`La pieza es demasiado delgada en la zona del corte para un encastre de ${J.profundidad.toFixed(1)} mm con pared de ${minWall} mm: baja la profundidad o la pared.`:`No cabe un encastre de Ø${c.diameter} mm con pared de ${minWall} mm en la cara del corte: baja el diámetro o la pared.`;
    const z=diagEncastre.zonas;throw Error(why+(z?` [zonas sanas: ${z[0]}/${z[1]} y ${z[2]}/${z[3]}]`:''));
  }
  return {r,M,pieces,J,m,mate};
}
function selectedCutPair(){
  const m=selected,info=m?.userData?.bisturiCut;
  if(!info)throw Error('Selecciona una mitad resultante de un corte.');
  const mate=meshes.find(p=>p.uuid===info.mate);
  if(!mate||mate.userData?.bisturiCut?.mate!==m.uuid)throw Error('No se encuentra la otra mitad del corte.');
  if(info.connectorMade||mate.userData.bisturiCut.connectorMade)throw Error('Esta unión ya contiene encastres. Usa Atrás para modificarla.');
  return {m,mate,info};
}
$('pegPreviewBtn').onclick=()=>{
  clearPegMarkers();
  if(bedMode||explode||xray)return status('Regresa a la vista ensamblada sin Rayos X para previsualizar pasadores.');
  try{
    const pair=selectedCutPair(),{m,info}=pair,c=pegConfig();
    let note='';
    if(usesV2f(c)&&!pegFastPreview){
      // Ubicación automática (o ajuste de la pedida) con el motor de la primera versión.
      const {r}=runV2f(pair,c,{soloUbicar:true}),ax=pegAxes(info);
      const offs=r.ubicaciones.map(u=>{const d=new THREE.Vector3(...u.centro).sub(ax.point);return [Math.round(d.dot(ax.tangent)*100)/100,Math.round(d.dot(ax.bitangent)*100)/100]});
      pegAutoInfo={offsets:offs,ubic:r.ubicaciones,normal:new THREE.Vector3(...r.normal)};
      if(pegCustomOffsets?.length)pegCustomOffsets=offs.map(x=>[...x]);
      const moved=r.ubicaciones.filter(u=>u.movido>0.05).length;
      if(moved)note+=` ${moved} se movió al punto válido más cercano (no cabía donde estaba).`;
      if(r.ubicaciones.length<c.count)note+=` Solo caben ${r.ubicaciones.length} de ${c.count} con esta medida y pared.`;
    }
    const {normal,centers}=pegPositions(info,c);
    // Vista previa: en ámbar el pasador/riel que se añade; en celeste el contorno del alojamiento.
    const male=connectorShapesFor(info,m,m,centers,c.shape==='alignment'?{...c,shape:'circular'}:c,'male');
    const female=connectorShapesFor(info,m,m,centers,c.shape==='alignment'?{...c,shape:'circular'}:c,'female');
    const prismMesh=(shape,depthDir,depth)=>{
      const base=Array.isArray(shape)?shape:shape.base,top=Array.isArray(shape)?shape.map(p=>p.map((v,k)=>v+depthDir[k]*depth)):shape.tope,L=base.length,pos=[];
      const tri=(a,b,c)=>pos.push(...a,...b,...c);
      for(let i=0;i<L;i++){const j=(i+1)%L;tri(base[i],base[j],top[j]);tri(base[i],top[j],top[i]);}
      for(let i=1;i<L-1;i++){tri(base[0],base[i],base[i+1]);tri(top[0],top[i+1],top[i]);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
    };
    const down=normal.clone().negate().toArray();
    centers.forEach((center,index)=>{
      const U=usesV2f(c)?pegAutoInfo?.ubic?.[index]:null,nOut=pegAutoInfo?.normal;
      if(U&&nOut){
        // Ámbar: el pin (macho) o el pasador suelto; entra en la mitad del agujero.
        const mk=(dir,depth)=>{const solid=new THREE.Mesh(prismMesh(male.shapes[index],dir,depth),new THREE.MeshBasicMaterial({color:0xffb020,transparent:true,opacity:.55,depthTest:false,side:THREE.DoubleSide}));solid.renderOrder=30;solid.userData.pegIndex=index;pegMarkers.add(solid)};
        if(U.hembra==='ambas'){mk(nOut.clone().negate().toArray(),U.profundidad[0]);mk(nOut.toArray(),U.profundidad[1]);}
        else mk((U.hembra===0?nOut.clone().negate():nOut).toArray(),U.profundidad[1]);
      }else if(c.shape!=='alignment'){
        const solid=new THREE.Mesh(prismMesh(male.shapes[index],down,c.depth),new THREE.MeshBasicMaterial({color:0xffb020,transparent:true,opacity:.55,depthTest:false,side:THREE.DoubleSide}));
        solid.renderOrder=30;solid.userData.pegIndex=index;pegMarkers.add(solid);
      }
      const ring=Array.isArray(female.shapes[index])?female.shapes[index]:female.shapes[index].base;
      const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0x41d2ff,depthTest:false}));
      outline.renderOrder=31;pegMarkers.add(outline);
      const handle=new THREE.Mesh(new THREE.SphereGeometry(Math.max(Math.min(c.diameter*.18,2),.8),16,12),new THREE.MeshBasicMaterial({color:0xffcb37,depthTest:false,transparent:true,opacity:.95}));
      handle.position.copy(center).addScaledVector(normal,.1);handle.userData.pegIndex=index;handle.userData.pegHandle=true;handle.renderOrder=32;pegMarkers.add(handle);
    });
    $('pegPreviewInfo').textContent=(usesV2f(c)?`${centers.length} encastre(s) en el punto con más material alrededor (como en la primera versión). Ámbar: ${c.shape==='alignment'?'el pasador suelto, entra en las dos mitades':'el pin, entra en la mitad más gruesa'}; celeste: borde del agujero.${note} Puedes moverlos con «Mover pasadores con el dedo».`:'')||(c.shape==='dovetail'?`Vista previa: en ámbar el riel, en celeste el canal con su entrada. Para mover, activa «Mover pasadores con el dedo» y arrastra el punto amarillo.`:`Vista previa de ${centers.length} encastre(s): en ámbar lo que sobresale, en celeste el borde del alojamiento. Para moverlos, activa «Mover pasadores con el dedo» y arrastra los puntos amarillos.`);
    status('Ubicación de pasadores visible. Confirma con Agregar pasador y alojamiento.');
  }catch(e){$('pegPreviewInfo').textContent=e.message;status(e.message)}
};
$('pegTouchBtn').onclick=()=>{
  if(pegTouchActive){disablePegTouch();status('Ubicación táctil finalizada. Puedes aplicar los encastres.');return;}
  if(touchPlaneActive){status('Desactiva primero el ajuste táctil del plano de corte.');return;}
  if(['Pincel','Varita','Magnético'].includes(tool)){setTool('Seleccionar');}
  if(bedMode||explode||xray){status('Regresa a la vista ensamblada sin Rayos X para mover pasadores.');return;}
  try{selectedCutPair();pegConfig();if(!pegMarkers.children.length)$('pegPreviewBtn').click();if(!pegMarkers.children.length)return;pegTouchActive=true;syncPegTouchButton();status('Arrastra un punto amarillo para colocarlo en el plano de corte.');}
  catch(e){status(e.message)}
};
$('pegResetBtn').onclick=()=>{
  pegCustomOffsets=null;pegAutoInfo=null;disablePegTouch();clearPegMarkers();
  $('pegPreviewInfo').textContent='Se recuperó la distribución numérica. Pulsa Ver ubicación para actualizar la vista.';
  status('Distribución de pasadores restablecida.');
};
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!pegTouchActive||pegDrag||!e.isPrimary||bedMode)return;
  pegPointFromPointer(e);
  const handles=pegMarkers.children.filter(o=>o.userData.pegHandle);
  const hit=pegPointerRay.intersectObjects(handles,false)[0];
  if(!hit)return;
  try{
    const {info}=selectedCutPair(),c=pegConfig(),position=pegPositions(info,c);
    pegCustomOffsets=position.offsets.map(pair=>[...pair]);
    pegDrag={id:e.pointerId,index:hit.object.userData.pegIndex,info,config:c,previous:pegCustomOffsets.map(pair=>[...pair])};
    renderer.domElement.setPointerCapture(e.pointerId);orbit.enabled=false;
    e.stopImmediatePropagation();e.preventDefault();
  }catch(err){status(err.message)}
},true);
renderer.domElement.addEventListener('pointermove',e=>{
  if(!pegDrag||pegDrag.id!==e.pointerId)return;
  pegPointFromPointer(e);
  const {info,config,index}=pegDrag,{normal,tangent,bitangent,point}=pegAxes(info);
  const hit=new THREE.Vector3();
  if(pegPointerRay.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,point),hit)){
    const displacement=hit.sub(point);
    const next=pegCustomOffsets.map(pair=>[...pair]);
    next[index]=[Math.round(displacement.dot(tangent)*10)/10,Math.round(displacement.dot(bitangent)*10)/10];
    pegCustomOffsets=next;
    try{pegPositions(info,config);pegFastPreview=true;try{$('pegPreviewBtn').click()}finally{pegFastPreview=false}$('pegPreviewInfo').textContent=`Pasador ${index+1} situado en (${next[index][0]}, ${next[index][1]}) mm. Posición estimada.`;}
    catch(err){pegCustomOffsets=pegDrag.previous.map(pair=>[...pair]);$('pegPreviewBtn').click();status(err.message)}
  }
  e.stopImmediatePropagation();e.preventDefault();
},true);
function finishPegDrag(e){
  if(!pegDrag||pegDrag.id!==e.pointerId)return;
  const previous=pegDrag.previous;pegDrag=null;orbit.enabled=true;
  try{renderer.domElement.releasePointerCapture(e.pointerId)}catch(_){}
  if(e.type==='pointercancel'){pegCustomOffsets=previous.map(pair=>[...pair]);$('pegPreviewBtn').click();status('Movimiento de pasador cancelado; se restauró su posición anterior.')}
  else{$('pegPreviewBtn').click();status('Posición táctil registrada. Comprueba la vista previa antes de aplicar los encastres.');}
  e.stopImmediatePropagation();e.preventDefault();
}
renderer.domElement.addEventListener('pointerup',finishPegDrag,true);
renderer.domElement.addEventListener('pointercancel',finishPegDrag,true);
const pegFields=['pegCount','pegSpacing','pegOffsetU','pegOffsetV','pegDiameter','pegDepth','pegClearance','pegMinWall'];
for(const field of pegFields)$(field).addEventListener('input',()=>{pegCustomOffsets=null;pegAutoInfo=null;disablePegTouch();clearPegMarkers();$('pegPreviewInfo').textContent='La ubicación ha cambiado. Vuelve a pulsar Ver ubicación de pasadores.'});

// ---- Encastres exactos (sin booleanas): utilidades compartidas ----
function connectorFootprint(center,normal,c,grow){
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal),pts=[];
  let local;
  if(c.shape==='rectangular'){const w=c.width/2+grow,h=c.height/2+grow;local=[[-w,-h],[w,-h],[w,h],[-w,h]];}
  else if(c.shape==='dovetail'){local=dovetailOutline({width:c.width+2*grow,height:c.height+2*grow,taper:c.taper}).map(([x,y])=>[x,-y]);}
  else{const r=c.diameter/2+grow,seg=Math.max(24,Math.min(72,Math.round(r*8)));local=Array.from({length:seg},(_,i)=>{const a=2*Math.PI*i/seg;return [r*Math.cos(a),r*Math.sin(a)]});}
  for(const [x,z] of local){const v=new THREE.Vector3(x,0,z).applyQuaternion(q).add(center);pts.push([v.x,v.y,v.z]);}
  return pts;
}
function worldSoup(mesh){
  mesh.updateWorldMatrix(true,false);
  const g=mesh.geometry,p=g.getAttribute('position'),idx=g.getIndex(),n=idx?idx.count:p.count,out=new Float32Array(n*3),v=new THREE.Vector3();
  for(let i=0;i<n;i++){v.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(mesh.matrixWorld);out[3*i]=v.x;out[3*i+1]=v.y;out[3*i+2]=v.z;}
  return out;
}
// Primera cara del material más usado de la pieza: los pasadores y alojamientos toman ese color.
function mainFaceIndex(geometry){const mat=faceMaterials(geometry),count=new Map();for(const x of mat)count.set(x,(count.get(x)||0)+1);let best=0,n=-1;for(const [k,v] of count)if(v>n){n=v;best=k;}return mat.indexOf(best);}
function faceMaterials(geometry){
  const n=(geometry.index?geometry.index.count:geometry.getAttribute('position').count)/3,mat=new Int16Array(n);
  for(const gr of geometry.groups)for(let f=gr.start/3;f<Math.min(n,(gr.start+gr.count)/3);f++)mat[f]=gr.materialIndex;
  return mat;
}
// Convierte el resultado exacto (mundo) en geometría local de la pieza, con grupos de material.
function exactToGeometry(result,mesh,materials){
  const inv=mesh.matrixWorld.clone().invert(),nf=result.tri.length/3,order=Array.from({length:nf},(_,i)=>i);
  const matOf=f=>{const src=result.fuente[f];return src>=0&&src<materials.length?materials[src]:0};
  order.sort((a,b)=>matOf(a)-matOf(b));
  const out=new Float32Array(nf*9),v=new THREE.Vector3(),g=new THREE.BufferGeometry();
  order.forEach((f,i)=>{for(let k=0;k<3;k++){const vi=result.tri[3*f+k];v.set(result.pos[3*vi],result.pos[3*vi+1],result.pos[3*vi+2]).applyMatrix4(inv);out[9*i+3*k]=v.x;out[9*i+3*k+1]=v.y;out[9*i+3*k+2]=v.z;}});
  let start=0;for(let i=1;i<=nf;i++)if(i===nf||matOf(order[i])!==matOf(order[start])){g.addGroup(3*start,3*(i-start),matOf(order[start]));start=i;}
  g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));g.computeVertexNormals();g.computeBoundingBox();return g;
}

// Formas de los encastres para una mitad concreta, con su posición actual.
// src: la mitad en cuyo marco se calcularon los centros; half: la mitad a la que se aplican.
function connectorShapesFor(info,src,half,centersWorld,c,role){
  src.updateWorldMatrix(true,false);half.updateWorldMatrix(true,false);
  const toLocal=src.matrixWorld.clone().invert(),axes=pegAxes(info,half);
  const centers=centersWorld.map(p=>p.clone().applyMatrix4(toLocal).applyMatrix4(half.matrixWorld));
  const shapes=centers.map(center=>{
    if(c.shape==='dovetail'){
      const eje=($('dovetailAxis')?.value==='bitangent'?axes.bitangent:axes.tangent).toArray();
      const cm=colaDeMilano({centro:center.toArray(),normal:axes.normal.toArray(),eje,ancho:c.width,estrechamiento:c.taper,altura:c.depth,largo:c.height,holgura:c.clearance});
      return role==='male'?cm.macho:cm.hembra;
    }
    return connectorFootprint(center,axes.normal,c,role==='male'?0:c.clearance);
  });
  return {plane:{point:axes.point.toArray(),normal:axes.normal.toArray()},normal:axes.normal,shapes,centers};
}
// Separa una mitad a lo largo de la normal del corte para que se vean los encastres.
function separateForReview(piece,normal,distance){
  const p=piece.getWorldPosition(new THREE.Vector3()).addScaledVector(normal,distance);
  piece.parent.updateWorldMatrix(true,false);piece.parent.worldToLocal(p);piece.position.copy(p);
  basePositions.set(piece.uuid,piece.position.clone());piece.updateMatrixWorld(true);
}
$('pegApplyBtn').onclick=async()=>{
  if(bedMode||explode||xray)return status('Vuelve a la vista ensamblada del modelo y desactiva Rayos X.');
  let pair,c,positionInfo;
  try{pair=selectedCutPair();c=pegConfig();if(!usesV2f(c))positionInfo=pegPositions(pair.info,c)}catch(e){return status(e.message)}
  if(usesV2f(c))return applyV2fConnectors(pair,c);
  if(c.shape==='alignment')return applyLooseAlignmentPins(pair,c,positionInfo);
  const {m,mate,info}=pair,positive=info.side==='positive'?m:mate,negative=info.side==='negative'?m:mate;
  try{verifyOperationInput(positive.geometry,'Pieza para pasador');verifyOperationInput(negative.geometry,'Pieza para alojamiento')}catch(e){return status(e.message+' Los encastres rectangulares y la cola de milano necesitan una malla sin defectos; el pin redondo y los pasadores sueltos sí funcionan con esta pieza.')}
  const {normal,centers}=positionInfo;
  const minWall=Number($('pegMinWall').value);
  if(!Number.isFinite(minWall)||minWall<0.6||minWall>10)return status('El espesor mínimo debe estar entre 0.6 y 10 mm.');
  let pegGeo=null,socketGeo=null,sepNormal=null;
  status('Calculando encastres…');await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,20)));
  try{
    // Pasador / riel: sale de la cara del corte de la mitad positiva hacia la negativa.
    const M=connectorShapesFor(info,m,positive,centers,c,'male'),F=connectorShapesFor(info,m,negative,centers,c,'female');
    const male=aplicarEncastreExacto(worldSoup(positive),{plano:M.plane,huellas:M.shapes,profundidad:c.depth,sentido:-1,tipo:'saliente',margen:0.6,fuenteNueva:mainFaceIndex(positive.geometry)});
    // Alojamiento / canal: hueco con holgura en la mitad negativa, un poco más profundo que el pasador.
    const female=aplicarEncastreExacto(worldSoup(negative),{plano:F.plane,huellas:F.shapes,profundidad:c.depth+c.clearance+0.2,sentido:-1,tipo:'hueco',muro:minWall,margen:minWall,fuenteNueva:mainFaceIndex(negative.geometry)});
    sepNormal=M.normal.clone();
    pegGeo=exactToGeometry(male,positive,faceMaterials(positive.geometry));
    socketGeo=exactToGeometry(female,negative,faceMaterials(negative.geometry));
    requireClosedResult(pegGeo,'Pieza con pasador');requireClosedResult(socketGeo,'Pieza con alojamiento');
    pegGeo.userData={connectorExact:{added:male.cambioVolumen,removed:-female.cambioVolumen}};
  }catch(e){pegGeo?.dispose();socketGeo?.dispose();console.error(e);clearPegMarkers();return status('Encastres cancelados: '+e.message+' (se quitó la vista previa; corrige y vuelve a pulsar «Ver ubicación de pasadores»).')}
  save();disablePegTouch();pegCustomOffsets=null;pegAutoInfo=null;clearPegMarkers();(transform.detach(),gizmoTarget=null);
  const replace=(old,geometry)=>{
    const replacement=new THREE.Mesh(geometry,Array.isArray(old.material)?old.material.map(x=>x.clone()):old.material.clone());replacement.name=old.name;
    replacement.position.copy(old.position);replacement.quaternion.copy(old.quaternion);replacement.scale.copy(old.scale);
    replacement.userData=structuredClone(old.userData);replacement.userData.bisturiCut.connectorMade=true;
    old.parent.add(replacement);old.removeFromParent();const index=meshes.indexOf(old);meshes[index]=replacement;
    basePositions.set(replacement.uuid,replacement.position.clone());originalMaterials.set(replacement.uuid,replacement.material);
    for(const bed of beds){const index=bed.items.indexOf(old.uuid);if(index!==-1){bed.items[index]=replacement.uuid;bed.placements[replacement.uuid]=bed.placements[old.uuid];delete bed.placements[old.uuid]}}
    return replacement;
  };
  const newPositive=replace(positive,pegGeo),newNegative=replace(negative,socketGeo);
  newPositive.userData.bisturiCut.mate=newNegative.uuid;newNegative.userData.bisturiCut.mate=newPositive.uuid;
  newPositive.userData.bisturiCut.connectorCount=centers.length;newNegative.userData.bisturiCut.connectorCount=centers.length;
  selected=newPositive;dirty=true;refreshBeds();updateList();updateStats();fit();
const gap=c.depth+(c.shape==='dovetail'?c.height+c.clearance:0)+10;separateForReview(newPositive,sepNormal,gap);updateList();fit();
  const sep=` Las dos mitades se separaron ${gap.toFixed(0)} mm para que veas los encastres; Atrás las vuelve a juntar.`;
  if(c.shape==='dovetail'){
    status(`${centers.length} cola(s) de milano deslizante(s): riel de ${c.height.toFixed(1)} mm de largo, ${(c.width-2*c.taper).toFixed(1)} → ${c.width.toFixed(1)} mm de ancho y ${c.depth.toFixed(1)} mm de alto; canal con ${c.clearance.toFixed(2)} mm de holgura y entrada. Monta apoyando el riel en la entrada y deslizándolo hasta el tope.`+sep);
  }else if(c.shape==='rectangular'){
    status(`${centers.length} encastre(s) rectangular(es): ${c.width.toFixed(2)} × ${c.height.toFixed(2)} mm; alojamiento ${(c.width+2*c.clearance).toFixed(2)} × ${(c.height+2*c.clearance).toFixed(2)} mm; profundidad ${c.depth.toFixed(2)} mm.`+sep);
  }else{
    const dims=inspectConnectorSpec(c);
    status(`${centers.length} pasador(es): Ø${dims.pegDiameter.toFixed(2)} mm; alojamiento Ø${dims.socketDiameter.toFixed(2)} mm; holgura radial ${c.clearance.toFixed(2)} mm.`+sep);
  }
};

// Encastres redondos como en la primera versión: pin pegado (macho-hembra) o pasadores sueltos.
// La comprobación es relativa: el encastre no puede abrir bordes nuevos en la malla, pero no
// rechaza piezas que ya traían pequeños defectos de origen (como hacía la primera versión).
// Cuenta bordes abiertos de verdad (topología): las astillas finísimas cierran la malla igual
// y no se cuentan como agujeros, porque el laminador las trata bien.
function openEdgeCount(geometry){const q=analyzeMeshGeometry(geometry,{tolerance:1e-7,maxTriangles:4000000,degenerateEdges:true});return q.level==='unknown'?null:q.boundary+q.nonManifold}
async function applyV2fConnectors(pair,c){
  status(c.shape==='alignment'?'Calculando pasadores…':'Calculando encastres…');await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,20)));
  let run,geos=[],pinGeos=[];
  try{
    // Si una zona de la tapa resultara defectuosa al rehacerla, se prueba otra zona sana.
    const evitar=[[],[]];let aviso='';
    for(let intento=0;;intento++){
      geos.forEach(g=>g?.dispose());geos=[];
      run=runV2f(pair,c,{evitar});
      const {r,M,m,mate}=run,inv=M.clone().invert();let malo=-1,extra=0;
      r.piezas.forEach((q,i)=>{const mesh=i?mate:m;geos.push(q.cambiada?geometryFromSoup(q.sopa,q.col,inv):null);
        if(q.cambiada&&malo<0){const before=openEdgeCount(mesh.geometry),after=openEdgeCount(geos[i]);if(before!==null&&after!==null&&after>before){malo=i;extra=after-before;aviso=`el encastre abriría ${extra} borde(s) en «${mesh.name}».`}}});
      if(malo<0)break;
      if(intento>=4)throw Error(aviso+' La cara del corte tiene defectos en esa zona: mueve el plano de corte unos milímetros o mueve el encastre.');
      for(const u of r.ubicaciones)evitar[malo].push(u.islas[malo]);
    }
    root.updateWorldMatrix(true,false);const toRoot=root.matrixWorld.clone().invert();
    for(const pin of run.r.pasadores){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pin.sopa,3));g.applyMatrix4(toRoot);g.computeVertexNormals();pinGeos.push({g,largo:pin.largo,d:pin.d});}
  }catch(e){geos.forEach(g=>g?.dispose());pinGeos.forEach(p=>p.g.dispose());console.error(e);clearPegMarkers();return status('Encastres cancelados: '+e.message+' (se quitó la vista previa).')}
  const {r,m,mate}=run;
  save();disablePegTouch();pegCustomOffsets=null;pegAutoInfo=null;clearPegMarkers();(transform.detach(),gizmoTarget=null);
  const replace=(old,geometry)=>{
    if(!geometry){old.userData.bisturiCut.connectorMade=true;return old}
    const replacement=new THREE.Mesh(geometry,Array.isArray(old.material)?old.material.map(x=>x.clone()):old.material.clone());replacement.name=old.name;
    replacement.position.copy(old.position);replacement.quaternion.copy(old.quaternion);replacement.scale.copy(old.scale);
    replacement.userData=structuredClone(old.userData);replacement.userData.bisturiCut.connectorMade=true;
    old.parent.add(replacement);old.removeFromParent();meshes[meshes.indexOf(old)]=replacement;
    basePositions.set(replacement.uuid,replacement.position.clone());originalMaterials.set(replacement.uuid,replacement.material);
    for(const bed of beds){const i=bed.items.indexOf(old.uuid);if(i!==-1){bed.items[i]=replacement.uuid;bed.placements[replacement.uuid]=bed.placements[old.uuid];delete bed.placements[old.uuid]}}
    return replacement;
  };
  const nm=replace(m,geos[0]),nmate=replace(mate,geos[1]);
  nm.userData.bisturiCut.mate=nmate.uuid;nmate.userData.bisturiCut.mate=nm.uuid;
  nm.userData.bisturiCut.connectorCount=r.ubicaciones.length;nmate.userData.bisturiCut.connectorCount=r.ubicaciones.length;
  pinGeos.forEach(({g,largo,d},i)=>{
    const piece=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xf9c65f,roughness:.55}));
    piece.name=`Pasador ${i+1} (Ø${d.toFixed(1)} × ${largo.toFixed(1)} mm)`;
    piece.userData.bisturiAlignmentPin={diameter:d,length:largo,clearance:c.clearance};
    root.add(piece);meshes.push(piece);basePositions.set(piece.uuid,piece.position.clone());originalMaterials.set(piece.uuid,piece.material);
  });
  selected=nm;dirty=true;refreshBeds();updateList();updateStats();fit();
  // Separa la mitad positiva a lo largo de la normal del corte para que se vean pines y agujeros.
  const positive=nm.userData.bisturiCut.side==='positive'?nm:nmate,axes=pegAxes(positive.userData.bisturiCut,positive);
  const deepest=Math.max(...r.ubicaciones.map(u=>Math.max(...u.profundidad))),gap=deepest+10;
  separateForReview(positive,axes.normal,gap);updateList();fit();
  const depths=[...new Set(r.ubicaciones.map(u=>(c.shape==='alignment'?u.profundidad[0]+u.profundidad[1]-0.6:u.profundidad[1]).toFixed(1)))].join(', ');
  const moved=r.ubicaciones.filter(u=>u.movido>0.05).length,missing=c.count-r.ubicaciones.length;
  let t=c.shape==='alignment'
    ?`${r.ubicaciones.length} pasador(es) suelto(s) de Ø${c.diameter.toFixed(1)} mm (largo ${depths} mm) colocados en sus agujeros; agujeros de Ø${(c.diameter+2*c.clearance).toFixed(2)} mm en las dos mitades. Asígnalos a una cama para imprimirlos.`
    :`${r.ubicaciones.length} encastre(s) macho-hembra: pin de Ø${c.diameter.toFixed(1)} mm y ${depths} mm de alto; el agujero (Ø${(c.diameter+2*c.clearance).toFixed(2)} mm) va en la mitad más gruesa.`;
  if(moved)t+=` ${moved} se movió al punto válido más cercano.`;
  if(missing>0)t+=` No cupieron ${missing} con esa medida y pared.`;
  status(t+` La mitad positiva se separó ${gap.toFixed(0)} mm para que veas los encastres; Atrás la vuelve a juntar.`);
}

// Pasadores de alineación desmontables: dos alojamientos frente a frente y piezas STL independientes.
// Experimentales: revisar dimensión real, espesor, sentido de montaje y tolerancia en un laminador.
async function applyLooseAlignmentPins(pair,c,positionInfo){
  if(bedMode||explode||xray)return status('Regresa a la figura ensamblada para crear pasadores de alineación.');
  const {m,mate,info}=pair;
  const positive=info.side==='positive'?m:mate,negative=info.side==='negative'?m:mate;
  const {normal,centers}=positionInfo;
  const depthPerSide=c.depth/2;
  try{
    validateAlignmentPinSpec({...c,depthPerSide});
    verifyOperationInput(positive.geometry,'Primera mitad');
    verifyOperationInput(negative.geometry,'Segunda mitad');
    // La extensión axial es una comprobación previa; no demuestra espesor de pared local.
    for(const [piece,side] of [[positive,1],[negative,-1]]){
      piece.updateWorldMatrix(true,false);
      const attr=piece.geometry.getAttribute('position'),v=new THREE.Vector3();let maxDepth=0;
      const cutPoint=new THREE.Vector3().fromArray(info.point);
      for(let i=0;i<attr.count;i++){
        v.fromBufferAttribute(attr,i).applyMatrix4(piece.matrixWorld);
        maxDepth=Math.max(maxDepth,side*v.sub(cutPoint).dot(normal));
      }
      assertConnectorDepthFits({depth:depthPerSide,clearance:c.clearance,maxDepth});
    }
  }catch(e){clearPegMarkers();return status('Pasadores cancelados: '+e.message+' (se quitó la vista previa).')}
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
  const minWall=Number($('pegMinWall').value);
  if(!Number.isFinite(minWall)||minWall<0.6||minWall>10)return status('El espesor mínimo debe estar entre 0.6 y 10 mm.');
  let aGeo,bGeo,alignNormal=null,pinCenters=null;
  const pinSpecs=[];
  status('Calculando pasadores…');await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,20)));
  try{
    const socketDepth=depthPerSide+c.clearance+0.15,cc={...c,shape:'circular'};
    const PA=connectorShapesFor(info,m,positive,centers,cc,'female'),PB=connectorShapesFor(info,m,negative,centers,cc,'female');
    // Un alojamiento en cada mitad, frente a frente; el pasador suelto entra en los dos.
    const A=aplicarEncastreExacto(worldSoup(positive),{plano:PA.plane,huellas:PA.shapes,profundidad:socketDepth,sentido:1,tipo:'hueco',muro:minWall,margen:minWall,fuenteNueva:mainFaceIndex(positive.geometry)});
    const B=aplicarEncastreExacto(worldSoup(negative),{plano:PB.plane,huellas:PB.shapes,profundidad:socketDepth,sentido:-1,tipo:'hueco',muro:minWall,margen:minWall,fuenteNueva:mainFaceIndex(negative.geometry)});
    alignNormal=PA.normal.clone();pinCenters=PB.centers;
    aGeo=exactToGeometry(A,positive,faceMaterials(positive.geometry));
    bGeo=exactToGeometry(B,negative,faceMaterials(negative.geometry));
    requireClosedResult(aGeo,'Mitad A con alojamiento');requireClosedResult(bGeo,'Mitad B con alojamiento');
    for(const center of pinCenters)pinSpecs.push({center:center.clone()});
  }catch(e){aGeo?.dispose();bGeo?.dispose();console.error(e);clearPegMarkers();return status('Pasadores cancelados: '+e.message+' (se quitó la vista previa).')}
  // Aplicar todo como una sola acción reversible, solo después de validar ambos alojamientos.
  save();disablePegTouch();pegCustomOffsets=null;pegAutoInfo=null;clearPegMarkers();(transform.detach(),gizmoTarget=null);
  const replace=(old,geometry)=>{
    const replacement=new THREE.Mesh(geometry,Array.isArray(old.material)?old.material.map(x=>x.clone()):old.material.clone());replacement.name=old.name;
    replacement.position.copy(old.position);replacement.quaternion.copy(old.quaternion);replacement.scale.copy(old.scale);
    replacement.userData=structuredClone(old.userData);replacement.userData.bisturiCut.connectorMade=true;
    old.parent.add(replacement);old.removeFromParent();meshes[meshes.indexOf(old)]=replacement;
    basePositions.set(replacement.uuid,replacement.position.clone());originalMaterials.set(replacement.uuid,replacement.material);
    for(const bed of beds){const i=bed.items.indexOf(old.uuid);if(i!==-1){bed.items[i]=replacement.uuid;bed.placements[replacement.uuid]=bed.placements[old.uuid];delete bed.placements[old.uuid]}}
    return replacement;
  };
  const newPositive=replace(positive,aGeo),newNegative=replace(negative,bGeo);
  newPositive.userData.bisturiCut.mate=newNegative.uuid;newNegative.userData.bisturiCut.mate=newPositive.uuid;
  newPositive.userData.bisturiCut.connectorCount=centers.length;
  newNegative.userData.bisturiCut.connectorCount=centers.length;
  // Los pasadores independientes se crean en coordenadas de la raíz y quedan sin asignar a camas.
  root.updateWorldMatrix(true,false);
  const inverseRoot=root.matrixWorld.clone().invert();
  pinSpecs.forEach(({center},i)=>{
    const pin=prismaSuelto(connectorFootprint(center,alignNormal,{...c,shape:'circular'},0),alignNormal.toArray(),-c.depth/2,c.depth/2);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pin.pos,3));geometry.setIndex(new THREE.BufferAttribute(pin.tri,1));
    geometry.applyMatrix4(inverseRoot);geometry.computeVertexNormals();
    const piece=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xf9c65f,roughness:.55}));
    piece.name=`Pasador alineación ${i+1}`;
    piece.userData.bisturiAlignmentPin={diameter:c.diameter,length:c.depth,clearance:c.clearance};
    root.add(piece);meshes.push(piece);basePositions.set(piece.uuid,piece.position.clone());originalMaterials.set(piece.uuid,piece.material);
  });
  selected=newPositive;dirty=true;refreshBeds();updateList();updateStats();fit();
  const gap=depthPerSide+10;separateForReview(newPositive,alignNormal,gap);updateList();fit();
  status(`${centers.length} pasador(es) desmontables (Ø${c.diameter.toFixed(2)} × ${c.depth.toFixed(1)} mm) y un alojamiento en cada mitad (Ø${(c.diameter+2*c.clearance).toFixed(2)} mm). La mitad positiva se separó ${gap.toFixed(0)} mm para que veas los alojamientos; Atrás la vuelve a juntar. Asigna los pasadores a una cama para imprimirlos.`);
}

$('cutOrientation').onchange=()=>{$('cutAngles').hidden=$('cutOrientation').value!=='inclinado';refreshCutGuide()};
['cutPercent','cutAngleX','cutAngleZ'].forEach(id=>$(id).addEventListener('input',refreshCutGuide));
$('resetView').onclick=fit;$('undoBtn').onclick=undoStep;$('redoBtn').onclick=redoStep;document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoStep():undoStep()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redoStep()}});
// La comprobación es topológica: no analiza espesor de pared, autointersecciones ni tolerancias.
let meshQualityLast=[];
function runMeshQuality(){
  const host=$('qualityResults');host.replaceChildren();meshQualityLast=[];
  if(!meshes.length){host.textContent='No hay mallas para revisar.';return}
  for(const mesh of meshes){
    const data=analyzeMeshGeometry(mesh.geometry);meshQualityLast.push({mesh:mesh.name,result:data});
    const div=document.createElement('div');div.className='quality-item';
    const label=document.createElement('strong');label.textContent=(data.ok?'✓ ':'⚠ ')+mesh.name;
    const detail=document.createElement('span');
    detail.textContent=data.level==='unknown'?data.reason:`${data.triangles} triángulos · Bordes abiertos: ${data.boundary??'—'} · Aristas no manifold: ${data.nonManifold??'—'} · Orientación inconsistente: ${data.winding??'—'} · Triángulos degenerados: ${data.degenerate??'—'} · Datos inválidos: ${data.invalid??'—'}`;
    div.append(label,detail);host.appendChild(div);
  }
  const issues=meshQualityLast.filter(x=>!x.result.ok).length;
  status(issues?`Revisión preliminar: ${issues} malla(s) requieren atención o no pudieron analizarse. No garantiza imprimibilidad.`:'Sin errores topológicos detectados. Aún falta comprobar espesor, autointersecciones y resultado en laminador.');
}
$('qualityCheckBtn').onclick=runMeshQuality;
// El diagnóstico de importación no impide abrir geometrías defectuosas.
// Los controles de revisión permiten seleccionar la malla y localizar la reparación.
function diagnoseAfterImport(){
  const host=$('importDiagnosis');if(!host)return;
  host.replaceChildren();
  if(!meshes.length){host.textContent='No hay mallas reconocibles para revisar.';return}
  let flagged=0;
  for(const mesh of meshes){
    let classification;
    try{classification=classifyImportedMesh(analyzeMeshGeometry(mesh.geometry,{tolerance:1e-6,maxTriangles:4000000}))}
    catch(err){classification={status:'unknown',description:'No se pudo analizar: '+err.message,repairCandidate:false}}
    if(classification.status==='ok')continue;
    flagged++;
    const item=document.createElement('div');item.className='quality-item';
    const label=document.createElement('strong');label.textContent='⚠ '+mesh.name;
    const detail=document.createElement('span');detail.textContent=classification.description;
    const inspect=document.createElement('button');inspect.type='button';inspect.className='secondary';inspect.textContent='Seleccionar y revisar';
    inspect.addEventListener('click',()=>{select(mesh);runMeshQuality();$('qualityResults').scrollIntoView({behavior:'smooth',block:'nearest'});});
    item.append(label,detail,inspect);
    if(classification.repairCandidate){
      const repair=document.createElement('button');repair.type='button';repair.className='secondary';repair.textContent='Ver reparación posible';
      repair.addEventListener('click',()=>{select(mesh);previewRepair();$('repairResults').scrollIntoView({behavior:'smooth',block:'nearest'})});
      item.append(repair);
    }
    host.appendChild(item);
  }
  if(!flagged)host.textContent='Sin defectos topológicos detectados en las mallas analizadas. Esto no garantiza imprimibilidad.';
  status(flagged?`Importación completada: ${flagged} malla(s) requieren revisión. Puedes inspeccionarlas y probar una reparación segura.`:`Importación completada: ${meshes.length} malla(s) sin defectos topológicos detectados.`);
}


let pendingRepair=null,repairOutline=null;
function cancelRepairPreview(){
  for(const o of repairOutline||[]){o.removeFromParent();o.geometry.dispose();o.material.dispose()}repairOutline=null;
  if(pendingRepair?.items)for(const it of pendingRepair.items)if(it.mesh.geometry!==it.geometry)it.geometry.dispose();
  pendingRepair=null;$('repairApplyBtn').disabled=true;
}
// Reparación automática: une vértices, quita triángulos degenerados y repetidos, cose grietas,
// orienta las caras y cierra agujeros. Sin pieza seleccionada, prepara todas las piezas visibles.
let repairBusy=false;
async function previewRepair(){
  if(repairBusy)return;
  cancelRepairPreview();const panel=$('repairResults');
  const lista=selected&&meshes.includes(selected)?[selected]:meshes.filter(m=>m.visible);
  if(!lista.length){panel.textContent='Abre un modelo primero.';return}
  repairBusy=true;$('repairPreviewBtn').disabled=true;
  const propuestas=[],lineas=[];
  try{
    for(const [i,m] of lista.entries()){
      const antes=analyzeMeshGeometry(m.geometry,{tolerance:1e-6,maxTriangles:4000000,degenerateEdges:true});
      if(antes.level!=='unknown'&&!antes.boundary&&!antes.nonManifold&&!antes.winding&&!antes.degenerate&&!antes.invalid){lineas.push(`${m.name}: ya estaba bien.`);continue}
      const prefijo=lista.length>1?`Pieza ${i+1} de ${lista.length}: `:'';
      const r=await repararMalla(THREE,m.geometry,{progreso:t=>{panel.textContent=prefijo+t;status('Reparando: '+t)}});
      const despues=analyzeMeshGeometry(r.geometry,{tolerance:1e-6,maxTriangles:4000000,degenerateEdges:true});
      const fallos=q=>q.level==='unknown'?null:q.boundary+q.nonManifold+q.winding;
      const fa=fallos(antes),fd=fallos(despues);
      if(fa===0&&!r.informe.repetidos&&!r.informe.degenerados){r.geometry.dispose();lineas.push(`${m.name}: ya estaba bien.`);continue}
      propuestas.push({mesh:m,source:m.geometry,geometry:r.geometry});
      const I=r.informe,partes=[];
      if(I.agujeros)partes.push(`${I.agujeros} agujero(s) cerrado(s)`);
      if(I.grietas)partes.push(`${I.grietas} grieta(s) cosida(s)`);
      if(I.repetidos)partes.push(`${I.repetidos} triángulo(s) repetido(s) quitado(s)`);
      if(I.degenerados)partes.push(`${I.degenerados} triángulo(s) degenerado(s) quitado(s)`);
      if(antes.winding&&!despues.winding)partes.push('caras orientadas hacia fuera');
      lineas.push(`${m.name}: ${partes.join(', ')||'limpieza de la malla'}. Problemas: ${fa??'?'} → ${fd??'?'}.`+(I.sinCerrar?` ${I.sinCerrar} parte(s) con aristas compartidas por más de dos caras no se pudieron cerrar.`:''));
      if(r.bordes.length){const o=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(r.bordes,3)),new THREE.LineBasicMaterial({color:0xffd76b,depthTest:false}));o.renderOrder=40;m.add(o);(repairOutline||(repairOutline=[])).push(o);}
    }
    if(!propuestas.length){panel.textContent=lineas.join(' ')+' No hace falta reparar nada.';status('Las piezas no necesitan reparación.');return}
    pendingRepair={items:propuestas};
    panel.textContent=lineas.join(' ')+' En amarillo, los bordes abiertos que tenía. Pulsa «Aplicar reparación» para guardarla.';
    $('repairApplyBtn').disabled=false;
    status('Reparación lista para aplicar. La pieza aún no ha cambiado.');
  }catch(err){console.error(err);panel.textContent='No se pudo reparar: '+err.message;status('Reparación cancelada: '+err.message)}
  finally{repairBusy=false;$('repairPreviewBtn').disabled=false;}
}
$('repairPreviewBtn').onclick=previewRepair;
$('repairCancelBtn').onclick=()=>{cancelRepairPreview();$('repairResults').textContent='Vista previa cancelada.'};
$('repairApplyBtn').onclick=()=>{
  if(!pendingRepair?.items?.length)return;
  if(pendingRepair.items.some(it=>it.mesh.geometry!==it.source||!meshes.includes(it.mesh)))return status('La pieza cambió: vuelve a pulsar «Reparar malla».');
  const items=pendingRepair.items;
  for(const o of repairOutline||[]){o.removeFromParent();o.geometry.dispose();o.material.dispose()}repairOutline=null;
  save();
  for(const it of items){it.mesh.geometry=it.geometry;surfaceSelections.delete(it.mesh.uuid);}
  pendingRepair=null;$('repairApplyBtn').disabled=true;clearSurfaceOverlays();scheduleAcceleration?.();
  updateStats();runMeshQuality();$('repairResults').textContent=`Reparación aplicada a ${items.length} pieza(s). «Atrás» la deshace.`;
  status('Reparación aplicada. Revisa la pieza en tu laminador.');
};

$('exportBtn').onclick=()=>{if(!selected)return status('Selecciona primero una malla.');try{const exporter=new STLExporter();selected.updateMatrixWorld(true);const data=exporter.parse(selected,{binary:true});validateExportedSTL(data,selected);download(convertSTLToSlicerZUp(data),selected.name.replace(/[^\w-]/g,'_')+'.stl','model/stl');status('STL de la malla seleccionada descargado. Verifica la malla en tu laminador.')}catch(e){status('Error al exportar: '+e.message)}};
$('reportBtn').onclick=()=>{
  if(!modelLoaded)return status('No hay modelo.');
  try{
    if(meshQualityLast.length!==meshes.length)runMeshQuality();
    const report=buildGeneralReport({name:$('projectName').value,date:new Date().toISOString(),nozzle:$('nozzle').value,bed:beds.find(b=>b.id===activeBed),entries:meshQualityLast});
    download(report,'informe_general_bisturi3d.txt','text/plain;charset=utf-8');
    status('Informe general y diagnóstico de mallas descargados en un solo archivo.');
  }catch(e){status('No se pudo generar el informe: '+e.message)}
};
$('newBtn').onclick=()=>{if(dirty)$('warning').hidden=false;else{clear();status('Nuevo proyecto.')}};$('cancelNew').onclick=()=>$('warning').hidden=true;$('confirmNew').onclick=()=>{clear();$('warning').hidden=true;status('Nuevo proyecto.')} ;window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});

// Gestión de camas: exclusivamente en la memoria del navegador.
let beds=[{id:1,name:'Cama 1',x:256,y:256,z:256,items:[],placements:{}}],activeBed=1,nextBedId=2;
const getBed=()=>beds.find(b=>b.id===activeBed)||beds[0];
function resetBeds(){beds=[{id:1,name:'Cama 1',x:256,y:256,z:256,items:[],placements:{}}];activeBed=1;nextBedId=2;refreshBeds()}
// Se usa la MISMA transformación para la vista, el diagnóstico y el STL final.
function rectangleFor(b,m){
  const holder=makePlacedMesh(m,b.placements[m.uuid]||{x:0,y:0,rot:0});
  const box=new THREE.Box3().setFromObject(holder),size=box.getSize(new THREE.Vector3());
  return {x:box.min.x,y:box.min.z,w:size.x,h:size.z,z:size.y,name:m.name};
}
function placementFitsInBed(b,m,placement){
  if(!b||!m||!placement||![placement.x,placement.y,placement.rot].every(Number.isFinite))return {ok:false,reason:'posición inválida'};
  const holder=makePlacedMesh(m,placement);
  const box=new THREE.Box3().setFromObject(holder);
  return validateFullBedBounds(b,{minX:box.min.x,minY:box.min.z,minZ:box.min.y,maxX:box.max.x,maxY:box.max.z,maxZ:box.max.y});
}
function rotatedSize(m,deg=0){
  const holder=makePlacedMesh(m,{x:0,y:0,rot:deg});
  const size=new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  return {x:size.x,y:size.z,z:size.y};
}
function validateExportedSTL(data,object){
  object.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(object);
  if(box.isEmpty())throw Error('La geometría exportada está vacía.');
  const details=inspectBinarySTL(data,{min:box.min.toArray(),max:box.max.toArray()});
  // Auditoría de la geometría exportada tras posición, giro y escala.
  // Se excluyen objetos auxiliares que no son mallas imprimibles.
  const expectedMeshes=[];object.traverse(child=>{if(child.isMesh&&child.geometry?.getAttribute('position'))expectedMeshes.push(child)});
  let expectedTriangles=0;
  const accum={triangles:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],mean:[0,0,0],meanSq:[0,0,0]};
  for(const child of expectedMeshes){
    const geom=child.geometry,pos=geom.getAttribute('position'),idx=geom.index;
    const triangles=(idx?idx.count:pos.count)/3;
    if(!Number.isInteger(triangles)||triangles<=0)throw Error('Malla con triángulos incompletos.');
    expectedTriangles+=triangles;
    // Previene sobrecarga en móviles: el control topológico ya tiene un límite de 250000 triángulos.
    if(expectedTriangles>250000)break;
    child.updateWorldMatrix(true,false);
    const coords=new Float64Array(pos.count*3);
    for(let k=0;k<pos.count;k++){coords[k*3]=pos.getX(k);coords[k*3+1]=pos.getY(k);coords[k*3+2]=pos.getZ(k)}
    const indices=idx?Array.from({length:idx.count},(_,k)=>idx.getX(k)):null;
    const point=new THREE.Vector3();
    const stats=inspectExpectedVertexMoments(coords,indices,(x,y,z)=>{point.set(x,y,z).applyMatrix4(child.matrixWorld);return [point.x,point.y,point.z]});
    const n=stats.triangles*3;accum.triangles+=stats.triangles;
    for(let a=0;a<3;a++){
      accum.min[a]=Math.min(accum.min[a],stats.min[a]);accum.max[a]=Math.max(accum.max[a],stats.max[a]);
      accum.mean[a]+=stats.mean[a]*n;accum.meanSq[a]+=stats.meanSq[a]*n;
    }
  }
  if(expectedTriangles<=250000){
    const n=accum.triangles*3;
    for(let a=0;a<3;a++){accum.mean[a]/=n;accum.meanSq[a]/=n}
    assertSTLTransformIntegrity(accum,data);
  }
  const topo=inspectBinarySTLTopology(data);
  if(!topo.ok){
    const reason=topo.unverified?'supera el límite de comprobación topológica':
      `presenta ${topo.boundary} aristas abiertas, ${topo.nonManifold} no manifold, ${topo.winding} orientaciones inconsistentes y ${topo.degenerate} triángulos degenerados`;
    throw Error(`Exportación detenida: el STL ${reason}. Conserva el proyecto y revisa la malla antes de exportar.`);
  }
  return {...details,topology:topo};
}
function overlapping(a,b){return a.x<b.x+b.w-.01&&a.x+a.w>b.x+.01&&a.y<b.y+b.h-.01&&a.y+a.h>b.y+.01}
function projectedBedFootprint(b,m){
  const holder=makePlacedMesh(m,b.placements[m.uuid]||{x:0,y:0,rot:0});
  holder.updateMatrixWorld(true);
  const positions=m.geometry?.getAttribute('position');
  // No se muestrean vértices: si no se puede examinar toda la malla,
  // se conserva la advertencia conservadora de las cajas envolventes.
  if(!positions||positions.count<3||positions.count>150000)return null;
  const copy=holder.children[0],pt=new THREE.Vector3(),points=[];
  for(let i=0;i<positions.count;i++){
    pt.fromBufferAttribute(positions,i).applyMatrix4(copy.matrixWorld);
    if(!Number.isFinite(pt.x)||!Number.isFinite(pt.z))return null;
    points.push({x:pt.x,y:pt.z});
  }
  return convexHull(points);
}
function bedOverlapStatus(b,one,two){
  const r1=rectangleFor(b,one),r2=rectangleFor(b,two);
  if(!overlapping(r1,r2))return 'separadas';
  const first=projectedBedFootprint(b,one),second=projectedBedFootprint(b,two);
  const result=convexFootprintsOverlap(first,second);
  return result===false?'separadas':result===true?'posible':'sin-verificar';
}
// Mismo margen que la distribución automática. No garantiza separación física 3D.
const BED_MIN_CLEARANCE_MM=3;
function getProblems(b){
  const assigned=b.items.map(id=>meshes.find(m=>m.uuid===id)).filter(Boolean);
  const rects=assigned.map(m=>rectangleFor(b,m)),problems=[];
  rects.forEach(r=>{if(r.w>b.x||r.h>b.y||r.z>b.z||r.x<0||r.y<0||r.x+r.w>b.x+.01||r.y+r.h>b.y+.01)problems.push(`${r.name}: excede la cama o está fuera del área`)});
  // Cachear siluetas: evitar reconstruirlas varias veces en cada repintado.
  const footprints=assigned.map(m=>projectedBedFootprint(b,m));
  for(let i=0;i<assigned.length;i++)for(let j=i+1;j<assigned.length;j++){
    const one=footprints[i],two=footprints[j];
    const exact=convexFootprintsDistance(one,two);
    const fallback=exact===null?rectangleFootprintDistance(rects[i],rects[j]):null;
    const distance=exact??fallback;
    const names=`${rects[i].name} y ${rects[j].name}`;
    if(distance===null){problems.push(`${names}: separación sin verificar`);continue}
    if(distance<=.01){
      problems.push(`${names}: ${exact===null?'cajas en contacto o superpuestas; siluetas sin verificar':'siluetas en contacto o superpuestas (posible interferencia)'}`);
    }else if(distance<BED_MIN_CLEARANCE_MM-.001){
      problems.push(`${names}: separación estimada ${distance.toFixed(2)} mm, menor que ${BED_MIN_CLEARANCE_MM} mm${exact===null?' (aproximación por cajas)':''}`);
    }
  }
  return problems;
}
function refreshBeds(){if(bedMode)updateBedStage();syncPlacementFields();const sel=$('bedSelect');sel.replaceChildren();beds.forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=`${b.name} · ${b.x}×${b.y}×${b.z} mm`;sel.append(o)});sel.value=String(activeBed);drawBed();const b=getBed();$('bedPieces').textContent=`Piezas asignadas: ${b.items.length} · ${b.items.map(id=>meshes.find(m=>m.uuid===id)?.name||'').join(', ')||'ninguna'}`}
function drawBed(){const c=$('bedCanvas'),ctx=c.getContext('2d'),b=getBed();if(!ctx||!b)return;const w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0e2035';ctx.fillRect(0,0,w,h);const pad=25,scale=Math.min((w-pad*2)/b.x,(h-pad*2)/b.y),ox=(w-b.x*scale)/2,oy=(h-b.y*scale)/2;
ctx.fillStyle='#16374f';ctx.fillRect(ox,oy,b.x*scale,b.y*scale);ctx.strokeStyle='#58cfff';ctx.lineWidth=2;ctx.strokeRect(ox,oy,b.x*scale,b.y*scale);ctx.strokeStyle='#31546b';ctx.lineWidth=.65;
for(let x=0;x<=b.x;x+=Math.max(10,Math.round(b.x/10/10)*10||10)){ctx.beginPath();ctx.moveTo(ox+x*scale,oy);ctx.lineTo(ox+x*scale,oy+b.y*scale);ctx.stroke()}
for(let y=0;y<=b.y;y+=Math.max(10,Math.round(b.y/10/10)*10||10)){ctx.beginPath();ctx.moveTo(ox,oy+y*scale);ctx.lineTo(ox+b.x*scale,oy+y*scale);ctx.stroke()}
const rects=b.items.map(id=>meshes.find(m=>m.uuid===id)).filter(Boolean).map(m=>({m,r:rectangleFor(b,m)}));rects.forEach(({m,r},i)=>{const invalid=r.x<0||r.y<0||r.x+r.w>b.x+.01||r.y+r.h>b.y+.01||r.z>b.z||rects.some(o=>o.m!==m&&bedOverlapStatus(b,m,o.m)!=='separadas');ctx.fillStyle=invalid?'#a54d66':m===selected?'#36c7c0':['#377bbc','#7357af','#2b9c79','#bd8450'][i%4];ctx.fillRect(ox+r.x*scale,oy+r.y*scale,Math.max(r.w*scale,2),Math.max(r.h*scale,2));ctx.strokeStyle='#d8f3ff';ctx.lineWidth=1;ctx.strokeRect(ox+r.x*scale,oy+r.y*scale,r.w*scale,r.h*scale);ctx.font='10px sans-serif';ctx.fillStyle='#fff';ctx.fillText(m.name.slice(0,15),ox+r.x*scale+3,oy+r.y*scale+12)});
ctx.font='11px sans-serif';ctx.fillStyle='#a8c8e4';ctx.fillText(`X ${b.x} mm`,ox,Math.min(h-3,oy+b.y*scale+15));ctx.save();ctx.translate(Math.max(10,ox-9),oy+Math.min(75,b.y*scale/2));ctx.rotate(-Math.PI/2);ctx.fillText(`Y ${b.y} mm`,0,0);ctx.restore();const probs=getProblems(b);const out=$('bedChecks');out.replaceChildren();const header=document.createElement('div');header.className=probs.length?'bed-warning':'bed-ok';header.textContent=probs.length?`⚠ ${probs.length} advertencia(s) preventivas`:'✓ Sin interferencias de siluetas detectadas (verificación 3D pendiente)';out.append(header);probs.forEach(p=>{const d=document.createElement('div');d.textContent='• '+p;out.append(d)});
}
function layoutBed(){
  const b=getBed();if(!b.items.length)return status('No hay piezas asignadas a esta cama.');
  const items=[];
  for(const id of b.items){
    const m=meshes.find(m=>m.uuid===id);
    if(!m)return status('Distribución cancelada: falta una pieza asignada.');
    const rot=Number(b.placements[id]?.rot??0),size=rotatedSize(m,rot);
    items.push({id,name:m.name,width:size.x,depth:size.y,height:size.z,rot});
  }
  const plan=planAutomaticBedLayout(b,items,{margin:3});
  if(!plan.ok)return status('No se modificó la cama: '+plan.reason);
  // La validación usa exactamente el mismo método que la edición y exportación.
  for(const id of b.items){
    const mesh=meshes.find(m=>m.uuid===id);
    const result=placementFitsInBed(b,mesh,plan.placements[id]);
    if(!result.ok)return status(`No se modificó la cama: ${mesh.name}: ${result.reason}`);
  }
  save();b.placements={...b.placements,...plan.placements};dirty=true;
  drawBed();if(bedMode)updateBedStage();syncPlacementFields();
  status(getProblems(b).length?'Distribución calculada, pero se detectaron advertencias: revisa la cama.':'Distribución automática aplicada sin salirse de la cama ni superponer cajas envolventes.');
}
$('bedSelect').onchange=e=>{const target=Number(e.target.value);if(!beds.some(b=>b.id===target))return;activeBed=target;if(bedMode)enterBed(false);else refreshBeds()};
$('addBed').onclick=()=>{$('bedForm').hidden=!$('bedForm').hidden;$('bedName').value='Cama '+nextBedId};
$('saveBed').onclick=()=>{const name=$('bedName').value.trim(),x=Number($('bedX').value),y=Number($('bedY').value),z=Number($('bedZ').value);if(!name||![x,y,z].every(n=>Number.isFinite(n)&&n>0&&n<=5000))return status('Introduce un nombre y dimensiones válidas entre 1 y 5000 mm.');save();const id=nextBedId++;beds.push({id,name,x,y,z,items:[],placements:{}});activeBed=id;dirty=true;$('bedForm').hidden=true;refreshBeds();status(`Cama creada: ${name}`)};
$('deleteBed').onclick=()=>{if(beds.length===1)return status('Debe conservarse al menos una cama.');const b=getBed();if(b.items.length&&!confirm(`¿Eliminar ${b.name}? Sus ${b.items.length} pieza(s) quedarán sin cama asignada.`))return;save();beds=beds.filter(v=>v!==b);activeBed=beds[0].id;dirty=true;updateList();refreshBeds();status('Cama eliminada. Las mallas siguen presentes en el proyecto.')};
$('assignBed').onclick=()=>{
  if(!selected)return status('Selecciona primero una pieza en el visor o lista.');
  const b=getBed(),id=selected.uuid;
  const proposed=[...new Set([...b.items,id])].map(pid=>{
    const m=meshes.find(mesh=>mesh.uuid===pid),rot=Number((pid===id?beds.find(bed=>bed.items.includes(id))?.placements[id]?.rot:b.placements[pid]?.rot)??0);
    if(!m)return null;const s=rotatedSize(m,rot);return {id:pid,name:m.name,width:s.x,depth:s.y,height:s.z,rot};
  });
  if(proposed.some(p=>!p))return status('No se puede asignar: falta una pieza.');
  const plan=planAutomaticBedLayout(b,proposed,{margin:3});
  if(!plan.ok)return status('No se pudo asignar la pieza: '+plan.reason);
  for(const p of proposed){const m=meshes.find(m=>m.uuid===p.id),r=placementFitsInBed(b,m,plan.placements[p.id]);if(!r.ok)return status('Asignación cancelada: '+r.reason);}
  save();beds.forEach(v=>{v.items=v.items.filter(pid=>pid!==id);delete v.placements[id]});
  b.items=[...new Set([...b.items,id])];b.placements={...b.placements,...plan.placements};dirty=true;
  updateList();refreshBeds();status(`«${selected.name}» enviada y distribuida en ${b.name}.`);
};
$('autoLayout').onclick=layoutBed;
$('exportBed').onclick=()=>{
  const b=getBed();if(!b.items.length)return status('Esta cama no tiene piezas.');
  const warnings=getProblems(b);
  if(warnings.length&&!confirm(`La cama tiene ${warnings.length} advertencia(s) aproximadas. ¿Exportar de todos modos?`))return;
  // Preparar TODOS los STL antes de descargar ninguno, evitando una cama incompleta.
  const exporter=new STLExporter(),files=[],before=[],after=[];
  try{
    for(const id of b.items){
      const m=meshes.find(v=>v.uuid===id);
      if(!m)throw Error('La cama contiene una referencia a una pieza inexistente: '+id);
      const placed=makePlacedMesh(m,b.placements[id]||{x:0,y:0,rot:0});
      const data=exporter.parse(placed,{binary:true});validateExportedSTL(data,placed);
      before.push({id,footprint:projectedBedFootprint(b,m)});
      after.push({id,footprint:projectedSTLFootprint(data)});
      files.push({data:convertSTLToSlicerZUp(data,{bedDepth:b.y}),name:`${b.name}_${String(files.length+1).padStart(2,'0')}_${m.name}`.replace(/[^a-zA-Z0-9_-]/g,'_')+'.stl'});
    }
    const audit=inspectBedExportClearance(before,after);
    if(audit.unverified>0&&!confirm(`${audit.unverified} distancias no se pudieron verificar por límite de geometría. ¿Descargar de todos modos?`))return;
    for(const f of files)download(f.data,f.name,'model/stl');
    status(`${files.length} STL preparados y descargados de ${b.name}. ${audit.compared} distancias verificadas. Comprueba las descargas múltiples en Safari.`);
  }catch(e){status('Exportación cancelada antes de descargar archivos: '+e.message)}
};
$('exportBedsReport').onclick=()=>{let lines=['BISTURÍ 3D — INFORME DE CAMAS','Proyecto: '+$('projectName').value,'Comprobación aproximada de cajas envolventes, no validación geométrica', ''];for(const b of beds){lines.push(`${b.name} (${b.x} x ${b.y} x ${b.z} mm)`);for(const id of b.items){const m=meshes.find(v=>v.uuid===id);if(!m)continue;const r=rectangleFor(b,m);lines.push(`  ${m.name}: ${r.w.toFixed(1)} x ${r.h.toFixed(1)} x ${r.z.toFixed(1)} mm | Posición en cama X:${r.x.toFixed(1)} Y:${r.y.toFixed(1)} | Giro:${Number(b.placements[id]?.rot||0)}°`)}const warnings=getProblems(b);lines.push(...(warnings.length?warnings.map(x=>'  ADVERTENCIA: '+x):['  Sin solapamientos aproximados detectados']),'')}lines.push('AVISO: Se exportan STL de mallas existentes. La posición y rotación en cama se incluyen en los STL exportados desde la sección de camas. STL no conserva información de impresora, materiales ni cama como proyecto de laminador.');download(lines.join('\n'),'informe_camas_bisturi3d.txt','text/plain;charset=utf-8')};

// Vista tridimensional de camas: geometrías existentes sin segmentación ni reparación de mallas.
function makePlacedMesh(m,place={x:0,y:0,rot:0}){
  m.updateWorldMatrix(true,false);
  const holder=new THREE.Group(),copy=m.clone(false);
  copy.matrixAutoUpdate=false;copy.matrix.copy(m.matrixWorld);copy.matrixWorldNeedsUpdate=true;
  holder.add(copy);holder.rotation.y=(Number(place.rot)||0)*Math.PI/180;
  holder.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(holder);
  holder.position.set((Number(place.x)||0)-box.min.x,-box.min.y,(Number(place.y)||0)-box.min.z);
  holder.updateMatrixWorld(true);return holder;
}
function getBedLayout(){
  const layout=new Map();if(!allBedsView){const b=getBed();if(b)layout.set(b.id,{x:0,z:0});return layout}
  let x=0;const gap=45;for(const b of beds){layout.set(b.id,{x,z:0});x+=b.x+gap}return layout;
}
function updateBedStage(){
  bedStage.clear();stagePick.clear();bedPlates.clear();bedOffsets=getBedLayout();if(!bedMode)return;
  for(const b of (allBedsView?beds:[getBed()])){
    if(!b)continue;const off=bedOffsets.get(b.id),group=new THREE.Group();group.position.set(off.x,0,off.z);bedStage.add(group);
    const plate=new THREE.Mesh(new THREE.BoxGeometry(b.x,1.2,b.y),new THREE.MeshStandardMaterial({color:b.id===activeBed?0x235473:0x183951,transparent:true,opacity:.86,roughness:.8}));plate.position.set(b.x/2,-1,b.y/2);group.add(plate);bedPlates.set(plate,b);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(b.x,1.2,b.y)),new THREE.LineBasicMaterial({color:b.id===activeBed?0x8cecff:0x63a5c7}));edges.position.copy(plate.position);group.add(edges);
    const lines=new THREE.Group(),mat=new THREE.LineBasicMaterial({color:0x36617c,transparent:true,opacity:.65});const step=Math.max(10,Math.round(Math.max(b.x,b.y)/12/10)*10);
    for(let x=0;x<=b.x;x+=step)lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,0,0),new THREE.Vector3(x,0,b.y)]),mat));
    for(let y=0;y<=b.y;y+=step)lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,y),new THREE.Vector3(b.x,0,y)]),mat));group.add(lines);
    const label=document.createElement('canvas');label.width=512;label.height=80;const ctx=label.getContext('2d');ctx.fillStyle='#d8f3ff';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.fillText(b.name.slice(0,28),256,48);const texture=new THREE.CanvasTexture(label);const textMesh=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(b.x,210),32),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));textMesh.rotation.x=-Math.PI/2;textMesh.position.set(b.x/2,.8,-24);group.add(textMesh);
    for(const id of b.items){const m=meshes.find(v=>v.uuid===id);if(!m)continue;const holder=makePlacedMesh(m,b.placements[id]);holder.traverse(obj=>{if(obj.isMesh){obj.material=obj.material?.clone?obj.material.clone():obj.material;stagePick.set(obj,{mesh:m,bed:b})}});group.add(holder)}
  }
  $('viewAllBeds').classList.toggle('active',allBedsView&&bedMode);$('showAllBedsPanel').classList.toggle('active',allBedsView&&bedMode);
}
// Encuadra el modelo en la vista (o la cama si se está viendo la cama).
function fit(){
  if(bedMode){fitBed();return;}
  root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root);
  if(box.isEmpty()){orbit.target.set(0,0,0);camera.position.set(160,130,180);camera.updateProjectionMatrix();orbit.update();return;}
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length()||1,d=size*1.15;
  orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(d*.55,d*.45,d*.7));camera.near=Math.max(d/1000,.01);camera.far=d*50;camera.updateProjectionMatrix();orbit.update();
}
function fitBed(){
  if(!bedMode)return;const visible=allBedsView?beds:[getBed()];if(!visible.length)return;
  const offsets=getBedLayout();let minX=Infinity,maxX=-Infinity,maxZ=0,maxH=0;
  for(const b of visible){const o=offsets.get(b.id);minX=Math.min(minX,o.x);maxX=Math.max(maxX,o.x+b.x);maxZ=Math.max(maxZ,b.y);maxH=Math.max(maxH,b.z)}
  const center=new THREE.Vector3((minX+maxX)/2,0,maxZ/2);const size=Math.max(maxX-minX,maxZ,maxH);const d=size*1.7;
  orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(d*.56,d*.85,d*.75));camera.near=.01;camera.far=d*35;camera.updateProjectionMatrix();orbit.update();
}
function enterBed(showAll=false){if(!modelLoaded)return status('Importa un modelo primero.');bedMode=true;allBedsView=showAll;root.visible=false;grid.visible=false;bedStage.visible=true;(transform.detach(),gizmoTarget=null);$('viewBed3D').classList.add('active');$('viewBed3D').textContent='Volver al modelo';updateBedStage();fitBed();status(showAll?'Vista general: todas las camas visibles. Selecciona o arrastra una pieza; verifica límites tras moverla.':'Cama 3D: arrastra una pieza para colocarla.')}
function leaveBed(){if(!bedMode)return;if(dragBed)restoreDragPlacement(beds,dragBed);bedMode=false;allBedsView=false;dragBed=null;orbit.enabled=true;bedStage.clear();bedStage.visible=false;root.visible=true;grid.visible=true;$('viewBed3D').classList.remove('active');$('viewBed3D').textContent='Ver cama 3D';$('viewAllBeds').classList.remove('active');$('showAllBedsPanel').classList.remove('active')}
function bedPointer(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const out=new THREE.Vector3();return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),out)?{x:out.x,y:out.z}:null}
function syncPlacementFields(){const b=getBed();const p=b&&selected&&b.placements[selected.uuid];for(const [key,id] of [['x','placeX'],['y','placeY'],['rot','placeRot']]){$(id).disabled=!p;if(p)$(id).value=Number(p[key]||0).toFixed(key==='rot'?0:1)}}
$('viewBed3D').onclick=()=>{if(dragBed)return status('Termina el movimiento antes de cambiar la vista.');if(bedMode){leaveBed();fit();status('Vista del modelo restaurada.')}else enterBed(false)};
function showAll(){if(dragBed){status('Termina de mover la pieza antes de cambiar la vista.');return;}const before=captureBedPlacementState(beds);const next=bedViewTransition({bedMode,allBedsView,activeBed},bedMode?'toggleAll':'showAll');enterBed(next.allBedsView);if(captureBedPlacementState(beds)!==before)throw Error('Cambio de vista modificó una colocación de cama.');}
$('viewAllBeds').onclick=showAll;$('showAllBedsPanel').onclick=()=>{showAll();if(bedMode)document.querySelector('.workspace').scrollIntoView({behavior:'smooth',block:'start'})};
$('centerBedView').onclick=()=>{if(!bedMode)enterBed();else fitBed()};
$('applyPlace').onclick=()=>{const b=getBed(),p=selected&&b.placements[selected.uuid];if(!p)return status('Selecciona una pieza que pertenezca a la cama activa.');const x=Number($('placeX').value),y=Number($('placeY').value),rot=Number($('placeRot').value);if(![x,y,rot].every(Number.isFinite))return status('Valores de posición o giro no válidos.');const result=placementFitsInBed(b,selected,{x,y,rot});if(!result.ok)return status('No se aplicó el cambio: '+result.reason);save();Object.assign(p,{x,y,rot});dirty=true;drawBed();updateBedStage();status(getProblems(b).length?'Posición actualizada: revisa las advertencias.':'Posición y giro actualizados.');};
$('exportPlacedBed').onclick=()=>{
  const b=getBed();if(!b.items.length)return status('La cama no tiene piezas.');
  const warnings=getProblems(b);
  if(warnings.length&&!confirm(`Esta cama presenta ${warnings.length} advertencia(s) aproximadas de dimensiones o solapamiento. El STL podría ser inadecuado para imprimir. ¿Exportar de todos modos?`))return;
  try{
    const group=new THREE.Group(),exporter=new STLExporter(),individual=[];
    const used=new Set();
    for(const id of b.items){
      if(used.has(id))throw Error('La misma pieza aparece más de una vez en la cama.');
      used.add(id);
      const m=meshes.find(v=>v.uuid===id);
      if(!m)throw Error('La cama contiene una pieza inexistente: '+id);
      const placed=makePlacedMesh(m,b.placements[id]);
      placed.updateMatrixWorld(true);
      const partSTL=exporter.parse(placed,{binary:true});
      validateExportedSTL(partSTL,placed);
      individual.push({id,stl:convertSTLToSlicerZUp(partSTL,{bedDepth:b.y})});
      group.add(placed);
    }
    group.updateMatrixWorld(true);
    const raw=exporter.parse(group,{binary:true});
    validateExportedSTL(raw,group);
    const combined=convertSTLToSlicerZUp(raw,{bedDepth:b.y});
    const audit=assertCombinedBedSTLIntegrity(individual,combined);
    download(combined,b.name.replace(/[^a-zA-Z0-9_-]/g,'_')+'_colocada.stl','model/stl');
    status(`Cama exportada: ${audit.pieces} piezas y ${audit.triangles} triángulos verificados. Revisa la colocación en tu laminador.`);
  }catch(e){status('No se pudo exportar la cama conjunta: '+e.message)}
};

// Las mallas y el historial Deshacer/Rehacer solo existen durante esta sesión.
// Las piezas e informes se conservan únicamente si la persona los descarga.

refreshBeds();

$('mobileShowCutResult').onclick=()=>{if($('mobileShowCutResult').disabled)return;$('explodeBtn').click();};
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;if(w&&h){camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}}new ResizeObserver(resize).observe(viewport);resize();renderer.setAnimationLoop(()=>{orbit.update();if(gizmoTarget&&!transform.dragging){if(!meshes.includes(gizmoTarget)||!gizmoTarget.parent)(transform.detach(),gizmoTarget=null);else syncGizmoPivot();}renderer.render(scene,camera)});

// Interfaz de corte móvil: usa el mismo motor de corte del editor de escritorio.
(function setupMobileCutUI(){
  const byId=id=>document.getElementById(id);
  const sheet=byId('mobileCutSheet'),backdrop=byId('mobileCutBackdrop');
  if(!sheet||!backdrop)return;
  const open=()=>{
    document.dispatchEvent(new CustomEvent('bisturi:close-mobile-panels',{detail:{except:'cut'}}));
    byId('mobileCutOrientation').value=byId('cutOrientation').value;
    byId('mobileCutPercent').value=byId('cutPercent').value;
    byId('mobileCutValue').textContent=byId('cutPercent').value+'%';
    byId('mobileCutAngleX').value=byId('cutAngleX').value;
    byId('mobileCutAngleZ').value=byId('cutAngleZ').value;
    byId('mobileCutAngles').hidden=byId('mobileCutOrientation').value!=='inclinado';
    sheet.hidden=false;backdrop.hidden=false;byId('mobileCut').setAttribute('aria-expanded','true');document.body.classList.add('mobile-sheet-open');
    refreshCutGuide();
    byId('mobileCloseCut').focus();
  };
  const close=()=>{sheet.hidden=true;backdrop.hidden=true;byId('mobileCut').setAttribute('aria-expanded','false');document.body.classList.toggle('mobile-sheet-open',!byId('mobileSurfaceSheet').hidden);byId('mobileCut').focus()};
  byId('mobileCut').setAttribute('aria-expanded','false');
  document.addEventListener('bisturi:close-mobile-panels',e=>{if(e.detail?.except!=='cut'&&!sheet.hidden)close()});
  byId('mobileCut').addEventListener('click',open);
  [byId('mobileCloseCut'),byId('mobileCancelCut'),backdrop].forEach(el=>el.addEventListener('click',close));
  byId('mobileCutOrientation').addEventListener('change',()=>{byId('mobileCutAngles').hidden=byId('mobileCutOrientation').value!=='inclinado'});
  const syncMobilePlane=()=>{byId('cutOrientation').value=byId('mobileCutOrientation').value;byId('cutAngles').hidden=byId('cutOrientation').value!=='inclinado';byId('cutPercent').value=byId('mobileCutPercent').value;byId('cutAngleX').value=byId('mobileCutAngleX').value;byId('cutAngleZ').value=byId('mobileCutAngleZ').value;refreshCutGuide()};
  ['mobileCutOrientation','mobileCutPercent','mobileCutAngleX','mobileCutAngleZ'].forEach(id=>byId(id).addEventListener('input',syncMobilePlane));
  byId('mobilePreviewCut').addEventListener('click',()=>{syncMobilePlane();setGuide(!showCutGuide)});
  byId('mobileCutPercent').addEventListener('input',()=>{byId('mobileCutValue').textContent=byId('mobileCutPercent').value+'%'});
  byId('mobileConfirmCut').addEventListener('click',()=>{
    byId('cutOrientation').value=byId('mobileCutOrientation').value;
    byId('cutOrientation').dispatchEvent(new Event('change',{bubbles:true}));
    byId('cutPercent').value=byId('mobileCutPercent').value;
    byId('cutAngleX').value=byId('mobileCutAngleX').value;
    byId('cutAngleZ').value=byId('mobileCutAngleZ').value;
    close();byId('cutPlaneBtn').click();
  });
  byId('mobileSelect').addEventListener('click',()=>byId('selectTool').click());
  byId('mobileMove').addEventListener('click',()=>byId('moveTool').click());
  byId('mobilePieces').addEventListener('click',()=>{
    byId('pieces').scrollIntoView({behavior:'smooth',block:'center'});
  });
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!sheet.hidden){close();e.preventDefault()}else if(!$('mobileSurfaceSheet').hidden){$('mobileCloseSurface').click();e.preventDefault()}});
})();


// Corte curvo: confirmar únicamente resultados calculados para la misma malla.
const curvedPanel=setupCurvedPanel(THREE,{
 status,download,
 selection:mesh=>surfaceSelections.get(mesh.uuid),
 capture:()=>{
  cancelSurfaceWork();
  if(bedMode||explode||xray)throw Error('Regresa a la vista ensamblada, sin rayos X, para calcular el corte.');
  if(!selected||!meshes.includes(selected))throw Error('Selecciona la pieza que deseas cortar.');
  if(!selected.visible)throw Error('Muestra la pieza antes de cortarla.');
  if(surfacePreview)clearSurfacePreview();(transform.detach(),gizmoTarget=null);
  selected.updateWorldMatrix(true,false);
  return {source:selected,geometry:selected.geometry,parent:selected.parent,matrix:selected.matrixWorld.elements.slice(),revision:undo.length};
 },
 isCurrent:token=>{
  token.source.updateWorldMatrix(true,false);
  return meshes.includes(token.source)&&token.source.geometry===token.geometry&&token.source.parent===token.parent&&token.matrix.every((x,i)=>Math.abs(x-token.source.matrixWorld.elements[i])<1e-12)&&!bedMode&&!explode&&!xray;
 },
 commit:(token,geometries,result)=>{
  const source=token.source;save();(transform.detach(),gizmoTarget=null);clearSurfaceOverlays();
  const pieces=geometries.map((geometry,i)=>{
   const part=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:i?0xefb272:0x5ba8ec,roughness:.65,side:THREE.DoubleSide}));
   part.name=source.name+(result.report?.method==='exacto-v2f'?(i?' — resto':' — región'):' — curva '+(i?'B':'A'));part.position.copy(source.position);part.quaternion.copy(source.quaternion);part.scale.copy(source.scale);part.visible=source.visible;
   part.userData.bisturiCurved={surface:result.surface,report:result.report,side:i};
   source.parent.add(part);basePositions.set(part.uuid,part.position.clone());originalMaterials.set(part.uuid,part.material);return part;
  });
  meshes.splice(meshes.indexOf(source),1,...pieces);source.removeFromParent();
  for(const bed of beds){bed.items=bed.items.filter(id=>id!==source.uuid);delete bed.placements[source.uuid];}
  selected=pieces[0];dirty=true;cutPair=null;syncResultButtons();refreshBeds();updateList();updateStats();
 }
});

// Herramientas exactas del núcleo v2f: sustituyen la pieza seleccionada por las piezas calculadas.
const nucleoPanel=setupNucleoPanel(THREE,{
 status,
 bed:()=>getBed(),
 nozzle:()=>Number($('nozzle').value)||0.4,
 capture:()=>{
  cancelSurfaceWork();
  if(bedMode||explode||xray)throw Error('Regresa a la vista ensamblada, sin rayos X ni explosión.');
  if(!selected||!meshes.includes(selected))throw Error('Selecciona primero una pieza.');
  if(!selected.visible)throw Error('Muestra la pieza antes de modificarla.');
  if(selected.userData?.locked)throw Error('Desbloquea la pieza para modificarla.');
  if(surfacePreview)clearSurfacePreview();(transform.detach(),gizmoTarget=null);selected.updateWorldMatrix(true,false);
  return {source:selected,geometry:selected.geometry,parent:selected.parent,matrix:selected.matrixWorld.elements.slice()};
 },
 isCurrent:token=>{token.source.updateWorldMatrix(true,false);return meshes.includes(token.source)&&token.source.geometry===token.geometry&&token.source.parent===token.parent&&token.matrix.every((x,i)=>Math.abs(x-token.source.matrixWorld.elements[i])<1e-9)&&!bedMode&&!explode&&!xray;},
 commit:(token,pieces,op)=>{
  const source=token.source;save();(transform.detach(),gizmoTarget=null);clearSurfaceOverlays();
  const base=Array.isArray(source.material)?source.material[0]:source.material,palette=[0x5ba8ec,0xefb272,0x6fcf97,0xc792ea,0xf2c94c,0xeb5757,0x56ccf2,0xbb6bd9];
  const label={partes:'parte',reparar:'cerrada',cama:'cama',color:'color'}[op]||'pieza';
  const created=pieces.map((p,i)=>{
   const color=p.color??(pieces.length===1?(base?.color?.getHex?.()??palette[0]):palette[i%palette.length]);
   const part=new THREE.Mesh(p.geometry,new THREE.MeshStandardMaterial({color,roughness:.65,side:THREE.DoubleSide}));
   part.name=pieces.length===1?source.name:`${source.name} — ${label} ${i+1}`;part.position.copy(source.position);part.quaternion.copy(source.quaternion);part.scale.copy(source.scale);part.visible=source.visible;
   source.parent.add(part);basePositions.set(part.uuid,part.position.clone());originalMaterials.set(part.uuid,part.material);return part;
  });
  meshes.splice(meshes.indexOf(source),1,...created);source.removeFromParent();
  for(const bed of beds){bed.items=bed.items.filter(id=>id!==source.uuid);delete bed.placements[source.uuid];}
  selected=created[0];dirty=true;cutPair=null;syncResultButtons();refreshBeds();updateList();updateStats();
 }
});




// API para la interfaz (layout.js): vistas, herramientas de transformación y unir piezas.
function setView(dir){
 if(bedMode)leaveBed();
 root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root);
 const c=box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3()),d=(box.isEmpty()?200:box.getSize(new THREE.Vector3()).length())*1.25;
 const dirs={frontal:[0,0,1],trasera:[0,0,-1],izquierda:[-1,0,0],derecha:[1,0,0],superior:[0,1,0],inferior:[0,-1,0],libre:[.55,.45,.7]};
 const v=new THREE.Vector3(...(dirs[dir]||dirs.libre)).normalize();
 camera.up.set(0,1,0);if(dir==='superior')camera.up.set(0,0,-1);if(dir==='inferior')camera.up.set(0,0,1);
 orbit.target.copy(c);camera.position.copy(c).addScaledVector(v,d);camera.lookAt(c);camera.updateProjectionMatrix();orbit.update();
}
function mergeVisiblePieces(){
 const list=meshes.filter(m=>m.visible);
 if(list.length<2){status('Para unir hacen falta al menos dos piezas visibles. Oculta con el ojo las que no quieras unir.');return;}
 if(bedMode||explode)throw Error('Regresa a la vista ensamblada antes de unir piezas.');
 save();(transform.detach(),gizmoTarget=null);clearSurfaceOverlays();root.updateMatrixWorld(true);
 const base=list[0],inv=base.matrixWorld.clone().invert(),parts=[],materials=[];let total=0;
 const v=new THREE.Vector3();
 list.forEach((m,k)=>{const g=m.geometry,p=g.getAttribute('position'),idx=g.index,n=idx?idx.count:p.count,arr=new Float32Array(n*3),mat=m.matrixWorld.clone().premultiply(inv);
  for(let i=0;i<n;i++){v.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(mat);arr[3*i]=v.x;arr[3*i+1]=v.y;arr[3*i+2]=v.z;}
  parts.push(arr);total+=n;const mm=Array.isArray(m.material)?m.material[0]:m.material;materials.push(mm);});
 const pos=new Float32Array(total*3);let o=0;const geo=new THREE.BufferGeometry();
 parts.forEach((a,k)=>{pos.set(a,o*3);geo.addGroup(o,a.length/3,k);o+=a.length/3;});
 geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.computeVertexNormals();geo.computeBoundingBox();
 const merged=new THREE.Mesh(geo,materials);merged.name=base.name+' (unida)';merged.position.copy(base.position);merged.quaternion.copy(base.quaternion);merged.scale.copy(base.scale);
 base.parent.add(merged);basePositions.set(merged.uuid,merged.position.clone());originalMaterials.set(merged.uuid,merged.material);
 const first=meshes.indexOf(base);meshes.splice(first,1,merged);
 for(const m of list.slice(1)){meshes.splice(meshes.indexOf(m),1);m.removeFromParent();}
 base.removeFromParent();
 const gone=new Set(list.map(m=>m.uuid));for(const bed of beds){bed.items=bed.items.filter(id=>!gone.has(id));for(const id of gone)delete bed.placements[id];}
 selected=merged;dirty=true;cutPair=null;syncResultButtons();refreshBeds();updateList();updateStats();
 status(`${list.length} piezas unidas en una sola malla (sin operación booleana: las zonas que se solapan quedan superpuestas). Usa Atrás para deshacer.`);
}
// ---- Herramientas Bisturí (planos dibujados y corte libre con profundidad) ----
// Corta con varios planos dibujados. Cada plano corta todas las piezas indicadas que atraviesa;
// las mitades nuevas siguen recibiendo los planos siguientes. Un solo «Atrás» lo deshace todo.
async function cutWithPlanes(planes,targets){
  if(bedMode||explode||xray)throw Error('Vuelve a la vista ensamblada del modelo y desactiva Rayos X.');
  let piezas=targets.filter(m=>meshes.includes(m)),hechos=0,saved=false;const avisos=[];
  const proyeccion=(m,n)=>{m.updateWorldMatrix(true,false);const g=m.geometry.attributes.position,e=m.matrixWorld.elements;let mn=Infinity,mx=-Infinity;for(let i=0;i<g.count;i++){const x=g.getX(i),y=g.getY(i),z=g.getZ(i),d=n.x*(e[0]*x+e[4]*y+e[8]*z+e[12])+n.y*(e[1]*x+e[5]*y+e[9]*z+e[13])+n.z*(e[2]*x+e[6]*y+e[10]*z+e[14]);if(d<mn)mn=d;if(d>mx)mx=d;}return [mn,mx]};
  for(let k=0;k<planes.length;k++){
    const {normal,point,cuadrado}=planes[k],n=normal.clone().normalize(),d0=n.dot(point),siguientes=[];
    for(const m of piezas){
      const [mn,mx]=proyeccion(m,n),f=(d0-mn)/(mx-mn);
      if(!(mx-mn>1e-9)||f<=0.001||f>=0.999){siguientes.push(m);continue}
      m.updateWorldMatrix(true,false);
      // Solo se corta la pieza si el cuadrado dibujado toca alguna de sus secciones.
      if(cuadrado&&!cruzaCuadrado(soupInFrame(m,m.matrixWorld),n.toArray(),d0,cuadrado)){siguientes.push(m);continue}
      status(`Cortando con el plano ${k+1} de ${planes.length}…`);await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,20)));
      let out;
      try{out=cutMeshWithPlane(m,n,f,{strict:false,beforeChange:()=>{if(!saved){save();saved=true}}})}
      catch(e){siguientes.push(m);avisos.push(k+1);console.warn(e);continue}
      if(out.result.warning)avisos.push(k+1);
      if(!cuadrado){siguientes.push(out.positive,out.negative);hechos++;continue}
      // Se vuelven a pegar las secciones que quedan fuera del cuadrado.
      const M=out.positive.matrixWorld.clone(),lado=x=>({sopa:soupInFrame(x,M),col:faceMaterials(x.geometry)});
      const r=pegarFuera(lado(out.positive),lado(out.negative),n.toArray(),out.result.planeOffset??d0,cuadrado);
      if(!r.pegadas){siguientes.push(out.positive,out.negative);hechos++;continue}
      const parent=out.positive.parent,inv=M.clone().invert(),mats=out.positive.material;
      const quitar=[out.positive,out.negative];
      if(r.piezas.length<2){
        // El cuadrado no separa nada: se deja la pieza como estaba.
        parent.add(m);meshes.splice(meshes.indexOf(out.positive),1,m);meshes.splice(meshes.indexOf(out.negative),1);
        for(const q of quitar){q.removeFromParent();q.geometry.dispose()}
        siguientes.push(m);continue;
      }
      const nuevas=r.piezas.map(pz=>{const obj=new THREE.Mesh(geometryFromSoup(pz.sopa,pz.col,inv),mats.map(x=>x.clone()));obj.name=m.name;
        obj.position.copy(out.positive.position);obj.quaternion.copy(out.positive.quaternion);obj.scale.copy(out.positive.scale);
        parent.add(obj);basePositions.set(obj.uuid,obj.position.clone());originalMaterials.set(obj.uuid,obj.material);return obj});
      meshes.splice(meshes.indexOf(out.positive),1,...nuevas);meshes.splice(meshes.indexOf(out.negative),1);
      for(const q of quitar){q.removeFromParent();q.geometry.dispose()}
      siguientes.push(...nuevas);hechos++;
    }
    piezas=siguientes;
  }
  if(hechos){
    // Nombres cortos: «Hongo · pieza 1», «Hongo · pieza 2»…
    const base=targets.length===1?targets[0].name:'Pieza';let i=0;
    for(const m of piezas)if(!targets.includes(m))m.name=`${base} · pieza ${++i}`;
    selected=null;cutPair=[];syncResultButtons();dirty=true;refreshBeds();updateList();updateStats();applyVisualState?.();}
  return {hechos,piezas:piezas.length,avisos:[...new Set(avisos)]};
}
// Corte libre: «cutter» es un sólido cerrado en coordenadas mundiales. La pieza es la parte del
// modelo dentro del sólido; el resto queda con el hueco. La pieza se aparta hacia la cámara.
async function cutFreeShape(target,cortadores,pull){
  if(bedMode||explode||xray)throw Error('Vuelve a la vista ensamblada del modelo y desactiva Rayos X.');
  const csg=await loadCSG();
  target.updateWorldMatrix(true,false);
  const g=target.geometry.clone();for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);
  g.applyMatrix4(target.matrixWorld);g.computeVertexNormals();
  if(!g.groups.length)g.addGroup(0,g.index?g.index.count:g.attributes.position.count,0);
  const mats=(Array.isArray(target.material)?target.material:[target.material]).map(x=>x.clone());
  const capMat=new THREE.MeshStandardMaterial({color:0xd5c2a5,roughness:.8,side:THREE.DoubleSide});
  const a=new csg.Brush(g,mats),bH=new csg.Brush(cortadores.hueco,capMat),bP=new csg.Brush(cortadores.pieza,capMat);a.updateMatrixWorld(true);bH.updateMatrixWorld(true);bP.updateMatrixWorld(true);
  const ev=new csg.Evaluator();ev.attributes=['position','normal'];ev.useGroups=true;
  // La pieza sale del cortador encogido (holgura); el hueco, del cortador exacto.
  const dentro=ev.evaluate(a,bP,csg.INTERSECTION),fuera=ev.evaluate(a,bH,csg.SUBTRACTION);
  const vacio=x=>!x.geometry.attributes.position||x.geometry.attributes.position.count<9;
  if(vacio(dentro))throw Error('El trazo no corta material de la pieza. Dibuja sobre la figura.');
  if(vacio(fuera))throw Error('El trazo abarca toda la pieza; dibuja una zona más pequeña.');
  save();(transform.detach(),gizmoTarget=null);
  const inv=target.matrixWorld.clone().invert(),sourceBed=beds.find(bd=>bd.items.includes(target.uuid));
  const make=(res,nombre)=>{const geo=res.geometry;geo.applyMatrix4(inv);geo.computeVertexNormals();geo.computeBoundingBox();
    const obj=new THREE.Mesh(geo,Array.isArray(res.material)?res.material:[res.material]);obj.name=nombre;
    obj.position.copy(target.position);obj.quaternion.copy(target.quaternion);obj.scale.copy(target.scale);
    target.parent.add(obj);basePositions.set(obj.uuid,obj.position.clone());originalMaterials.set(obj.uuid,obj.material);return obj};
  // Repaso final con la reparación automática (cierra las grietas que deja la operación booleana).
  for(const res of [dentro,fuera]){let geo=res.geometry;for(let k=0;k<3;k++){const g2=repararUnionesT(THREE,geo);geo.dispose();geo=g2;}res.geometry=geo;}
  for(const res of [dentro,fuera]){try{const r=await repararMalla(THREE,res.geometry);const q0=analyzeMeshGeometry(res.geometry,{tolerance:1e-6,maxTriangles:4000000,degenerateEdges:true}),q1=analyzeMeshGeometry(r.geometry,{tolerance:1e-6,maxTriangles:4000000,degenerateEdges:true});const mal=q=>q.boundary+q.nonManifold+q.winding;if(mal(q1)<mal(q0)){res.geometry.dispose();res.geometry=r.geometry;}else r.geometry.dispose();}catch(e){console.warn(e)}}
  const pieza=make(dentro,target.name+' (pieza del bisturí)'),resto=make(fuera,target.name);
  target.removeFromParent();meshes.splice(meshes.indexOf(target),1,resto,pieza);
  if(sourceBed){sourceBed.items=sourceBed.items.filter(id=>id!==target.uuid);delete sourceBed.placements[target.uuid]}
  if(pull)separateForReview(pieza,pull.dir,pull.distance);
  selected=pieza;cutPair=[];syncResultButtons();dirty=true;refreshBeds();updateList();updateStats();
  const q=analyzeMeshGeometry(pieza.geometry,{tolerance:1e-6,maxTriangles:4000000,degenerateEdges:true});
  return {pieza,resto,cerrada:q.level!=='unknown'&&q.boundary===0};
}

// ---- Bisturí libre automático: detectar la parte rodeada (cuerpo aparte, color o surco) ----
function faceColorKeys(geometry){
  const mats=faceMaterials(geometry),c=geometry.getAttribute('color'),idx=geometry.getIndex(),nf=mats.length,keys=new Int32Array(nf);
  for(let f=0;f<nf;f++){let k=0;if(c){let r=0,g=0,b=0;for(let j=0;j<3;j++){const v=idx?idx.getX(3*f+j):3*f+j;r+=c.getX(v);g+=c.getY(v);b+=c.getZ(v);}k=(Math.min(15,Math.round(r/3*15))<<8)|(Math.min(15,Math.round(g/3*15))<<4)|Math.min(15,Math.round(b/3*15));}keys[f]=mats[f]*4096+k;}
  return keys;
}
function detectFreeZone(target,poligono,golpes){
  target.updateWorldMatrix(true,false);camera.updateMatrixWorld();
  const sopa=soupInFrame(target,target.matrixWorld),r=renderer.domElement.getBoundingClientRect();
  const e=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
  const proyectar=(x,y,z)=>{const w=e[3]*x+e[7]*y+e[11]*z+e[15];return [((e[0]*x+e[4]*y+e[8]*z+e[12])/w+1)/2*r.width,(1-(e[1]*x+e[5]*y+e[9]*z+e[13])/w)/2*r.height]};
  const det=detectarZona({sopa,col:faceColorKeys(target.geometry),proyectar,poligono,...golpes});
  if(!det)return null;
  // Vista previa: las caras detectadas, en coordenadas del mundo.
  const T=det.malla.tri,P=det.malla.pos,prev=[];
  for(let f=0;f<T.length/3;f++)if(det.mascara[f])for(let k=0;k<3;k++){const v=T[3*f+k];prev.push(P[3*v],P[3*v+1],P[3*v+2]);}
  det.vistaPrevia=Float32Array.from(prev);det.target=target;
  return det;
}
async function applyFreeZone(det,pull){
  const target=det.target;
  if(!meshes.includes(target))throw Error('La pieza cambió; vuelve a dibujar el contorno.');
  if(bedMode||explode||xray)throw Error('Vuelve a la vista ensamblada del modelo y desactiva Rayos X.');
  const mats=faceMaterials(target.geometry),inv=target.matrixWorld.clone().invert();
  const T=det.malla.tri,P=det.malla.pos,nf=T.length/3,matW=new Int16Array(nf);for(let f=0;f<nf;f++)matW[f]=mats[det.origen[f]]??0;
  const aSopa=(lista)=>{let n=0;for(const x of lista)n+=x.tri.length/3;const sopa=new Float32Array(n*9),col=new Int16Array(n);let k=0;
    for(const x of lista)for(let f=0;f<x.tri.length/3;f++){for(let j=0;j<3;j++){const v=x.tri[3*f+j];sopa[9*k+3*j]=x.pos[3*v];sopa[9*k+3*j+1]=x.pos[3*v+1];sopa[9*k+3*j+2]=x.pos[3*v+2];}col[k++]=x.col?x.col[f]:0;}
    return {sopa,col}};
  let sel,resto;
  if(det.modo==='cuerpo'){
    // Pieza suelta: se separa entera, sin cortar nada.
    const tS=[],cS=[],tR=[],cR=[];for(let f=0;f<nf;f++){(det.mascara[f]?tS:tR).push(T[3*f],T[3*f+1],T[3*f+2]);(det.mascara[f]?cS:cR).push(matW[f]);}
    sel=aSopa([{pos:P,tri:tS,col:cS}]);resto=aSopa([{pos:P,tri:tR,col:cR}]);
  }else{
    const mo=orientarNucleo(det.malla).malla;
    const r=cortarPorSeleccion(mo,det.mascara,{color:matW,autocorregir:det.modo==='forma'});
    const de=lado=>r.piezas.filter(p=>p.lado===lado).map(p=>({pos:p.malla.pos,tri:p.malla.tri,col:p.color}));
    sel=aSopa(de('seleccion'));resto=aSopa(de('resto'));
  }
  if(!sel.col.length||!resto.col.length)throw Error('No quedó nada que separar.');
  save();(transform.detach(),gizmoTarget=null);
  const sourceBed=beds.find(bd=>bd.items.includes(target.uuid)),srcMats=Array.isArray(target.material)?target.material:[target.material];
  const make=(x,nombre)=>{const obj=new THREE.Mesh(geometryFromSoup(x.sopa,x.col,inv),srcMats.map(q=>q.clone()));obj.name=nombre;obj.position.copy(target.position);obj.quaternion.copy(target.quaternion);obj.scale.copy(target.scale);target.parent.add(obj);basePositions.set(obj.uuid,obj.position.clone());originalMaterials.set(obj.uuid,obj.material);return obj};
  const pieza=make(sel,target.name+' (pieza del bisturí)'),rest=make(resto,target.name);
  target.removeFromParent();meshes.splice(meshes.indexOf(target),1,rest,pieza);
  if(sourceBed){sourceBed.items=sourceBed.items.filter(id=>id!==target.uuid);delete sourceBed.placements[target.uuid]}
  pieza.geometry.computeBoundingBox();const tam=pieza.geometry.boundingBox.getSize(new THREE.Vector3()).length()*Math.max(pieza.scale.x,1e-6);
  if(pull)separateForReview(pieza,pull.dir,tam*0.5+5);
  selected=pieza;cutPair=[];syncResultButtons();dirty=true;refreshBeds();updateList();updateStats();
  return {pieza};
}
setupBisturi({THREE,scene,camera,renderer,orbit,root,status,detectFreeZone,applyFreeZone,
  get meshes(){return meshes},get selected(){return selected},
  busy:()=>bedMode||explode||xray,cutWithPlanes,cutFreeShape,
  raycastTargets:()=>meshes.filter(m=>m.visible)});

window.bisturi={
 get meshes(){return meshes},get selected(){return selected},get tool(){return tool},get modelLoaded(){return modelLoaded},
 select,setTool,fit,setView,status,
 setTransformMode(mode){transform.setMode(mode);if(tool!=='Mover')setTool('Mover');else if(selected&&!explode&&!bedMode)attachGizmo(selected);},
 get transformMode(){return transform.mode},
 mergeVisiblePieces(){try{mergeVisiblePieces()}catch(e){status(e.message)}},
 modelSize(){root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root);return b.isEmpty()?null:b.getSize(new THREE.Vector3());},
 cameraQuaternion(){return camera.quaternion},
 proyectar(x,y,z){root.updateMatrixWorld(true);const v=new THREE.Vector3(x,y,z).applyMatrix4(root.matrixWorld).project(camera),r=renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height}},
 nozzle(){return $('nozzle').value}
};
window.dispatchEvent(new Event('bisturi-listo'));

window.__bisturiListo=true;

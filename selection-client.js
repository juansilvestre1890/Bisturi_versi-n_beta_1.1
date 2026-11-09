// Puente del visor al Worker; descarta respuestas tardías al cambiar el proyecto.
import {MAX_SELECTION_FACES} from './selection-engine.js';
const nextFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
async function copyAttribute(attr,size,valid){
  if(!attr)return null;
  const out=new Float32Array(attr.count*size),get=['getX','getY','getZ','getW'];
  for(let start=0;start<attr.count;start+=60000){
    if(!valid())throw Error('Selección cancelada.');
    for(let i=start;i<Math.min(attr.count,start+60000);i++)for(let k=0;k<size;k++)out[size*i+k]=attr[get[k]](i);
    await nextFrame();
  }
  return out;
}
async function texturePixels(texture){
  if(texture.isCompressedTexture||texture.isVideoTexture||texture.mapping!==300)throw Error('Este tipo de textura no admite selección por color. Usa el pincel.');
  let image=texture.image;
  if(image?.decode&&!image.complete)await image.decode();
  const width=image?.naturalWidth||image?.width,height=image?.naturalHeight||image?.height;
  if(!width||!height)throw Error('La textura aún no está disponible. Espera a que termine de cargar o usa el pincel.');
  if(width*height>16777216)throw Error('La textura supera 4096 × 4096 píxeles equivalentes. Usa el pincel o reduce la textura.');
  if(image.data){
    if(!(image.data instanceof Uint8Array||image.data instanceof Uint8ClampedArray)||image.data.length!==width*height*4)throw Error('La selección por color requiere una textura RGB con alfa de 8 bits.');
    return {pixels:new Uint8Array(image.data),width,height};
  }
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):document.createElement('canvas');canvas.width=width;canvas.height=height;
  try{const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error();ctx.drawImage(image,0,0);return {pixels:ctx.getImageData(0,0,width,height).data,width,height};}
  catch(_){throw Error('No se puede leer la textura. Carga un FBX o GLB con la imagen incrustada, o usa el pincel.');}
  finally{canvas.width=canvas.height=1;}
}
export async function captureSelectionAppearance(mesh,valid=()=>true){
  const geometry=mesh.geometry,mats=Array.isArray(mesh.material)?mesh.material:[mesh.material],textures=[],textureIds=new Map(),uvs={},materials=[];
  let pixels=0;
  for(const mat of mats){
    if(!valid())throw Error('Selección cancelada.');
    if(mat?.isShaderMaterial)throw Error('Este material personalizado requiere selección con pincel.');
    let texture=null;
    if(mat?.map){
      if(!textureIds.has(mat.map)){
        const data=await texturePixels(mat.map);pixels+=data.width*data.height;
        if(pixels>33554432)throw Error('Las texturas de esta pieza exceden el presupuesto de selección. Usa el pincel.');
        if(mat.map.matrixAutoUpdate)mat.map.updateMatrix();
        const channel=mat.map.channel||0;
        if(!uvs[channel])uvs[channel]=await copyAttribute(geometry.getAttribute(channel?'uv'+channel:'uv'),2,valid);
        if(!uvs[channel])throw Error('Faltan las coordenadas UV de la textura. Usa el pincel.');
        textureIds.set(mat.map,textures.length);
        textures.push({...data,channel,matrix:mat.map.matrix.toArray(),wrapS:mat.map.wrapS,wrapT:mat.map.wrapT,flipY:mat.map.flipY,srgb:mat.map.colorSpace==='srgb'});
      }
      texture=textureIds.get(mat.map);
    }
    materials.push({color:mat?.color?.toArray()||[1,1,1],vertexColors:!!mat?.vertexColors,texture});
  }
  return {index:geometry.index?new Uint32Array(geometry.index.array):null,vertexColors:mats.some(m=>m?.vertexColors)?await copyAttribute(geometry.getAttribute('color'),3,valid):null,uvs,textures,materials,groups:geometry.groups.map(g=>({...g}))};
}
export function createSurfaceSelector(THREE,api){
  let worker=null,target=null,queue=[],pending=new Map(),serial=0,generation=0,pumping=false,ready=false,colored=false,colorSource='';
  const busy=()=>pumping||queue.length>0;
  function cancel(){
    generation++;worker?.terminate();worker=null;target=null;ready=colored=false;queue=[];pumping=false;
    for(const p of pending.values())p.reject(Error('Selección cancelada.'));pending.clear();api.busy(false);
  }
  function rpc(type,data={},transfer=[]){
    if(!worker){
      worker=new Worker(new URL('./selection-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;if(data.type==='progress'){api.status(data.text);return;}pending.delete(data.id);if(data.type==='error')p.reject(Error(data.message));else p.resolve(data);};
      worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message||'No pudo iniciarse la selección.'));pending.clear();worker?.terminate();worker=null;ready=colored=false;};
    }
    const id=++serial;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});try{worker.postMessage({id,type,...data},transfer);}catch(e){pending.delete(id);reject(e);}});
  }
  function current(job){
    const m=job.mesh;m.updateWorldMatrix(true,false);
    return api.isCurrent(m,job.geometry)&&job.position===m.geometry.getAttribute('position')&&job.version===job.position.version&&job.index===m.geometry.index&&job.indexVersion===(m.geometry.index?.version||0)&&job.options.matrix.every((x,i)=>Math.abs(x-m.matrixWorld.elements[i])<1e-12);
  }
  async function pump(){
    if(pumping)return;pumping=true;api.busy(true);const epoch=generation;
    const valid=()=>generation===epoch;
    try{
      while(queue.length&&valid()){
        const job=queue.shift();if(!current(job))throw Error('La pieza cambió. Vuelve a marcar la región.');
        if(!ready){
          api.status('Preparando selección de la malla…');
          const positions=await copyAttribute(job.position,3,valid),index=job.index?new Uint32Array(job.index.array):null;
          if(!valid())return;
          const stats=await rpc('init',{positions,index},[positions.buffer,...(index?[index.buffer]:[])]);ready=true;
          if(stats.stats.nonManifold)api.status('La selección se detendrá en aristas que unen más de dos caras.');
        }
        if(job.options.kind!=='brush'&&!colored){
          api.status('Leyendo el color y las texturas de la pieza…');
          const appearance=await captureSelectionAppearance(job.mesh,valid);if(!valid())return;
          const arrays=[appearance.index,appearance.vertexColors,...Object.values(appearance.uvs),...appearance.textures.map(t=>t.pixels)].filter(Boolean);
          const reply=await rpc('colors',{appearance},arrays.map(a=>a.buffer));colored=true;colorSource=reply.source;
        }
        const result=await rpc('select',{options:job.options});if(!valid())return;
        if(!current(job))throw Error('La pieza cambió. Vuelve a marcar la región.');
        api.apply(job.mesh,result.faces,job.erase,job.stroke,job.options.seed);
        api.status(`${job.options.kind==='brush'?'Pincel':job.options.kind==='wand'?'Varita':'Magnético'}: ${result.faces.length.toLocaleString('es')} triángulos ${job.erase?'retirados de':'alcanzados por'} la selección.${job.options.kind==='brush'?'':` Color leído de ${colorSource}.`}`);
      }
    }catch(e){if(valid()){api.status('Selección: '+e.message);cancel();}}
    finally{if(valid()){pumping=false;api.busy(false);}}
  }
  function paint(hit,settings,stroke){
    const mesh=hit.object,geometry=mesh.geometry,position=geometry.getAttribute('position'),count=(geometry.index?.count||position.count)/3;
    if(!Number.isInteger(hit.faceIndex))return;
    if(count>MAX_SELECTION_FACES)return api.status('La selección admite hasta 2 000 000 de triángulos por malla.');
    if(mesh.isSkinnedMesh||geometry.morphAttributes?.position?.length)return api.status('Aplica la deformación de la malla antes de seleccionar.');
    if(mesh.userData?.locked)return api.status('Desbloquea la pieza antes de seleccionar.');
    mesh.updateWorldMatrix(true,false);
    if(Math.abs(mesh.matrixWorld.determinant())<1e-20)return api.status('La pieza tiene una escala nula.');
    if(target&&(target.mesh!==mesh||target.geometry!==geometry||target.version!==position.version||target.indexVersion!==(geometry.index?.version||0)))cancel();
    target={mesh,geometry,version:position.version,indexVersion:geometry.index?.version||0};
    const ids=[0,1,2].map(k=>geometry.index?geometry.index.getX(3*hit.faceIndex+k):3*hit.faceIndex+k),pts=ids.map(id=>new THREE.Vector3().fromBufferAttribute(position,id)),local=mesh.worldToLocal(hit.point.clone());
    const weights=new THREE.Vector3();new THREE.Triangle(...pts).getBarycoord(local,weights);
    const options={...settings,seed:hit.faceIndex,weights:weights.toArray(),center:hit.point.toArray(),matrix:mesh.matrixWorld.toArray(),normalMatrix:new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld).toArray()};
    const job={mesh,geometry,position,version:position.version,index:geometry.index,indexVersion:geometry.index?.version||0,options,erase:settings.erase,stroke};
    // Mantener acotada la cola de movimientos rápidos; siempre conservar el último punto.
    if(queue.length>=32&&queue.at(-1).stroke===stroke)queue[queue.length-1]=job;else queue.push(job);
    void pump();
  }
  return {paint,cancel,busy};
}

import {refineOrganicBoundary} from './organic-graph-refine.js';

// Aplica el ajuste por grafo solo a una banda alrededor del límite marcado.
// Las caras fuera de la banda conservan su etiqueta y no se alteran.
export function refineOrganicBoundaryLocal(geometry, selected, {
  maxModelFaces=250000, maxBandFaces=1800, rings=4, ...refineOptions
}={}){
  const p=geometry?.getAttribute?.('position'),idx=geometry?.index;
  if(!p||p.itemSize!==3)throw Error('La malla necesita coordenadas 3D.');
  const count=(idx?idx.count:p.count)/3;
  if(!Number.isInteger(count)||count<4||count>maxModelFaces)throw Error('Modelo demasiado grande para el ajuste local.');
  if(!(selected instanceof Set)||selected.size<2||selected.size>=count-1)throw Error('Selecciona una zona con interior y exterior.');
  for(const f of selected)if(!Number.isInteger(f)||f<0||f>=count)throw Error('Selección con triángulos inválidos.');
  if(!Number.isInteger(rings)||rings<3||rings>12)throw Error('Cantidad de filas de contorno inválida.');
  const getIndex=i=>idx?idx.getX(i):i;
  let extent=0;
  for(let i=0;i<p.count;i++)extent=Math.max(extent,Math.abs(p.getX(i)),Math.abs(p.getY(i)),Math.abs(p.getZ(i)));
  const eps=Math.max(extent*1e-7,1e-7),key=i=>[
    Math.round(p.getX(i)/eps),Math.round(p.getY(i)/eps),Math.round(p.getZ(i)/eps)
  ].join(',');
  const adj=Array.from({length:count},()=>[]),edges=new Map();
  for(let f=0;f<count;f++){
    const v=[0,1,2].map(j=>getIndex(f*3+j));
    if(v.some(i=>i<0||i>=p.count))throw Error('Índice de malla inválido.');
    const keys=v.map(key);
    for(let j=0;j<3;j++){
      const a=keys[j],b=keys[(j+1)%3],k=a<b?a+'|'+b:b+'|'+a;
      const seen=edges.get(k);
      if(seen===undefined)edges.set(k,f);
      else if(typeof seen==='number'){
        if(seen===f)throw Error('Triángulo degenerado.');
        adj[f].push(seen);adj[seen].push(f);edges.set(k,-1);
      }else throw Error('Arista no manifold.');
    }
  }
  const seeds=[];
  for(let i=0;i<count;i++)if(adj[i].some(j=>selected.has(i)!==selected.has(j)))seeds.push(i);
  if(!seeds.length)throw Error('No se encontró un límite entre las regiones.');
  const inBand=new Set(seeds),queue=seeds.map(i=>[i,0]);
  for(let h=0;h<queue.length;h++){
    const [f,depth]=queue[h];if(depth>=rings)continue;
    for(const n of adj[f])if(!inBand.has(n)){
      inBand.add(n);if(inBand.size>maxBandFaces)throw Error('Contorno demasiado extenso para el ajuste local; selecciona una zona menor.');
      queue.push([n,depth+1]);
    }
  }
  if(inBand.size>maxBandFaces)throw Error('Contorno demasiado extenso para el ajuste local.');
  // Caras de la última fila protegidas: no pueden cambiar de etiqueta.
  // Sin esta protección, el corte local podría crear una nueva costura
  // contra la parte del modelo que no forma parte del subproblema.
  const protectedGlobal=new Set(queue.filter(([,depth])=>depth===rings).map(([f])=>f));
  for(const f of inBand)if(adj[f].some(n=>!inBand.has(n)))protectedGlobal.add(f);
  const ids=[...inBand].sort((a,b)=>a-b),localSelected=new Set(),fixedFaces=new Set();
  const coords=new Float64Array(ids.length*9);
  for(let i=0;i<ids.length;i++){
    const f=ids[i];if(selected.has(f))localSelected.add(i);
    if(protectedGlobal.has(f))fixedFaces.add(i);
    for(let j=0;j<3;j++){
      const vi=getIndex(f*3+j);
      coords.set([p.getX(vi),p.getY(vi),p.getZ(vi)],i*9+j*3);
    }
  }
  const pos={itemSize:3,count:coords.length/3,getX:i=>coords[i*3],getY:i=>coords[i*3+1],getZ:i=>coords[i*3+2]};
  const local={getAttribute:n=>n==='position'?pos:null,index:null};
  const refined=refineOrganicBoundary(local,localSelected,{maxFaces:maxBandFaces,...refineOptions,fixedFaces});
  const full=new Set(selected);
  for(let i=0;i<ids.length;i++){
    if(refined.faces.has(i))full.add(ids[i]);else full.delete(ids[i]);
  }
  for(const f of protectedGlobal)if(full.has(f)!==selected.has(f))throw Error('El ajuste cambió una cara protegida del borde.');
  const changed=ids.filter((f,i)=>selected.has(f)!==refined.faces.has(i)).length;
  return {faces:full,changed,bandFaces:ids.length,modelFaces:count,protectedFaces:protectedGlobal.size};
}

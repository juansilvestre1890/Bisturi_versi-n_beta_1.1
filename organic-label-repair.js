// Reparación local y acotada de errores de selección. No cambia la geometría.
// Solo devuelve candidatos; el editor debe comprobar una reconstrucción completa.
export function organicSelectionRepairCandidates(geometry, selected, {maxFaces=250000,maxDefectFaces=5,maxCandidates=12,maxCombinationSize=3}={}) {
 const p=geometry?.getAttribute?.('position'),idx=geometry?.index;
 if(!p||p.itemSize!==3||!(selected instanceof Set))throw Error('Selección o geometría inválida.');
 const n=(idx?idx.count:p.count)/3;
 if(!Number.isInteger(n)||n<4||n>maxFaces||!selected.size||selected.size>=n)throw Error('Selección no apta para reparación.');
 for(const f of selected)if(!Number.isInteger(f)||f<0||f>=n)throw Error('Índice de selección inválido.');
 let extent=0;for(let i=0;i<p.count;i++)extent=Math.max(extent,Math.abs(p.getX(i)),Math.abs(p.getY(i)),Math.abs(p.getZ(i)));
 const eps=Math.max(extent*1e-7,1e-7),owner=new Map(),adj=Array.from({length:n},()=>[]);
 const key=i=>`${Math.round(p.getX(i)/eps)},${Math.round(p.getY(i)/eps)},${Math.round(p.getZ(i)/eps)}`;
 for(let f=0;f<n;f++){
  const vs=[0,1,2].map(j=>idx?idx.getX(f*3+j):f*3+j);
  if(vs.some(i=>!Number.isInteger(i)||i<0||i>=p.count))throw Error('Índice de vértice inválido.');
  const ks=vs.map(key);if(new Set(ks).size!==3)throw Error('Triángulo degenerado.');
  for(let j=0;j<3;j++){
   const a=ks[j],b=ks[(j+1)%3],e=a<b?a+'|'+b:b+'|'+a;
   const old=owner.get(e);
   if(old===undefined)owner.set(e,f);
   else if(old<0)throw Error('Arista no manifold.');
   else {adj[f].push(old);adj[old].push(f);owner.set(e,-1)}
  }
 }
 // Componentes pequeños con etiqueta minoritaria (islas o huecos pequeños).
 const seen=new Uint8Array(n),groups=[];
 for(let f=0;f<n;f++){
  if(seen[f])continue;const label=selected.has(f),q=[f];seen[f]=1;
  // Recorre TODO el componente antes de decidir si es un defecto pequeño.
  // Si se aborta el recorrido cuando supera el límite, quedan triángulos sin
  // visitar que podrían confundirse con islas pequeñas en otro inicio.
  for(let k=0;k<q.length;k++)for(const v of adj[q[k]])if(!seen[v]&&selected.has(v)===label){seen[v]=1;q.push(v)}
  if(q.length>maxDefectFaces)continue;
  let border=0,opposite=0;
  for(const u of q)for(const v of adj[u])if(selected.has(v)!==label){border++;opposite++}
  if(border>=2&&opposite===border)groups.push(q);
 }
 groups.sort((a,b)=>a.length-b.length||a[0]-b[0]);
 const candidates=[];
 for(const group of groups.slice(0,maxCandidates)){
  const next=new Set(selected);for(const f of group)next.has(f)?next.delete(f):next.add(f);
  if(next.size&&next.size<n)candidates.push({faces:next,changed:group.length,facesChanged:[...group],kind:'minority-component'});
 }
 // Ensayar subconjuntos acotados de defectos: dos regiones pueden necesitar
 // corrección simultánea sin que sea válido invertir todas las regiones.
 // La comprobación definitiva de sólidos cerrados queda a cargo del editor.
 const limited=groups.slice(0,Math.min(maxCandidates,12));
 const maxSize=Math.min(Math.max(1,Math.trunc(maxCombinationSize)),3,limited.length);
 const combinationBudget=72;
 let combinations=0;
 const choose=(start,chosen)=>{
  if(combinations>=combinationBudget)return;
  if(chosen.length>=2){
   const next=new Set(selected);
   for(const group of chosen)for(const f of group)next.has(f)?next.delete(f):next.add(f);
   if(next.size&&next.size<n){
    candidates.push({faces:next,changed:chosen.reduce((sum,g)=>sum+g.length,0),
      facesChanged:chosen.flat(),kind:'subset-minority-components'});
    combinations++;
   }
  }
  if(chosen.length>=maxSize)return;
  for(let i=start;i<limited.length&&combinations<combinationBudget;i++)choose(i+1,[...chosen,limited[i]]);
 };
 if(maxSize>=2)choose(0,[]);
 // También propone una limpieza simultánea de varios defectos disjuntos.
 if(groups.length>1){const next=new Set(selected);for(const group of groups.slice(0,maxCandidates))for(const f of group)next.has(f)?next.delete(f):next.add(f);
  if(next.size&&next.size<n)candidates.push({faces:next,changed:groups.slice(0,maxCandidates).reduce((s,g)=>s+g.length,0),kind:'combined-minority-components'});
 }
 // Evitar candidatos idénticos y limitar el trabajo posterior de verificación.
 const unique=[],fingerprints=new Set();
 for(const candidate of candidates){
  const fingerprint=[...candidate.faces].sort((a,b)=>a-b).join(',');
  if(fingerprints.has(fingerprint))continue;
  fingerprints.add(fingerprint);unique.push(candidate);
 }
 return unique;
}

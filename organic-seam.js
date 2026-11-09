// Revisión topológica independiente de las bibliotecas 3D.
// La región puede separarse por una costura simple compartida o como sólido cerrado.
export function inspectOrganicSeam(geometry, selectedFaces, {maxFaces=250000}={}) {
  const pos=geometry?.getAttribute?.('position'),idx=geometry?.index;
  if(!pos||pos.itemSize!==3)throw Error('La malla no tiene coordenadas tridimensionales.');
  const corners=idx?idx.count:pos.count;
  if(corners%3)throw Error('Malla con triángulos incompletos.');
  const total=corners/3;
  if(total<4||total>maxFaces)throw Error('La malla supera el límite de separación orgánica.');
  const selected=new Set(selectedFaces);
  if(selected.size===0||selected.size>=total)throw Error('Selecciona una parte de la figura, no toda la malla.');
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<pos.count;i++)for(let j=0;j<3;j++){
    const n=j===0?pos.getX(i):j===1?pos.getY(i):pos.getZ(i);
    if(!Number.isFinite(n))throw Error('La figura contiene coordenadas no válidas.');
    min[j]=Math.min(min[j],n);max[j]=Math.max(max[j],n);
  }
  const eps=Math.max(Math.hypot(...min.map((n,j)=>max[j]-n))*1e-7,1e-7);
  const vert=i=>{
    if(!Number.isInteger(i)||i<0||i>=pos.count)throw Error('Índice de vértice no válido.');
    return [pos.getX(i),pos.getY(i),pos.getZ(i)].map(n=>Math.round(n/eps)).join(',');
  };
  const sides=[new Map(),new Map()];
  for(const face of selected)if(!Number.isInteger(face)||face<0||face>=total)throw Error('Selección fuera de la figura.');
  for(let f=0;f<total;f++){
    const v=[0,1,2].map(j=>vert(idx?idx.getX(f*3+j):f*3+j));
    if(new Set(v).size!==3)throw Error('Triángulo degenerado en la figura.');
    const entries=sides[selected.has(f)?0:1];
    for(let j=0;j<3;j++){
      const a=v[j],b=v[(j+1)%3],key=a<b?a+'|'+b:b+'|'+a;
      const e=entries.get(key)||{count:0,direction:0,from:a,to:b};
      e.count++;e.direction+=a<b?1:-1;entries.set(key,e);
      if(e.count>2)throw Error('Se detectó una arista no manifold.');
    }
  }
  const boundaries=sides.map(s=>new Map([...s].filter(([,e])=>e.count===1)));
  const mismatches=[...boundaries[0]].filter(([key])=>!boundaries[1].has(key));
  if(mismatches.length||boundaries[0].size!==boundaries[1].size)throw Error('La selección toca agujeros o bordes exteriores incompatibles.');
  const shared=new Set(boundaries[0].keys());
  for(const [key,e] of boundaries[0]){
    const other=boundaries[1].get(key);
    if(other.from!==e.to||other.to!==e.from)throw Error('Las orientaciones de las caras en la costura no coinciden.');
  }
  for(const side of sides)for(const [,e] of side){
    if(e.count===2&&e.direction!==0)throw Error('Caras con orientación invertida alrededor de una arista.');
  }
  if(shared.size===0){
    if(boundaries[0].size||boundaries[1].size)throw Error('Las regiones no forman sólidos cerrados.');
    return {kind:'componentes-cerrados',boundaryEdges:0,canAttempt:true};
  }
  if(shared.size<3||shared.size>600)throw Error('La costura debe tener entre 3 y 600 aristas.');
  const out=new Map(),inn=new Map();
  for(const e of boundaries[0].values()){
    if(out.has(e.from)||inn.has(e.to))throw Error('Costura con bifurcaciones o varias ramas.');
    out.set(e.from,e.to);inn.set(e.to,e.from);
  }
  const first=boundaries[0].values().next().value.from;
  let current=first;const seen=new Set();
  do{
    if(seen.has(current)||!out.has(current)||!inn.has(current))throw Error('Costura discontinuada.');
    seen.add(current);current=out.get(current);
  }while(current!==first&&seen.size<=shared.size);
  if(current!==first||seen.size!==shared.size)throw Error('La selección tiene múltiples contornos o agujeros.');
  return {kind:'costura-simple',boundaryEdges:shared.size,canAttempt:true};
}

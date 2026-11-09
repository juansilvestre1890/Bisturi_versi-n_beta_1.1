/** Inspecciona la frontera entre caras seleccionadas y restantes de una malla triangular. */
export function selectionBoundary(positions, indices, selected, {tolerance=1e-5,maxFaces=250000}={}) {
  if(!positions || positions.length%3 || !Number.isFinite(tolerance) || tolerance<=0) throw Error('Posiciones o tolerancia inválidas');
  const count=indices?indices.length/3:positions.length/9;
  if(!Number.isInteger(count)||count<1||count>maxFaces)throw Error('Cantidad de triángulos no admitida');
  if(indices&&indices.length%3)throw Error('Índices inválidos');
  if(!(selected instanceof Set)||!selected.size||selected.size>=count)throw Error('Selecciona una parte, no toda la malla');
  const edges=new Map(),vertices=new Map();
  const keyOf=id=>{
    if(!Number.isInteger(id)||id<0||id*3+2>=positions.length)throw Error('Índice fuera de rango');
    const xyz=[positions[id*3],positions[id*3+1],positions[id*3+2]];
    if(xyz.some(v=>!Number.isFinite(v)))throw Error('Coordenada no finita');
    const key=xyz.map(v=>Math.round(v/tolerance)).join(',');
    if(!vertices.has(key))vertices.set(key,xyz);
    return key;
  };
  for(let f=0;f<count;f++){
    const keys=[0,1,2].map(j=>keyOf(indices?indices[f*3+j]:f*3+j));
    if(new Set(keys).size!==3)throw Error('Triángulo degenerado');
    for(let j=0;j<3;j++){
      const a=keys[j],b=keys[(j+1)%3],pair=[a,b].sort(),id=pair.join('|');
      if(!edges.has(id))edges.set(id,{pair,selected:0,other:0});
      const entry=edges.get(id);
      if(selected.has(f))entry.selected++;else entry.other++;
    }
  }
  for(const face of selected)if(!Number.isInteger(face)||face<0||face>=count)throw Error('Selección fuera de rango');
  const segments=[],degrees=new Map();let exposed=0,nonManifold=0;
  for(const e of edges.values()){
    if(e.selected+e.other>2)nonManifold++;
    if(!e.selected)continue;
    if(!e.other&&e.selected===1)exposed++;
    if(e.other){
      segments.push([vertices.get(e.pair[0]),vertices.get(e.pair[1])]);
      for(const v of e.pair)degrees.set(v,(degrees.get(v)||0)+1);
    }
  }
  const openNodes=[...degrees.values()].filter(d=>d===1).length;
  const branchNodes=[...degrees.values()].filter(d=>d>2).length;
  const graph=new Map();
  for(const e of edges.values())if(e.selected&&e.other){
    for(const [a,b] of [[e.pair[0],e.pair[1]],[e.pair[1],e.pair[0]]]){
      if(!graph.has(a))graph.set(a,new Set());graph.get(a).add(b);
    }
  }
  const seen=new Set();let components=0;
  for(const root of graph.keys())if(!seen.has(root)){
    components++;const stack=[root];seen.add(root);
    while(stack.length)for(const neighbor of graph.get(stack.pop())||[])if(!seen.has(neighbor)){seen.add(neighbor);stack.push(neighbor)}
  }
  return {segments,edges:segments.length,components,openNodes,branchNodes,exposed,nonManifold,
    simpleLoop:segments.length>=3&&components===1&&openNodes===0&&branchNodes===0&&exposed===0&&nonManifold===0};
}

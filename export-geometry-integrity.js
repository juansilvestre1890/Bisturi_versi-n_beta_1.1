// Etapa 25: cotejo independiente de vértices transformados y STL binario.
// Opera con datos numéricos, sin WebGL. No certifica la imprimibilidad.
export function inspectSTLVertexMoments(data){
  const b=data instanceof ArrayBuffer?data:ArrayBuffer.isView(data)?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):null;
  if(!b||b.byteLength<84)throw Error('STL binario inválido.');
  const v=new DataView(b),count=v.getUint32(80,true);
  if(!count||84+count*50!==b.byteLength)throw Error('STL incompleto o sin triángulos.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],sum=[0,0,0],sumSq=[0,0,0];
  for(let i=0;i<count;i++)for(let j=0;j<3;j++)for(let a=0;a<3;a++){
    const n=v.getFloat32(84+i*50+12+j*12+4*a,true);
    if(!Number.isFinite(n))throw Error('STL con coordenada no finita.');
    min[a]=Math.min(min[a],n);max[a]=Math.max(max[a],n);sum[a]+=n;sumSq[a]+=n*n;
  }
  return {triangles:count,min,max,mean:sum.map(s=>s/(count*3)),meanSq:sumSq.map(s=>s/(count*3))};
}
export function inspectExpectedVertexMoments(positions,indices,transform){
  if(!positions||positions.length%3||!positions.length||typeof transform!=='function')throw Error('Geometría de origen inválida.');
  const vertexCount=positions.length/3;
  const order=indices||Array.from({length:vertexCount},(_,i)=>i);
  if(!order.length||order.length%3)throw Error('Índices de origen inválidos.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],sum=[0,0,0],sumSq=[0,0,0];
  for(const idx of order){
    if(!Number.isInteger(idx)||idx<0||idx>=vertexCount)throw Error('Índice de vértice fuera de rango.');
    const pt=transform(positions[idx*3],positions[idx*3+1],positions[idx*3+2]);
    if(!Array.isArray(pt)||pt.length!==3||pt.some(n=>!Number.isFinite(n)))throw Error('Transformación inválida.');
    for(let a=0;a<3;a++){const n=pt[a];min[a]=Math.min(min[a],n);max[a]=Math.max(max[a],n);sum[a]+=n;sumSq[a]+=n*n;}
  }
  return {triangles:order.length/3,min,max,mean:sum.map(s=>s/order.length),meanSq:sumSq.map(s=>s/order.length)};
}
export function assertSTLTransformIntegrity(expected,data,{tolerance=0.03}={}){
  if(!expected||!Number.isFinite(tolerance)||tolerance<=0)throw Error('Tolerancia de exportación inválida.');
  const actual=inspectSTLVertexMoments(data);
  if(expected.triangles!==actual.triangles)throw Error('El STL no conserva la cantidad de triángulos.');
  for(const key of ['min','max','mean','meanSq'])for(let a=0;a<3;a++){
    const target=expected[key]?.[a],got=actual[key][a];
    const allowance=key==='meanSq'?tolerance*Math.max(1,Math.abs(target),Math.abs(got))*0.01:tolerance;
    if(!Number.isFinite(target)||Math.abs(target-got)>allowance)
      throw Error('El STL no conserva la distribución o transformación de sus vértices ('+key+').');
  }
  return {triangles:actual.triangles,matched:true};
}

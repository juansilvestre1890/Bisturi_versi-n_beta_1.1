/** Comprueba que cada resultado de separación sea exactamente un sólido conectado.
 * Se usa una tolerancia diminuta para mallas STL (vértices duplicados por triángulo).
 * La conectividad requiere aristas compartidas, no simples contactos de punta.
 */
export function inspectSolidConnectivity(geometry,{maxTriangles=250000}={}){
 const pos=geometry?.getAttribute?.('position'),index=geometry?.index;
 if(!pos||pos.itemSize!==3)throw Error('La pieza no contiene posiciones 3D válidas.');
 const corners=index?index.count:pos.count;
 if(corners%3!==0||corners===0)throw Error('La pieza tiene triángulos incompletos.');
 const n=corners/3;
 if(n>maxTriangles)throw Error('La pieza supera el límite de comprobación de conectividad.');
 let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<pos.count;i++){
  for(let j=0;j<3;j++){
   const x=j===0?pos.getX(i):j===1?pos.getY(i):pos.getZ(i);
   if(!Number.isFinite(x))throw Error('La pieza contiene coordenadas no válidas.');
   min[j]=Math.min(min[j],x);max[j]=Math.max(max[j],x);
  }
 }
 const span=Math.hypot(...min.map((v,i)=>max[i]-v));
 const eps=Math.max(span*1e-8,1e-9);
 const vertex=(i)=>{
  if(!Number.isInteger(i)||i<0||i>=pos.count)throw Error('Índice de vértice no válido.');
  return [pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v/eps)).join(',');
 };
 const parent=Int32Array.from({length:n},(_,i)=>i);
 function root(x){while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x}
 function join(a,b){a=root(a);b=root(b);if(a!==b)parent[b]=a}
 const edges=new Map();
 for(let f=0;f<n;f++){
  const v=[0,1,2].map(j=>vertex(index?index.getX(f*3+j):f*3+j));
  if(new Set(v).size<3)throw Error('Triángulo degenerado en la pieza.');
  for(let j=0;j<3;j++){
   const a=v[j],b=v[(j+1)%3],key=a<b?a+'|'+b:b+'|'+a;
   const first=edges.get(key);
   if(first===undefined)edges.set(key,f);
   else join(first,f);
  }
 }
 const components=new Set();for(let i=0;i<n;i++)components.add(root(i));
 return {ok:components.size===1,components:components.size,triangles:n};
}
export function requireSingleSolid(geometry,label='Pieza'){
 const result=inspectSolidConnectivity(geometry);
 if(!result.ok)throw Error(`${label}: contiene ${result.components} cuerpos desconectados; sepáralos individualmente antes de exportar.`);
 return result;
}

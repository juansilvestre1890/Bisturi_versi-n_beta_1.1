/** Diagnóstico topológico preliminar. No reemplaza un validador de impresión 3D.
 * Versión con arreglos tipados: une vértices por rejilla de tolerancia con una tabla hash
 * y cuenta aristas ordenando claves numéricas, para mallas de varios millones de triángulos.
 */
export function analyzeMeshGeometry(geometry,{tolerance=1e-5,maxTriangles=4000000,degenerateEdges=false}={}){
  const pos=geometry?.getAttribute?.('position');
  if(!pos||pos.itemSize<3)return {ok:false,level:'error',reason:'Sin posiciones de vértices',triangles:0};
  const index=geometry.index;
  const corners=index?index.count:pos.count;
  if(corners%3!==0)return {ok:false,level:'error',reason:'Número de vértices no divisible entre tres',triangles:0};
  const triangles=corners/3;
  if(triangles>maxTriangles)return {ok:false,level:'unknown',reason:'Malla demasiado grande para este análisis',triangles};
  const scale=1/tolerance, n=pos.count, arr=pos.array, stride=pos.isInterleavedBufferAttribute?pos.data.stride:pos.itemSize, off=pos.offset||0;
  const X=i=>arr[i*stride+off], Y=i=>arr[i*stride+off+1], Z=i=>arr[i*stride+off+2];
  // 1) Identificador único por punto cuantizado (tabla hash de direccionamiento abierto).
  let size=1; while(size<n*2)size<<=1;
  const table=new Int32Array(size).fill(-1), qx=new Float64Array(n), qy=new Float64Array(n), qz=new Float64Array(n), id=new Int32Array(n);
  let unique=0, invalid=0;
  const rep=new Int32Array(n);
  for(let i=0;i<n;i++){
    const x=X(i),y=Y(i),z=Z(i);
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)){id[i]=-1;continue}
    const a=Math.round(x*scale),b=Math.round(y*scale),c=Math.round(z*scale);
    let h=(Math.imul(a|0,73856093)^Math.imul(b|0,19349663)^Math.imul(c|0,83492791))&(size-1);
    for(;;){
      const t=table[h];
      if(t<0){table[h]=unique;qx[unique]=a;qy[unique]=b;qz[unique]=c;rep[unique]=i;id[i]=unique++;break}
      if(qx[t]===a&&qy[t]===b&&qz[t]===c){id[i]=t;break}
      h=(h+1)&(size-1);
    }
  }
  // 2) Caras: inválidas, degeneradas y área; aristas no dirigidas con su sentido.
  const N=unique+1, keys=new Float64Array(triangles*3);
  let edgesUsed=0, degenerate=0, area=0;
  const tol2=tolerance*tolerance;
  for(let f=0;f<triangles;f++){
    const i0=index?index.getX(3*f):3*f, i1=index?index.getX(3*f+1):3*f+1, i2=index?index.getX(3*f+2):3*f+2;
    if(!(i0>=0&&i0<n&&i1>=0&&i1<n&&i2>=0&&i2<n)||!Number.isInteger(i0+i1+i2)){invalid++;continue}
    const a=id[i0],b=id[i1],c=id[i2];
    if(a<0||b<0||c<0){invalid++;continue}
    const ux=X(i1)-X(i0),uy=Y(i1)-Y(i0),uz=Z(i1)-Z(i0),vx=X(i2)-X(i0),vy=Y(i2)-Y(i0),vz=Z(i2)-Z(i0);
    const ar=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;
    if(a===b||b===c||a===c||ar<=tol2){degenerate++;if(!degenerateEdges||a===b||b===c||a===c)continue}
    else area+=ar;
    for(const [p,q] of [[a,b],[b,c],[c,a]]){
      // clave par: (menor*N+mayor)*2 + 1 si el sentido va de mayor a menor
      keys[edgesUsed++]=(p<q?(p*N+q)*2:(q*N+p)*2+1);
    }
  }
  const used=keys.subarray(0,edgesUsed).sort();
  let boundary=0,nonManifold=0,winding=0,edges=0;
  for(let i=0;i<used.length;){
    const k=Math.floor(used[i]/2);let count=0,dir=0;
    while(i<used.length&&Math.floor(used[i]/2)===k){count++;dir+=(used[i]%2===0)?1:-1;i++}
    edges++;
    if(count===1)boundary++;
    else if(count>2)nonManifold++;
    else if(dir!==0)winding++;
  }
  const ok=triangles>0&&invalid===0&&degenerate===0&&boundary===0&&nonManifold===0&&winding===0;
  return {ok,level:ok?'ok':'warning',triangles,vertices:unique,edges,boundary,nonManifold,winding,degenerate,invalid,surfaceArea:area,reason:ok?'Sin problemas topológicos detectados (no garantiza imprimibilidad)':'Se encontraron posibles problemas de malla'};
}

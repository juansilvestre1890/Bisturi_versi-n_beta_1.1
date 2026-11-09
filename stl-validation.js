import {weld,inspect} from './curved-cut.js';
/** Basic binary-STL structural validation (not a manifold/printability guarantee). */
export function inspectBinarySTL(data, expectedBounds=null, tolerance=0.02) {
  const buffer = data instanceof ArrayBuffer ? data : ArrayBuffer.isView(data) ? data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) : null;
  if(!buffer || buffer.byteLength < 84)throw Error('STL binario inexistente o incompleto.');
  const v=new DataView(buffer),count=v.getUint32(80,true);
  if(!count || 84+count*50!==buffer.byteLength)throw Error('STL binario sin triángulos o con tamaño incorrecto.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<count;i++){
    const pos=84+i*50;
    for(let axis=0;axis<3;axis++)if(!Number.isFinite(v.getFloat32(pos+axis*4,true)))throw Error('Normal no finita en STL.');
    for(let k=0;k<3;k++)for(let axis=0;axis<3;axis++){
      const value=v.getFloat32(pos+12+k*12+axis*4,true);
      if(!Number.isFinite(value))throw Error('Coordenada no finita en STL.');
      min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);
    }
  }
  if(expectedBounds){for(let a=0;a<3;a++){
    if(Math.abs(min[a]-expectedBounds.min[a])>tolerance||Math.abs(max[a]-expectedBounds.max[a])>tolerance)
      throw Error('El STL exportado no conserva la posición o dimensiones esperadas.');
  }}
  return {triangles:count,min,max,size:max.map((n,i)=>n-min[i])};
}

/** Validación topológica básica del STL binario ya exportado.
 * Cuenta aristas soldando vértices por tolerancia; no detecta autointersecciones.
 */
export function inspectBinarySTLTopology(data,{tolerance=1e-5,maxTriangles=2000000}={}){
  const buffer=data instanceof ArrayBuffer?data:ArrayBuffer.isView(data)?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):null;
  const info=inspectBinarySTL(buffer);
  if(!Number.isFinite(tolerance)||tolerance<=0)throw Error('Tolerancia topológica inválida.');
  if(info.triangles>maxTriangles)return {ok:false,unverified:true,reason:'Malla demasiado grande para validar topología en esta operación.',triangles:info.triangles};
  if(info.triangles>250000){
    const view=new DataView(buffer),positions=new Float32Array(info.triangles*9);
    for(let f=0;f<info.triangles;f++)for(let k=0;k<9;k++)positions[9*f+k]=view.getFloat32(84+50*f+12+4*k,true);
    const result=inspect(weld(positions));
    return {...result,ok:result.closed,method:'exact-float32-dense'};
  }
  const view=new DataView(buffer),edges=new Map();let degenerate=0;
  const key=p=>p.map(v=>Math.round(v/tolerance)).join(',');
  for(let t=0;t<info.triangles;t++){
    const base=84+t*50,points=[];
    for(let j=0;j<3;j++)points.push([0,1,2].map(a=>view.getFloat32(base+12+j*12+a*4,true)));
    const keys=points.map(key);
    const u=points[1].map((v,i)=>v-points[0][i]),v=points[2].map((n,i)=>n-points[0][i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(new Set(keys).size!==3||Math.hypot(...cross)<=tolerance*tolerance){degenerate++;continue;}
    for(let j=0;j<3;j++){
      const a=keys[j],b=keys[(j+1)%3],sorted=a<b?a+'|'+b:b+'|'+a;
      const e=edges.get(sorted)||{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(sorted,e);
    }
  }
  let boundary=0,nonManifold=0,winding=0;
  for(const e of edges.values()){
    if(e.count===1)boundary++;
    if(e.count>2)nonManifold++;
    if(e.count===2&&e.direction!==0)winding++;
  }
  return {ok:boundary===0&&nonManifold===0&&winding===0&&degenerate===0,boundary,nonManifold,winding,degenerate,triangles:info.triangles};
}

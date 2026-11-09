// Etapa 32: conversión de STL desde Three.js (altura Y) al laminador (altura Z).
// STL no almacena unidades, perfiles de impresora ni materiales: se usan mm por convenio.
import {inspectBinarySTL} from './stl-validation.js';

const arrayBuffer=data=>data instanceof ArrayBuffer?data:ArrayBuffer.isView(data)?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):null;
export function convertSTLToSlicerZUp(data,{bedDepth=null}={}){
  const source=arrayBuffer(data);
  const before=inspectBinarySTL(source);
  if(bedDepth!==null&&(!Number.isFinite(bedDepth)||bedDepth<=0))throw Error('Fondo de cama inválido.');
  const out=source.slice(0),view=new DataView(out),count=before.triangles;
  // Rotación de +90º en X: (x,y,z) -> (x,-z,y).
  // Para las camas se invierte la profundidad relativa al borde Y de la cama.
  const rotate=(x,y,z,normal=false)=>[x,-z+(normal?0:(bedDepth??0)),y];
  for(let t=0;t<count;t++){
    const base=84+t*50;
    for(const offset of [0,12,24,36]){
      const x=view.getFloat32(base+offset,true),y=view.getFloat32(base+offset+4,true),z=view.getFloat32(base+offset+8,true);
      const result=rotate(x,y,z,offset===0);
      for(let j=0;j<3;j++)view.setFloat32(base+offset+j*4,result[j],true);
    }
  }
  const after=inspectBinarySTL(out);
  if(after.triangles!==before.triangles)throw Error('La conversión alteró el número de triángulos.');
  const tolerance=0.04;
  const expectedMin=[before.min[0],-before.max[2]+(bedDepth??0),before.min[1]];
  const expectedMax=[before.max[0],-before.min[2]+(bedDepth??0),before.max[1]];
  for(let a=0;a<3;a++)if(Math.abs(expectedMin[a]-after.min[a])>tolerance||Math.abs(expectedMax[a]-after.max[a])>tolerance)
    throw Error('La conversión de orientación modificó los límites geométricos.');
  return out;
}

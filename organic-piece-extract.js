// Copia una región de triángulos sin alterar la malla de origen.
// Usada tanto por el editor como por la prueba de ida y vuelta STL.
export function extractOrganicPieceGeometry(geometry,faceIndices,THREE,{materialIndices=null}={}){
  const pos=geometry?.getAttribute?.('position'),idx=geometry?.index;
  if(!pos||pos.itemSize!==3)throw Error('Geometría sin coordenadas tridimensionales.');
  const corners=idx?idx.count:pos.count;
  if(corners%3)throw Error('Geometría con triángulos incompletos.');
  const total=corners/3;
  if(!Array.isArray(faceIndices)||!faceIndices.length)throw Error('La pieza no contiene triángulos.');
  if(faceIndices.some(f=>!Number.isInteger(f)||f<0||f>=total)||new Set(faceIndices).size!==faceIndices.length)throw Error('Índices de triángulos inválidos o repetidos.');
  const vertices=[];
  for(const face of faceIndices)for(let corner=0;corner<3;corner++){
    const vi=idx?idx.getX(face*3+corner):face*3+corner;
    if(!Number.isInteger(vi)||vi<0||vi>=pos.count)throw Error('Índice de vértice inválido.');
    vertices.push(vi);
  }
  const result=new THREE.BufferGeometry();
  try{
    for(const [name,attr] of Object.entries(geometry.attributes)){
      if(attr.count!==pos.count)continue;
      if(attr.isInterleavedBufferAttribute)throw Error('No se admite un atributo intercalado.');
      const ArrayType=name==='position'?Float32Array:attr.array.constructor;
      const data=new ArrayType(vertices.length*attr.itemSize);
      for(let i=0;i<vertices.length;i++)for(let j=0;j<attr.itemSize;j++)data[i*attr.itemSize+j]=attr.array[vertices[i]*attr.itemSize+j];
      result.setAttribute(name,new THREE.BufferAttribute(data,attr.itemSize,attr.normalized));
    }
    if(!result.getAttribute('position'))throw Error('No se pudo copiar la posición de la pieza.');
    if(!result.getAttribute('normal'))result.computeVertexNormals();
    if(materialIndices){
      if(materialIndices.length!==faceIndices.length)throw Error('Materiales incompatibles con los triángulos.');
      let start=0;
      for(let i=1;i<=materialIndices.length;i++)if(i===materialIndices.length||materialIndices[i]!==materialIndices[start]){
        result.addGroup(start*3,(i-start)*3,materialIndices[start]);start=i;
      }
    }
    result.computeBoundingBox();result.computeBoundingSphere();
    return result;
  }catch(e){result.dispose();throw e;}
}

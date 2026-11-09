// Color base visible, sin iluminación: material × vértices × textura UV.
const srgbToLinear=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
const linearToSrgb=x=>x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055;
const clamp=x=>Math.max(0,Math.min(1,x));
function wrap(x,mode){if(mode===1000)return x-Math.floor(x);if(mode===1002){const n=Math.floor(x),r=x-n;return Math.abs(n)%2?1-r:r;}return clamp(x);}
export function sampleTexture(texture,u,v){
  const {width,height,pixels,matrix,flipY,wrapS,wrapT}=texture;
  let x=matrix[0]*u+matrix[3]*v+matrix[6],y=matrix[1]*u+matrix[4]*v+matrix[7];
  x=wrap(x,wrapS);y=wrap(y,wrapT);if(flipY)y=1-y;
  // Muestra bilineal a resolución original, incluyendo repetición en el borde.
  const px=x*width-.5,py=y*height-.5,x0=Math.floor(px),y0=Math.floor(py),fx=px-x0,fy=py-y0,out=[0,0,0];
  const coord=(i,n,mode)=>mode===1000?((i%n)+n)%n:mode===1002?((i%(2*n)+2*n)%(2*n)<n?(i%(2*n)+2*n)%(2*n):2*n-1-(i%(2*n)+2*n)%(2*n)):Math.max(0,Math.min(n-1,i));
  for(let j=0;j<2;j++)for(let i=0;i<2;i++){
    const offset=4*(coord(y0+j,height,wrapT)*width+coord(x0+i,width,wrapS)),weight=(i?fx:1-fx)*(j?fy:1-fy);
    for(let k=0;k<3;k++){let c=pixels[offset+k]/255;if(texture.srgb)c=srgbToLinear(c);out[k]+=weight*c;}
  }
  return out;
}
export function prepareFaceColors(input,count,progress=()=>{}){
  const {index,vertexColors,uvs,materials,textures,groups}=input,materialIds=new Uint16Array(count);
  if(!materials?.length||materials.length>65535)throw Error('Materiales no válidos.');
  if(materials.length>1)for(const g of groups||[]){
    if(g.start%3||g.count%3||g.materialIndex>=materials.length)throw Error('Grupos de material no válidos.');
    materialIds.fill(g.materialIndex,g.start/3,Math.min(count,(g.start+g.count)/3));
  }
  const sample=(face,weights=[1/3,1/3,1/3])=>{
    const mat=materials[materialIds[face]],ids=[0,1,2].map(k=>index?index[3*face+k]:3*face+k),color=mat.color.slice();
    if(mat.vertexColors&&vertexColors)for(let k=0;k<3;k++)color[k]*=ids.reduce((s,v,j)=>s+weights[j]*vertexColors[3*v+k],0);
    if(mat.texture!==null&&mat.texture!==undefined){
      const texture=textures[mat.texture],uv=uvs[texture.channel];if(!uv)throw Error('La textura no tiene coordenadas UV disponibles.');
      const u=ids.reduce((s,v,j)=>s+weights[j]*uv[2*v],0),v=ids.reduce((s,v,j)=>s+weights[j]*uv[2*v+1],0),tex=sampleTexture(texture,u,v);
      for(let k=0;k<3;k++)color[k]*=tex[k];
    }
    if(!color.every(Number.isFinite))throw Error('Colores o coordenadas UV no válidos.');
    return color.map(c=>clamp(linearToSrgb(c)));
  };
  const colors=new Float32Array(3*count);for(let f=0;f<count;f++){colors.set(sample(f),3*f);if(f%250000===0)progress(`Leyendo colores de la superficie: ${Math.round(f/count*100)} %…`);}
  return {colors,sample,hasTexture:textures.length>0,hasVertexColors:!!vertexColors};
}

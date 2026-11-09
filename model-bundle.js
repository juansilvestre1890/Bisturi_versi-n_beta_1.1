/** Empareja un modelo local con sus recursos OBJ sin recurrir a la red. */
export function chooseModelBundle(input){
  const files=Array.from(input||[]);
  const models=files.filter(f=>/\.(stl|obj|glb|fbx|3mf)$/i.test(f.name));
  if(!models.length)throw Error('Formato no admitido. Abre un archivo STL, 3MF, OBJ, FBX o GLB.');
  if(models.length!==1)throw Error('Selecciona un solo modelo 3D por importación.');
  const main=models[0];
  const extras=files.filter(f=>f!==main);
  if(!/\.obj$/i.test(main.name)&&extras.length)throw Error('Los archivos adicionales solo se admiten junto con un OBJ.');
  const mtls=extras.filter(f=>/\.mtl$/i.test(f.name));
  if(mtls.length>1)throw Error('Selecciona un único archivo MTL para este OBJ.');
  if(extras.length&&!mtls.length)throw Error('Para importar texturas OBJ, selecciona también su archivo MTL.');
  if(extras.some(f=>!(/\.mtl$/i.test(f.name)||/\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name))))
    throw Error('Los recursos OBJ deben ser MTL o imágenes de textura.');
  const assets=new Map();
  for(const file of extras){
    const key=file.name.toLowerCase();
    if(assets.has(key))throw Error('Hay archivos de recursos con el mismo nombre: '+file.name);
    assets.set(key,file);
  }
  return {main,mtl:mtls[0]||null,assets};
}

export function resourceName(path){
  const clean=String(path||'').split(/[?#]/,1)[0].replace(/\\/g,'/');
  try{return decodeURIComponent(clean.substring(clean.lastIndexOf('/')+1)).toLowerCase()}
  catch{return clean.substring(clean.lastIndexOf('/')+1).toLowerCase()}
}

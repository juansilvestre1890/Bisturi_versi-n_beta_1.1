// Optional acceleration for static selection meshes. Preserve face ordering.
let library=null,loading=null;
export function loadRaycastAcceleration(){
 if(!loading)loading=import('three-mesh-bvh').then(mod=>{library=mod;return true;}).catch(()=>false);
 return loading;
}
export function accelerateSurfaceMeshes(meshes){
 if(!library)return 0;
 let built=0;
 for(const mesh of meshes){
  const geometry=mesh.geometry,position=geometry?.getAttribute?.('position');
  if(!position||mesh.isSkinnedMesh||geometry.morphAttributes?.position?.length||geometry.boundsTree)continue;
  const count=(geometry.index?.count||position.count)/3;
  if(count<50000||count>2000000)continue;
  const originalIndex=geometry.index;
  try{
   const tree=new library.MeshBVH(geometry,{indirect:true,verbose:false});
   // In indirect mode the source index and triangle IDs must stay identical.
   if(geometry.index!==originalIndex)throw Error('BVH modified the source index');
   geometry.boundsTree=tree;mesh.raycast=library.acceleratedRaycast;built++;
  }catch{geometry.boundsTree=null;if(geometry.index!==originalIndex)geometry.setIndex(originalIndex);mesh.raycast=mesh.constructor.prototype.raycast;}
 }
 return built;
}

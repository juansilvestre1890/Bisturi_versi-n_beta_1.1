// Unique vertices and edge midpoints complement face-centroid checks.
// This finite sampling is not an exhaustive intersection proof.
export function visitCapSamples(vertices, faces, visit) {
 const seenVertices=new Set(),seenEdges=new Set();
 const counts={vertices:0,edges:0,centroids:0};
 const point=id=>[vertices[3*id],vertices[3*id+1],vertices[3*id+2]];
 for(let i=0;i<faces.length;i+=3){
  const ids=[faces[i],faces[i+1],faces[i+2]];
  for(const id of ids)if(!seenVertices.has(id)){
   seenVertices.add(id);visit(point(id),'vertex',[id]);counts.vertices++;
  }
  for(let j=0;j<3;j++){
   const a=ids[j],b=ids[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;
   if(seenEdges.has(key))continue;
   seenEdges.add(key);const A=point(a),B=point(b);
   visit(A.map((x,k)=>(x+B[k])/2),'edge',[a,b]);counts.edges++;
  }
  const A=point(ids[0]),B=point(ids[1]),C=point(ids[2]);
  visit(A.map((x,k)=>(x+B[k]+C[k])/3),'centroid',ids);counts.centroids++;
 }
 return counts;
}

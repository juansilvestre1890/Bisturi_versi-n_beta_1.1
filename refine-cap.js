// Refine a failed interior sample without moving any seam vertex or edge.
// inspect must reject an invalid cap with error.capSample={kind,ids,point}.
export function refineCap(vertices,cap,axis,height,inspect){
 const u=(axis+1)%3,v=(axis+2)%3;
 const area=t=>{const [a,b,c]=t;return (vertices[3*b+u]-vertices[3*a+u])*(vertices[3*c+v]-vertices[3*a+v])-(vertices[3*b+v]-vertices[3*a+v])*(vertices[3*c+u]-vertices[3*a+u]);};
 const stats={passes:0,splitEdges:0,splitFaces:0,addedVertices:0,boundaryPreserved:true};
 for(let pass=0;pass<=6;pass++){
  try{return {...inspect(),refinement:stats};}catch(error){
   const s=error.capSample;
   if(!s||pass===6||s.kind==='vertex'||cap.length/3>=200000)throw error;
   const incident=[];
   for(let i=0;i<cap.length;i+=3){const t=cap.slice(i,i+3);if(s.ids.every(id=>t.includes(id)))incident.push(i);}
   if((s.kind==='edge'&&incident.length!==2)||(s.kind==='centroid'&&incident.length!==1))throw error;
   const P=s.point.slice();P[axis]=height(P[u],P[v]);
   if(!P.every(Number.isFinite))throw error;
   const id=vertices.length/3;vertices.push(...P.map(Math.fround));
   const replacements=[];
   for(const i of incident){const t=cap.slice(i,i+3);let children;
    if(s.kind==='edge'){
     const k=t.findIndex((a,k)=>s.ids.includes(a)&&s.ids.includes(t[(k+1)%3]));
     if(k<0)throw error;
     const a=t[k],b=t[(k+1)%3],c=t[(k+2)%3];children=[[a,id,c],[id,b,c]];
    }else children=[[t[0],t[1],id],[t[1],t[2],id],[t[2],t[0],id]];
    const orientation=area(t);
    if(!orientation||children.some(t=>!(area(t)*orientation>0)))throw error;
    replacements.push({i,children});
   }
   for(const {i,children} of replacements){cap.splice(i,3,...children[0]);for(const t of children.slice(1))cap.push(...t);}
   stats.passes++;stats.addedVertices++;stats[s.kind==='edge'?'splitEdges':'splitFaces']++;
  }
 }
}

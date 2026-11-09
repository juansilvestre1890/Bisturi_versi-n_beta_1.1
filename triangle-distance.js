export function pointTriangleDistanceSquared(p,a,b,c){
 const sub=(a,b)=>a.map((x,k)=>x-b[k]),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a);
 const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],nn=dot(n,n);
 if(nn>0){
  const d=dot(ap,n),q=p.map((x,k)=>x-n[k]*d/nn),aq=sub(q,a);
  const aa=dot(ab,ab),bb=dot(ab,ac),cc=dot(ac,ac),u=dot(aq,ab),v=dot(aq,ac),den=aa*cc-bb*bb;
  if(den>0){const s=(cc*u-bb*v)/den,t=(aa*v-bb*u)/den;if(s>=0&&t>=0&&s+t<=1)return d*d/nn;}
 }
 const segment=(a,b)=>{const e=sub(b,a),r=sub(p,a),ee=dot(e,e),t=ee?Math.max(0,Math.min(1,dot(r,e)/ee)):0;const d=r.map((x,k)=>x-t*e[k]);return dot(d,d);};
 return Math.min(segment(a,b),segment(b,c),segment(c,a));
}

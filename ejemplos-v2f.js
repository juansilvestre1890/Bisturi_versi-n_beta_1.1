// Ejemplos de la v2f: hongo de 3 colores y guijarro orgánico (en mm, eje Z hacia arriba).
const pushTri = (arr, a, b, c) => arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
export function sampleMushroom(){
  const stem=lathe([[0,0],[13,0],[14,1.5],[12.5,18],[11,38],[11,40],[0,40]],64);
  const capProf=[[0,40],[34,40],[36,42.5]];for(let i=1;i<=26;i++){const a=i/26*Math.PI/2;capProf.push([i===26?0:36*Math.cos(a),42.5+37.5*Math.sin(a)]);}
  const cap=lathe(capProf,112);
  const spots=[[0,55,7.5],[72,36,6.5],[150,50,7],[222,32,6.5],[292,48,7.5],[32,16,5.5],[112,14,5.5],[258,12,5.5],[186,72,6]].map(([az,el,r])=>{
    const A=az*Math.PI/180,E=el*Math.PI/180;return {c:[36*Math.cos(E)*Math.cos(A),36*Math.cos(E)*Math.sin(A),42.5+37.5*Math.sin(E)],r};});
  const pos=new Float32Array(stem.length+cap.length);pos.set(stem);pos.set(cap,stem.length);
  const ns=stem.length/9,nt=pos.length/9;const col=new Int16Array(nt),part=new Int32Array(nt);
  for(let t=0;t<nt;t++){if(t<ns){col[t]=1;part[t]=1;continue;}part[t]=0;col[t]=0;const o=t*9;
    const c=[(pos[o]+pos[o+3]+pos[o+6])/3,(pos[o+1]+pos[o+4]+pos[o+7])/3,(pos[o+2]+pos[o+5]+pos[o+8])/3];
    if(c[2]>43&&spots.some(s=>Math.hypot(c[0]-s.c[0],c[1]-s.c[1],c[2]-s.c[2])<s.r))col[t]=2;}
  return {pos,col,part,parts:[{base:0},{base:1}],palette:[{hex:'#c8322b',label:'Filamento 1'},{hex:'#e6d6b4',label:'Filamento 2'},{hex:'#f7f6f0',label:'Filamento 3'}]};}


function lathe(prof,seg,cx=0,cy=0){const out=[];const P=(r,z,j)=>{const a=j/seg*Math.PI*2;return [cx+r*Math.cos(a),cy+r*Math.sin(a),z];};
  for(let i=0;i<prof.length-1;i++){const [r0,z0]=prof[i],[r1,z1]=prof[i+1];
    for(let j=0;j<seg;j++){const A=P(r0,z0,j),B=P(r0,z0,j+1),C=P(r1,z1,j+1),D=P(r1,z1,j);
      if(r0>0)pushTri(out,A,B,C); if(r1>0)pushTri(out,A,C,D);}}
  return out;}

export function guijarro(nivel = 5) {
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => { const l = Math.hypot(...p); return p.map(x => x / l); });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let n = 0; n < nivel; n++) {
    const cache = new Map(), medio = (a, b) => { const k = a < b ? a + ':' + b : b + ':' + a; if (!cache.has(k)) { const p = v[a].map((x, i) => (x + v[b][i]) / 2), l = Math.hypot(...p); v.push(p.map(x => x / l)); cache.set(k, v.length - 1); } return cache.get(k); };
    const g = [];
    for (const [a, b, c] of f) { const ab = medio(a, b), bc = medio(b, c), ca = medio(c, a); g.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = g;
  }
  // Deformación suave: cuerpo alargado, una «cabeza» y dos protuberancias.
  const bulto = (p, c, r, h) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]); return h * Math.exp(-(d * d) / (r * r)); };
  v = v.map(p => {
    const r = 1 + 0.07 * Math.sin(3 * p[0] + 1) * Math.cos(4 * p[1]) + bulto(p, [0.2, 0.1, 0.97], 0.45, 0.32) + bulto(p, [0.75, -0.55, 0.35], 0.28, 0.16) + bulto(p, [-0.7, -0.6, 0.3], 0.28, 0.16);
    return [p[0] * r * 22, p[1] * r * 17, p[2] * r * 20];
  });
  const sopa = new Float32Array(f.length * 9);
  f.forEach((tri, i) => tri.forEach((k, j) => sopa.set(v[k], 9 * i + 3 * j)));
  return sopa;
}

// Coloca la sopa como en la v2f: centrada en X/Y y apoyada en Z = 0.
export function apoyarSopa(s) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < s.length; i++) { const k = i % 3; if (s[i] < min[k]) min[k] = s[i]; if (s[i] > max[k]) max[k] = s[i]; }
  const d = [-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]], out = new Float32Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s[i] + d[i % 3];
  return out;
}

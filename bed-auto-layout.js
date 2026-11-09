// Distribución automática conservadora para una cama: calcula primero y no altera datos al fallar.
// Todas las dimensiones están en mm; cada pieza incluye su caja envolvente rotada.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function planAutomaticBedLayout(bed,items,{margin=3}={}){
  if(!bed||![bed.x,bed.y,bed.z,margin].every(finite)||bed.x<=0||bed.y<=0||bed.z<=0||margin<0||!Array.isArray(items))return {ok:false,reason:'Parámetros de cama inválidos',placements:null};
  const seen=new Set();
  const pieces=[];
  for(const p of items){
    if(!p||typeof p.id!=='string'||!p.id||seen.has(p.id)||![p.width,p.depth,p.height,p.rot].every(finite)||p.width<=0||p.depth<=0||p.height<=0)
      return {ok:false,reason:'Pieza o dimensiones inválidas o duplicadas',placements:null};
    seen.add(p.id);
    if(p.width>bed.x+.000001||p.depth>bed.y+.000001||p.height>bed.z+.000001)
      return {ok:false,reason:`${p.name||p.id} excede las dimensiones de la cama`,placements:null,failedId:p.id};
    pieces.push(p);
  }
  // Orden determinista: colocar primero las de mayor profundidad ayuda a evitar espacios perdidos.
  pieces.sort((a,b)=>b.depth-a.depth||b.width-a.width||a.id.localeCompare(b.id));
  let x=0,y=0,rowDepth=0;
  const placements={};
  for(const p of pieces){
    if(x+p.width>bed.x+.000001){x=0;y+=rowDepth+margin;rowDepth=0;}
    if(y+p.depth>bed.y+.000001)return {ok:false,reason:`Sin espacio para ${p.name||p.id}. Reduce piezas o usa otra cama.`,placements:null,failedId:p.id};
    placements[p.id]={x,y,rot:p.rot};x+=p.width+margin;rowDepth=Math.max(rowDepth,p.depth);
  }
  return {ok:true,placements};
}

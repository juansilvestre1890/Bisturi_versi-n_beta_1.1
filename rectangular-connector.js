// Conservadora: verifica solo variación positiva/negativa de volumen tras CSG.
export function assertRectangularVolumeChange({maleBefore,maleAfter,femaleBefore,femaleAfter,width,height,depth,clearance}){
  const vals=[maleBefore,maleAfter,femaleBefore,femaleAfter,width,height,depth,clearance];
  if(!vals.every(Number.isFinite)||width<=0||height<=0||depth<=0||clearance<=0)throw Error('Parámetros rectangulares inválidos.');
  if(maleBefore<=0||femaleBefore<=0||maleAfter<=0||femaleAfter<=0)throw Error('Volúmenes de piezas inválidos.');
  const added=maleAfter-maleBefore,removed=femaleBefore-femaleAfter;
  const approximate=width*height*depth;
  const minimum=Math.max(0.01,approximate*0.03);
  const maximum=(width+2*clearance)*(height+2*clearance)*(depth+clearance+2)*1.4;
  if(added<minimum||removed<minimum||added>maximum||removed>maximum)throw Error('El encastre rectangular no modificó correctamente los volúmenes; se conservaron las piezas originales.');
  return {added,removed,approximate,experimental:true};
}

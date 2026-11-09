// Geometría nominal y límites conservadores de una cola de milano extruida.
export function validateDovetailSpec({width,height,depth,clearance,taper}){
 const a=[width,height,depth,clearance,taper];
 if(!a.every(Number.isFinite)||width<2||width>40||height<2||height>40||depth<1||depth>40||clearance<.05||clearance>1||taper<.2||taper>10||2*taper>=width-2*clearance)throw Error('Perfil de cola de milano inválido: revisa ancho, alto, estrechamiento y holgura.');
 return {width,height,depth,clearance,taper};
}
export function dovetailOutline({width,height,taper}){
 if(![width,height,taper].every(Number.isFinite)||width<=0||height<=0||taper<0||2*taper>=width)throw Error('Trapecio inválido.');
 return [[-width/2,-height/2],[width/2,-height/2],[width/2-taper,height/2],[-width/2+taper,height/2]];
}
export function assertDovetailVolumeChange({maleBefore,maleAfter,femaleBefore,femaleAfter,width,height,depth,clearance,taper}){
 validateDovetailSpec({width,height,depth,clearance,taper});
 if(![maleBefore,maleAfter,femaleBefore,femaleAfter].every(Number.isFinite)||Math.min(maleBefore,maleAfter,femaleBefore,femaleAfter)<=0)throw Error('Volumen de encastre inválido.');
 const added=maleAfter-maleBefore,removed=femaleBefore-femaleAfter;
 const expected=(width-taper)*height*depth;
 // La cantidad real depende de cuánto intersectan ambas herramientas con las piezas.
 if(added<expected*.03||removed<expected*.03||added>expected*1.6||removed>(width+2*clearance)*(height+2*clearance)*(depth+clearance+2)*1.6)throw Error('La operación de cola de milano no modificó los volúmenes de forma plausible.');
 return {added,removed,expected,experimental:true};
}

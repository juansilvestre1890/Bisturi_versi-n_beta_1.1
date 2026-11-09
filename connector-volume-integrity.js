/** Etapa 27: comprobar que el CSG modificó volúmenes en la dirección esperada.
 * Es una comprobación geométrica preventiva, NO demuestra ajuste físico ni ausencia de autointersecciones.
 */
export function assertConnectorBooleanVolumeChanges({maleBefore,maleAfter,femaleBefore,femaleAfter,pegRadius,socketRadius,depth,clearance}){
  const values=[maleBefore,maleAfter,femaleBefore,femaleAfter,pegRadius,socketRadius,depth,clearance];
  if(values.some(v=>!Number.isFinite(v)))throw Error('Volúmenes o medidas no finitos en encastre.');
  if(maleBefore<=0||maleAfter<=0||femaleBefore<=0||femaleAfter<=0||pegRadius<=0||socketRadius<=pegRadius||clearance<0)
    throw Error('No es posible validar el cambio de volumen del encastre.');
  // En la implementación CSG actual el cilindro está centrado a 0.4 mm del plano.
  // La profundidad real que sobresale hacia la pieza opuesta es depth - 0.8 mm.
  const protrusion=depth-0.8;
  if(protrusion<0.2)throw Error('Profundidad insuficiente: el pasador apenas sobresale de la superficie cortada.');
  const nominalAdded=Math.PI*pegRadius**2*protrusion;
  const nominalRemoved=Math.PI*socketRadius**2*(depth+clearance+0.2);
  const added=maleAfter-maleBefore,removed=femaleBefore-femaleAfter;
  const minAdded=Math.max(1e-5,nominalAdded*0.10);
  const minRemoved=Math.max(1e-5,nominalRemoved*0.10);
  if(added<minAdded)throw Error('Encastre cancelado: el pasador no agregó suficiente volumen a la pieza.');
  if(removed<minRemoved)throw Error('Encastre cancelado: el alojamiento no retiró suficiente volumen de la pieza.');
  if(added>nominalAdded*1.5)throw Error('Encastre cancelado: el pasador agregó un volumen anormal.');
  if(removed>nominalRemoved*1.5)throw Error('Encastre cancelado: el alojamiento retiró un volumen anormal.');
  return {added,removed,nominalAdded,nominalRemoved,protrusion,experimental:true};
}

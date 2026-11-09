/** Verificación de las medidas nominales de un encastre cilíndrico.
 * La holgura especificada es RADIAL, por tanto se suma dos veces al diámetro del alojamiento.
 * No certifica el resultado de las operaciones booleanas CSG ni el espesor real de las paredes.
 */
export function inspectConnectorSpec({diameter, depth, clearance}){
  if (![diameter,depth,clearance].every(Number.isFinite) || diameter<=0 || depth<=0 || clearance<=0)
    throw Error('Diámetro, profundidad y holgura deben ser positivos y finitos.');
  const pegRadius=diameter/2, socketRadius=pegRadius+clearance;
  const socketDiameter=2*socketRadius;
  if (!(socketDiameter>diameter))throw Error('El alojamiento debe superar el diámetro del pasador.');
  return {pegDiameter:diameter,pegRadius,socketDiameter,socketRadius,radialClearance:clearance,diametralClearance:2*clearance,depth};
}
/** Comprobación conservadora del espacio axial total bajo el plano de corte.
 * No comprueba el grosor de pared en el punto seleccionado ni las colisiones internas.
 */
export function assertConnectorDepthFits({depth,clearance,maxDepth}){
  if (![depth,clearance,maxDepth].every(Number.isFinite) || depth<=0 || clearance<0 || maxDepth<=0)
    throw Error('No se pudo determinar el espacio disponible para el encastre.');
  // La cavidad CSG baja hasta profundidad + holgura + 0.20 mm bajo el plano.
  const requiredDepth=depth+clearance+0.2;
  if(requiredDepth>=maxDepth)
    throw Error(`Profundidad insuficiente en la pieza receptora: requiere ${requiredDepth.toFixed(2)} mm y dispone de hasta ${maxDepth.toFixed(2)} mm (estimación axial).`);
  return {requiredDepth,maxDepth,remaining:maxDepth-requiredDepth};
}

/** Conservador: los rayos se disparan desde el eje de cada alojamiento hacia la pared exterior.
 * Si no hay intersección comprobable, rechazamos el conector en vez de adivinar espesor.
 */
export function assertRadialWallSamples({distances,socketRadius,minimumWall=1.2}){
  if(!Array.isArray(distances)||distances.length<8||![socketRadius,minimumWall].every(Number.isFinite)||socketRadius<=0||minimumWall<=0)
    throw Error('No se pudo verificar el espesor local del alojamiento.');
  let shortest=Infinity;
  for(const distance of distances){
    if(!Number.isFinite(distance)||distance<=0)throw Error('Superficie no detectable alrededor del alojamiento: operación cancelada.');
    shortest=Math.min(shortest,distance);
    if(distance-socketRadius<minimumWall-1e-6)
      throw Error(`Pared demasiado delgada: espesor estimado ${(distance-socketRadius).toFixed(2)} mm; mínimo ${minimumWall.toFixed(2)} mm.`);
  }
  return {shortestDistance:shortest,minimumEstimatedWall:shortest-socketRadius,minimumWall,samples:distances.length};
}

/** Valida medidas radiales obtenidas DESPUÉS de construir las mallas CSG.
 * Cada muestra es la primera distancia desde el eje hasta una pared de la pieza.
 * Este control no certifica la profundidad total ni la tolerancia física de impresión.
 */
export function assertConnectorPostBooleanMeasurements({pegDistances,socketDistances,pegRadius,socketRadius,tolerance=0.15}){
  if(![pegRadius,socketRadius,tolerance].every(Number.isFinite)||pegRadius<=0||socketRadius<=pegRadius||tolerance<=0)
    throw Error('Medidas nominales inválidas para verificar el encastre generado.');
  const check=(values,expected,label)=>{
    if(!Array.isArray(values)||values.length<16)throw Error(`Muestras insuficientes para ${label}.`);
    let maxError=0,sum=0;
    for(const d of values){
      if(!Number.isFinite(d)||d<=0)throw Error(`No se pudo medir la pared de ${label}.`);
      const error=Math.abs(d-expected);maxError=Math.max(maxError,error);sum+=d;
      if(error>tolerance)throw Error(`${label}: desviación radial ${error.toFixed(3)} mm supera ${tolerance.toFixed(3)} mm.`);
    }
    return {averageRadius:sum/values.length,maxRadialError:maxError,samples:values.length};
  };
  const peg=check(pegDistances,pegRadius,'Pasador generado');
  const socket=check(socketDistances,socketRadius,'Alojamiento generado');
  return {peg,socket,tolerance,measuredRadialClearance:socket.averageRadius-peg.averageRadius};
}

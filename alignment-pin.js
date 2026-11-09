// Validación dimensional de pasadores desmontables: dos alojamientos opuestos.
export function validateAlignmentPinSpec({diameter,depth,clearance,count,depthPerSide=depth/2}){
  if(![diameter,depth,clearance,depthPerSide].every(Number.isFinite)||diameter<1||diameter>20||depth<2||depth>40||clearance<.05||clearance>.6||depthPerSide<1||depthPerSide>20||!Number.isInteger(count)||count<1||count>4)throw Error('Revisa las medidas de los pasadores de alineación.');
  return {pinDiameter:diameter,socketDiameter:diameter+2*clearance,socketDepthEachSide:depthPerSide};
}

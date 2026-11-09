import {analyzeMeshGeometry} from './mesh-quality.js';

/** Conservative, non-mutating topology check of operation inputs.
 * An acceptable topology is NOT a guarantee of printability.
 */
export function verifyOperationInput(geometry, label='Operación geométrica') {
  const result=analyzeMeshGeometry(geometry,{tolerance:1e-6,maxTriangles:4000000});
  if(!result.ok){
    const details=result.level==='unknown'?'no se puede verificar la topología por tamaño':
      `bordes abiertos=${result.boundary??'?'}, no manifold=${result.nonManifold??'?'}, orientación=${result.winding??'?'}, degenerados=${result.degenerate??'?'}, triángulos inválidos=${result.invalid??'?'}`;
    throw new Error(`${label} cancelado: la pieza de entrada no supera la comprobación (${details}). Se conserva intacta.`);
  }
  return result;
}

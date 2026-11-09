// Shared preview and CSG tool geometries. Three.js is injected so this module
// can be checked without creating a WebGL renderer.
import {dovetailOutline} from './dovetail-connector.js';

export function dovetailGeometry(THREE,width,height,depth,taper){
  const polygon=dovetailOutline({width,height,taper});
  const outline=new THREE.Shape();outline.moveTo(...polygon[0]);
  for(let i=1;i<polygon.length;i++)outline.lineTo(...polygon[i]);
  outline.closePath();
  const geometry=new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:false,curveSegments:1,steps:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,-depth/2,0);
  return geometry;
}

export function cylindricalGeometry(THREE,radius,height,segments=40){
  return new THREE.CylinderGeometry(radius,radius,height,segments,1,false);
}

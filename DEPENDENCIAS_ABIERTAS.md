# Dependencias abiertas de Bisturí 3D

## Integradas

- Mapbox Earcut (`earcut.js`, compartido por la app y el núcleo v2f): triangulación de tapas y agujeros. Licencia ISC incluida íntegra en `earcut-LICENSE`. El motor comprueba desviación de área y cierre del sólido; Earcut no certifica por sí solo todas las triangulaciones.
- Three.js 0.169.0: carga y visualización desde jsDelivr (módulos `+esm` con dirección completa, sin mapa de importaciones). Licencia MIT en https://github.com/mrdoob/three.js/blob/master/LICENSE. Los modelos permanecen en el navegador.

- three-mesh-bvh 0.9.18: aceleración opcional de rayos sobre mallas estáticas densas. Licencia MIT incluida en `three-mesh-bvh-LICENSE`; desactivada en esta versión: su módulo de jsDelivr arrastraría una segunda copia de Three.js. El árbol se construye en modo indirecto para no reordenar índices de caras. Si la biblioteca no carga, Three.js mantiene el raycast normal. La primera construcción puede tardar y consumir memoria en un teléfono.
- three-bvh-csg 0.0.17: motor de encastres experimentales, licencia MIT. Se carga desde jsDelivr (`+esm`) solo cuando se aplican encastres; si falla la red, la aplicación sigue disponible y muestra un error en esa operación. La versión 0.0.17 declara Three.js >=0.151.0 y three-mesh-bvh >=0.6.6 como dependencias de pares. No se distribuye su código en este paquete; licencia y fuente: https://github.com/gkjohnson/three-bvh-csg/blob/v0.0.17/LICENSE . La carga diferida no demuestra por sí sola que una operación CSG sea válida: se mantienen las comprobaciones posteriores de cierre y volumen.

## Evaluadas, aún no incorporadas
- Hunyuan3D 2.1 de Tencent: se estudió su flujo de generación de geometría y texturas, y los formatos de salida GLB/OBJ de su servicio. No se distribuye código, pesos ni modelos de Tencent. Su licencia comunitaria tiene condiciones y restricciones territoriales; la aplicación solo mejora la importación local de archivos OBJ con MTL e imágenes generados por cualquier herramienta.
- Manifold: Apache 2.0; candidato para operaciones futuras sobre sólidos, tras probar conservación de exterior, materiales y memoria en el FBX real.

Usar una biblioteca no sustituye la comprobación del corte exportado. Si más adelante se incluye código de otra biblioteca, se incluirá su licencia y atribución en el paquete.

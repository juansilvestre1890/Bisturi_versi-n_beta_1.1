# Bisturí 3D — Archivos para GitHub

## Interfaz nueva (6 de noviembre de 2026)

- **Pantalla de inicio**: logotipo, formatos admitidos, mascota y dos botones: «Nuevo proyecto» y «Abrir modelo 3D». Si ya hay un modelo abierto aparece además «Volver a la mesa de trabajo».
- **Mesa de trabajo**: barra superior (Guardar, Proyecto, Ajustes, Ayuda, Inicio), panel del proyecto, herramientas a la izquierda, barra vertical (seleccionar, mover, girar, escalar, encuadrar, explosión), vista 3D con Atrás/Rehacer/pantalla completa, ejes y altura del modelo, vistas fijas abajo y panel de piezas con acciones a la derecha.
- Ningún control se eliminó: `layout.js` mueve los controles originales (con sus ids) a los paneles de cada botón. Reparto actual:
  - Separación inteligente: herramientas exactas (partes sueltas, color, cama, agujeros) y modo Auto/Manual/Mixto.
  - Corte manual / Dividir pieza: corte por plano y panel del corte curvo o por región.
  - Selección (Pincel) y Varita mágica: toda la selección de superficies, corte magnético y «Cortar región marcada».
  - Encastres 3D / Agregar y Quitar encastre: formulario de encastres (para quitar uno ya aplicado se usa Atrás).
  - Gestionar piezas (y ⋮ de cada pieza): explosión, rayos X, centrar, camas de impresión, posición y giro.
  - Guardar / Exportar piezas: exportación de STL e informes.
  - Proyecto: nombre, Nuevo, Abrir, modelos de ejemplo, información, diagnóstico, revisión y reparación.
  - Ajustes: altura final y boquilla.
  - Unir piezas: une todas las piezas visibles en una sola malla (sin booleana).

## Pasadores y encastres exactos (6 de noviembre de 2026)

`encastre-exacto.js` sustituye a la operación booleana (three-bvh-csg) para todos los encastres sobre un corte por plano: cilíndrico, rectangular, cola de milano y pasadores de alineación desmontables. La cara del corte se vuelve a triangular dejando la huella de cada encastre como hueco, y se añade un prisma recto a lo largo de la normal (saliente en una mitad, alojamiento con holgura en la otra). Cada cuerpo de la pieza se trata por separado.

- Resultado cerrado por construcción; se comprueba igualmente (sin bordes abiertos) y el cambio de volumen debe coincidir con el del prisma (±2 %): si no, el encastre atravesaría la pieza y se cancela.
- Espesor de pared: se mide la distancia de puntos del alojamiento a la superficie original; por debajo del «Espesor mínimo» se cancela con la medida encontrada.
- La huella debe quedar dentro de la cara del corte, fuera de huecos y a una distancia mínima del borde.
- Pasadores desmontables: un alojamiento en cada mitad y un prisma suelto cerrado por pasador.
- Reparto automático: 2 en fila, 3 en triángulo, 4 en cuadrado.
- **Cola de milano deslizante** (ya no experimental): riel de sección trapezoidal en la mitad positiva (estrecho en la cara, ancho en la punta) y, en la negativa, un canal con la misma sección más holgura seguido de una entrada recta. Montaje: apoyar el riel en la entrada, bajar y deslizar hasta el tope. Campos: ancho máximo, largo del riel, estrechamiento por lado, altura (profundidad), holgura y dirección de deslizamiento.
- La posición de los encastres se calcula con la posición **actual** de cada mitad (el plano del corte se guarda también en coordenadas locales): aunque se haya movido una mitad, cada encastre cae en su sitio.
- Al terminar, la mitad positiva se separa a lo largo de la normal para que se vean pasadores y alojamientos (Atrás la vuelve a juntar).
- Vista previa: en ámbar lo que sobresale, en celeste el contorno del alojamiento. Tras aplicar, pasadores y alojamientos toman el color principal de su pieza.
- Modelos con partes superpuestas (figuras: cabeza, pelo, orejas, cuerpo como cuerpos separados que se meten unos en otros): el alojamiento se abre en todas las partes que cubren ese punto de la cara del corte; si alguna lo cubre solo a medias, se cancela con un aviso para moverlo. El pasador se añade a una de ellas.
- Contornos que se tocan en un vértice se recorren eligiendo el giro más cerrado.
- Aviso flotante sobre la vista 3D con el resultado de cada operación (en el móvil la línea de estado queda fuera de la pantalla). Si un encastre se cancela, se quita la vista previa para no confundirla con una pieza.
- Barrido automático (Node): figura de tres esferas superpuestas, guijarro y hongo, cortes en X, Y y Z al 20–80 %, pasador + alojamiento: 61 de 63 aplicados; los otros 2 se rechazan correctamente porque el alojamiento atravesaría la pieza.
- Corte por plano en la unión de dos cuerpos (p. ej. sombrero apoyado en el tallo): los cuerpos que solo tocan el plano pasan enteros a su lado, sin láminas finísimas; el área para encastres es la común a las dos caras.
- Área segura del corte: ahora es el punto de la sección más alejado de su contorno (antes, en el corte nuevo, el triángulo con mayor círculo inscrito, que la subestimaba).
- Probado en la app completa: guijarro (1 y 3 cilíndricos, cola de milano, 2 y 4 desmontables), hongo (cilíndrico y rectangular) y un modelo de 1,3 millones de triángulos con 2 pasadores.

## Manipulador centrado

El manipulador de mover, girar y escalar aparece en el centro de la pieza (centro de su caja), no en su origen. Se mueve un pivote invisible y la pieza sigue exactamente la misma transformación; así los giros y escalados se hacen alrededor del centro.

## Rendimiento con modelos grandes

- Vuelve a usarse three-mesh-bvh para acelerar los toques, el pincel y la varita (antes cada toque recorría todos los triángulos). Se carga con el mapa de importaciones de `index.html`, apuntando al mismo Three.js que la app, y también se construye para las piezas nuevas tras cada corte.
- Mientras se gira la vista o se mueve una pieza, la escena se dibuja con menos píxeles si el modelo supera 150 000 triángulos, y vuelve a la nitidez completa al soltar.
- Las estadísticas se actualizan una vez por fotograma como máximo al mover piezas.
- La comprobación topológica previa a cada operación (`mesh-quality.js`) se reescribió con arreglos tipados: 1,3 millones de triángulos en ~0,7 s. El límite pasó de 250 000 a 4 millones.
- El corte por plano usa el núcleo v2f siempre que la malla no tenga texturas ni colores de vértice, o tenga más de 250 000 triángulos: corta cada cuerpo por separado (sombrero y tallo del hongo, por ejemplo), conserva los materiales por grupos y, si la sección queda ambigua o con triángulos finísimos, desplaza el plano una fracción mínima. Con texturas se intenta primero el cortador original y, si no puede cerrar la sección, se usa el núcleo (sin texturas).
- `topologia` del núcleo usa una tabla hash con arreglos tipados (antes `Map`): el corte de 1,3 millones de triángulos bajó de ~11 s a ~6 s en Node.
- Probado con la app completa en Chromium (Three.js r169 real): hongo en X, Y y Z, modelo de ejemplo, guijarro y un STL de 1,3 millones de triángulos cortado dos veces.

## Fusión con la versión v2f (5 de noviembre de 2026)

Esta entrega une la versión GitHub (interfaz Three.js, camas, varita, cola de milano, informes) con el **núcleo geométrico de la v2f** (archivos `nucleo-*.js`, sin dependencias externas).

**Cortar región marcada** usa ahora por defecto el método **«Exacto por el borde marcado»**: separa las caras marcadas por sus aristas reales, sin tocar el exterior, y cierra cada contorno con una tapa interior compartida (plana, radial con meseta o con faldón). Cada pieza se comprueba como sólido cerrado y la suma de volúmenes debe coincidir con el original. La curva ajustada (cuádrica) sigue disponible en el mismo panel como «Curva ajustada a la selección (aproximada)», y la curva manual y la superficie guardada no cambian.

Con los cinco casos de la fase 2 del colaborador:

| Caso | Curva ajustada (antes) | Exacto (núcleo v2f) |
|---|---|---|
| control_casquete | cortado | cortado, 2 piezas cerradas |
| borde_ondulado | cortado, borde a 4,42 mm | cortado por el borde marcado |
| estrella | rechazado (55 %) | cortado |
| tres_lobulos | rechazado (19 %) | cortado (3 lóbulos + resto) |
| anillo | rechazado (56 %) | cortado |

En el método exacto el borde coincide con lo marcado por construcción; si hace falta cerrar una «punta» del borde (dos regiones que se tocan en un solo vértice) se añaden esas caras y se muestran en violeta en «Comparar con la selección». En mallas gruesas el borde sigue los triángulos, así que puede verse escalonado.

Nuevo bloque **Herramientas exactas (núcleo v2f)** en el panel izquierdo, sobre la pieza seleccionada:

- **Separar partes sueltas**: cada cuerpo no conectado como pieza propia.
- **Cerrar agujeros**: tapa los agujeros de un modelo abierto.
- **Dividir para que quepa en la cama activa**: planos automáticos según X × Y × Z de la cama activa; volumen comprobado.
- **Separar por color en piezas macizas**: usa los grupos de material o los colores de vértice; uniones internas a la resolución del vóxel (≈ 1,25 × boquilla).

Todas calculan en un Worker, se pueden cancelar y se deshacen con Deshacer. Las piezas nuevas no conservan texturas (igual que el corte curvo).

No se trajeron de la v2f su visor propio, la física de colisiones ni sus pines sin CSG: dependen de la interfaz de la v2f y aquí ya existen el movimiento con gizmo, las camas y los encastres (cilíndrico, rectangular, cola de milano y pasadores).

### Corrección automática del corte por región

Antes de cortar, la selección se limpia sola: se quitan islas sueltas pequeñas (menos del 10 % del área de la región mayor), se rellenan huecos pequeños y se ajustan las caras sueltas en diente del borde. Después, los vértices del contorno se deslizan sobre la superficie para quitar el borde en sierra (cambio de volumen típico < 0,01 %). Las piezas siguen comprobándose cerradas y con el volumen conservado. El resumen de la vista previa dice qué se corrigió, y «Comparar con la selección» muestra las caras añadidas o quitadas.

### Abrir archivos

«Abrir modelo 3D» acepta STL, 3MF, OBJ (con su MTL y texturas), FBX y GLB. El selector ya no filtra por extensión, porque en Android los .stl y .3mf aparecían bloqueados; si se elige otro formato, la app lo indica.

### Ejemplos

Junto a «Modelo de ejemplo» están los dos ejemplos de la v2f: **hongo de 3 colores** (para «Separar por color en piezas macizas») y **guijarro** (forma orgánica con una selección ya marcada, para probar «Cortar región marcada»).

### Archivos nuevos

- `ejemplos-v2f.js` — los dos modelos de ejemplo de la v2f.

- `nucleo-*.js` — núcleo de la v2f (malla, selección, tapa, corte, plano, colores, encastres, colisión, exportar, autocorrección). Todos los archivos de la app están sueltos en la raíz, sin carpetas, para poder subirlos desde el móvil.
- `nucleo-puente.js` — convierte una malla de Three.js al núcleo y devuelve el resultado con el formato del corte curvo.
- `nucleo-trabajador.js` / `nucleo-ui.js` — Worker y panel de las herramientas exactas.
- `tests/nucleo-v2f.test.mjs`, `tests/nucleo-puente.test.mjs`, `tests/nucleo-herramientas.test.mjs` (+ `tests/v2f/` y `tests/geometria-v2f.mjs` como datos de prueba).

### Pruebas

`node --test` desde la raíz ejecuta todas las suites (también la Action de GitHub): **52 pasan, 0 fallan, 4 `todo`**. Los cuatro `todo` de `fase2-casos.test.mjs` miden la curva ajustada, que sigue sin cumplirlos; el método exacto los cumple en `tests/nucleo-puente.test.mjs`. Los Workers se probaron en Chromium. Three.js se carga desde jsDelivr con direcciones completas (sin mapa de importaciones), lo que funcionó en la tableta donde esm.sh no cargaba. Si algo falla al arrancar, aparece un aviso rojo abajo con el error.


Entrega del 4 de noviembre de 2026. Basada en el código fuente versión 5 de esta conversación, con comprobación de tapa visible y trabajo temporal sin guardar/recuperar proyectos. No integra automáticamente los paquetes separados de otras conversaciones.

## Actualización del 5 de noviembre de 2026

Deshacer y Rehacer se muestran en la parte superior, también en iPhone. Para aplicar solo este cambio en un repositorio que ya contiene el paquete completo, reemplaza **index.html** y **styles.css** en la raíz. Los identificadores de los botones y sus manejadores en app.js permanecen iguales.

## Actualizar desde iPhone

1. Descarga el ZIP y descomprímelo en Archivos.
2. Abre tu repositorio en Safari. En Add file → Upload files, selecciona los archivos descomprimidos de la raíz y confirma la actualización. Si no aparece el menú, solicita la versión de escritorio.
3. Conserva la carpeta vendor y sus archivos. Si el selector no permite subir carpetas, entra en vendor dentro del repositorio y sube allí su contenido. No pongas earcut.js en la raíz.
4. index.html debe quedar en la raíz publicada, junto a app.js, styles.css, manifest.webmanifest y todos los demás módulos. No subas solamente el ZIP: GitHub Pages no lo descomprime.
5. Si Pages ya publica desde main y / (root), conserva esa configuración. Si aún no está configurado, utiliza Settings → Pages → Deploy from a branch, selecciona tu rama y / (root).
6. Abre la dirección de Pages cuando termine la publicación y recarga Safari. El ZIP descargado no ejecuta la aplicación directamente.

No requiere npm ni compilación. Requiere conexión para cargar Three.js desde jsDelivr. Las rutas locales son relativas para funcionar bajo el nombre de tu repositorio. No se han publicado cambios automáticamente.

Los encastres usan three-bvh-csg 0.0.17 desde esm.sh solo al pulsar «Agregar pasador y alojamiento». Si falla esa descarga, la aplicación continúa cargada, muestra un aviso y deja sin aplicar los encastres. La vista previa de cola de milano y las herramientas cilíndricas comparten geometrías corregidas; aún se deben comprobar encastres reales en Safari y en el laminador.

## Qué contiene

Todos los módulos de ejecución, Worker de selección, Worker de corte, CSS, HTML, manifest y triangulador local con su licencia. INVENTARIO.txt enumera los archivos. No contiene tus modelos, texturas privadas, STL de prueba ni archivos temporales. Conserva cualquier CNAME propio de tu repositorio si utilizas dominio personalizado.

## Continuación: ajuste automático de la selección

El motor compara seis desplazamientos cercanos de la superficie y solo intenta una alternativa si mejora la coincidencia por área. La alternativa debe superar las comprobaciones geométricas; si falla, vuelve al ajuste original. Se conserva la revisión visual antes de confirmar.

En el FBX real, la coincidencia pasa de 89,0791 % a 89,3023 % (+0,2232 puntos). Se recuperan 7.640 caras marcadas que antes quedaban fuera, pero entran 5.836 caras no marcadas adicionales: es una mejora del indicador global, no coincidencia exacta. A tiene 713.160 triángulos y dos componentes; B tiene 810.788 triángulos y uno. El informe numérico está en INFORME_AJUSTE.json. La alternativa se elige con 1.199.836 triángulos y se evalúa también en 299.960 triángulos reservados. En esta muestra la coincidencia por área pasa de 89,0663 % a 89,2658 %. Es validación de este ajuste en este modelo, no garantía de otros contornos ni porcentaje de desarrollo.

Se verificó el retorno al ajuste original mediante un fallo simulado del candidato. Ambos nuevos STL se exportaron y reabrieron con VTK sin aristas abiertas o no manifold. La comprobación visual en iPhone continúa pendiente.

## Estado comprobado de la entrega base

La corrección interior de tapa pasó 47 comprobaciones automatizadas en la entrega base. El caso real generó mallas de 698.976 y 823.736 triángulos, reabiertas como STL sin aristas abiertas o no manifold. A tiene dos componentes y B uno. Se verificaron 25.916 muestras. En esta preparación se comprobó sintaxis de todos los módulos y presencia de las dependencias locales.

La fase 2 sigue abierta: el ajuste a la selección coincide por área en 89,1 % en ese ensayo; faltan contornos más fieles, preservación UV/materiales de piezas cortadas y validación visual completa en Safari/iPhone. No se garantiza imprimibilidad de cualquier modelo. No se ha probado esta publicación en tu dispositivo.

## Sesión temporal

No hay guardado ni recuperación de proyectos, autoguardado o historial persistente. Deshacer/Rehacer funciona solo en memoria. Al cerrar o recargar, los cambios se pierden. Descarga las piezas o informes que quieras conservar antes de cerrar o recargar. El aviso al salir solo recuerda esta pérdida; no guarda datos.

El botón «Descargar informe general» reúne el resumen del trabajo y el diagnóstico topológico de cada malla en un solo TXT. «Comprobar piezas» sigue mostrando la revisión en pantalla. El informe de camas y la comprobación del corte curvo siguen siendo descargas independientes.

## Documentación oficial

- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

La lista de código abierto utilizado y evaluado está en `DEPENDENCIAS_ABIERTAS.md`.

La selección táctil en mallas densas usa opcionalmente three-mesh-bvh 0.9.18; requiere conexión a esm.sh y conserva el método normal si la carga falla. Una prueba con Three.js 0.169 comparó cara y punto antes/después en malla indexada y no indexada; el rendimiento en iPhone no está medido.

## Modelos generados con Hunyuan3D

En la web de Tencent, descarga preferentemente un GLB y ábrelo con «Abrir modelo 3D». Si descargas OBJ, selecciona **juntos** el OBJ, un MTL y las imágenes de textura asociadas en el mismo selector. Solo se admite un modelo y un MTL en cada importación. Las imágenes se enlazan por nombre de archivo, permanecen locales y se liberan de la memoria temporal al terminar su carga. Si faltan imágenes, el modelo puede abrirse sin parte de sus texturas.

Antes de cortar, revisa «Diagnóstico al importar». La geometría generada por IA puede tener bordes abiertos o piezas separadas; el aspecto visual no acredita un sólido imprimible. Esta integración no ejecuta el modelo generativo de Tencent ni incluye sus pesos o código. La disponibilidad del servicio gratuito y los derechos sobre sus resultados se rigen por las condiciones de Tencent, que deben consultarse para cada uso. El STL exportado no conserva las texturas del OBJ/GLB.

## Fase 2: apariencia del corte por plano

El corte por plano conserva UV, UV adicionales, colores de vértices y grupos de materiales exteriores. Interpola los atributos en los nuevos vértices; añade un material independiente para la tapa. Las normales se recalculan, por lo que el sombreado puede variar respecto al original. Una comprobación con una caja de seis materiales verificó ambas mitades y las UV interpoladas en el borde. No se ha comprobado visualmente una textura real en Safari. El corte curvo sigue pendiente de conservación de atributos; esta mejora no cierra toda la fase 2. El STL exportado continúa sin texturas.

En la intersección del corte plano, los vértices a una distancia menor o igual que la tolerancia se llevan al plano antes de construir los segmentos y recortar las dos mitades. El contorno y la geometría lateral comparten así la misma clasificación. También se incluyen en el contorno las aristas completas que coinciden con el plano. Una prueba con una caja verificó en dos posiciones (junto a un vértice y sobre una arista) el contorno cerrado, dos caras por arista y la conservación de volumen. Si una cara entera coincide con el plano, el programa pide mover el corte; las intersecciones curvas degeneradas todavía requieren tratamiento adicional.

El corte curvo usa los vértices de valor cero como puntos del contorno y reconoce una arista coincidente cuando sus dos caras vecinas quedan en lados opuestos. Si la distancia del cruce a un vértice es menor que la resolución Float32 local y que una fracción limitada del tamaño del modelo, reutiliza ese vértice; si un cruce no representable escapa a ese margen, solicita mover ligeramente el corte. Una prueba con caja verificó cortes ordinarios, por vértice, por arista y casi coincidentes con vértice, con piezas cerradas y volumen conservado. Las caras enteras coincidentes y otros contactos tangentes o degenerados todavía requieren tratamiento adicional.

En superficies cuadráticas se revisan los extremos interiores de todas las aristas, también las de caras cuyos vértices quedan del mismo lado. Una tangencia o un doble cruce en una arista se detecta antes de construir las tapas y solicita desplazar o subdividir el corte. Una prueba con caja verificó ambos rechazos junto a los cortes válidos anteriores. Este control impide aceptar un contorno ambiguo; aún no subdivide automáticamente esa zona.

## Casos reproducibles de la fase 2

Se incorporaron cinco STL pequeños con máscaras de selección, huellas, generador determinista y una suite en `tests/` aportados por el colaborador. Ejecuta `node --test tests/fase2-casos.test.mjs` desde la raíz, sin instalar dependencias. La misma orden figura en `.github/workflows/pruebas.yml` para ejecutarse al subir los archivos al repositorio. En esta versión: 12 verificaciones pasan, 0 fallan como regresión y 4 figuran como `todo` porque representan objetivos aún incumplidos. El control de casquete sí se corta. El borde ondulado se corta pero se aleja 4,42 mm de la selección; estrella, tres lóbulos y anillo se rechazan por coincidencia insuficiente. Un proceso verde en GitHub indica que no se rompió el estado conocido, no que estos cuatro objetivos estén terminados.

La medida de distancia del caso aportado interpola el cruce de la cuádrica en aristas y su criterio principal va del borde marcado al contorno obtenido. Es una referencia reproducible, no una certificación exacta ni bidireccional. El siguiente trabajo de la fase 2 es cortar por el borde real de la selección, comprobar la tapa interior y ampliar después a múltiples bucles y agujeros. No se elevan todavía los límites de mallas grandes solo porque estos modelos pequeños pasen la suite.

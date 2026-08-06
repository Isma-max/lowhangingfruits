# Decisiones técnicas

Este documento explica exactamente cómo se calcula cada medición y por qué se
tomó cada decisión técnica no trivial. Todas las decisiones aquí son
reversibles; se documentan para que puedan revisarse o cambiarse con
criterio, no porque sean definitivas.

## Contexto de esta implementación

Este código fue escrito por un agente en un contenedor Linux sin Xcode, sin
simulador de iOS y sin toolchain de Swift instalado (no hay forma de
compilar, ejecutar ni probar en dispositivo nada de lo que toca
SwiftUI/ARKit/SwiftData). Se intentó instalar un toolchain de Swift para
Linux para al menos poder correr los tests del paquete `VisionMVPCore`
(lógica pura, sin dependencias de Apple) con `swift test`, pero
`download.swift.org` está bloqueado por la política de red del entorno
(rechazo HTTP 403 a nivel de gateway) y no hay Docker disponible como
alternativa. Como resultado:

- **`VisionMVPCore`** (toda la matemática: distancia, pose, calidad,
  estadística por ventana, escalado del estímulo, staircase, CSV/JSON) tiene
  tests unitarios completos escritos, pero **no se han ejecutado nunca** —
  fueron revisados a mano, con trazas numéricas completas para los casos más
  delicados (extracción de ángulos de Euler, la secuencia del staircase).
  Son ejecutables con `swift test` en un Mac sin necesidad de abrir Xcode.
- **El target de la app** (SwiftUI, ARKit, SwiftData, CoreMotion) no se ha
  compilado nunca. El uso de cada API de Apple se basa en conocimiento
  documentado, no en verificación en este entorno.

**Antes de usar esto para el experimento real, ábrelo en Xcode 15+ en un Mac,
corrígelo hasta que compile, y valida el módulo de distancia contra una
cinta métrica o medidor láser en los hitos de 20–80cm — que es exactamente
para lo que se diseñó ese módulo.**

## Medición de distancia

`FaceTrackingSession` corre `ARFaceTrackingConfiguration` (requiere
TrueDepth). En cada `ARSessionDelegate.session(_:didUpdate:)`:

- **Distancia cámara–rostro** = norma euclidiana entre la traslación de
  `ARFrame.camera.transform` (pose de la cámara en el espacio "world" de
  ARKit, en metros) y la traslación de `ARFaceAnchor.transform` (pose del
  ancla facial, mismo espacio). Esta es la transformación métrica real que
  entrega ARKit — no landmarks 2D ni coordenadas normalizadas.
- **Distancia a cada ojo** = se compone `faceAnchor.transform *
  faceAnchor.leftEyeTransform` (e ídem `rightEyeTransform`) para llevar la
  transformación del ojo, que Apple documenta como relativa al ancla facial,
  a espacio mundo, y luego se aplica la misma resta que para el rostro.
- **Distancia media entre ojos** = promedio simple de las dos distancias
  anteriores.

Toda esta matemática vive en `VisionMVPCore` (`DistanceCalculator`,
`Matrix4x4`, `Vector3`) sin depender de `simd` ni de ningún framework de
Apple, para poder testearla con un Swift plano. El puente
`simd_float4x4 -> Matrix4x4` vive únicamente en
`VisionDistanceMVP/Tracking/SIMDBridging.swift`.

**Limitación conocida, no corregida en esta v1**: la cámara TrueDepth no
está exactamente en el centro de la pantalla; hay un offset físico de pocos
milímetros. No se corrige. Para el rango de 20–80cm este error es pequeño en
términos relativos, pero debe cuantificarse empíricamente con el propio
módulo de caracterización antes de tratar la medición como precisa.

## Pose (yaw / pitch / roll)

`PoseCalculator.eulerAngles(from:)` extrae ángulos de Euler Tait-Bryan
(orden ZYX: `R = Rz(roll) · Ry(yaw) · Rx(pitch)`) de la parte rotacional de
`ARFaceAnchor.transform`. La fórmula de extracción se verificó
matemáticamente construyendo rotaciones conocidas con matrices elementales
independientes y comprobando que se recuperan los mismos ángulos
(`PoseCalculatorTests.swift`) — pero **el mapeo de signo/eje a "girar la
cabeza a la derecha = yaw positivo" no se ha verificado en un dispositivo
real**. Antes de confiar en el signo para análisis, gira la cabeza a la
derecha frente al teléfono y confirma que el yaw mostrado en pantalla
coincide con lo esperado; si no, es un ajuste de signo trivial en
`PoseCalculator`.

Cerca de yaw = ±90° hay *gimbal lock* (pitch y roll se acoplan); el gate de
calidad ya descarta yaw/pitch fuera del umbral configurado (por defecto
±20°), muy lejos de esa zona.

## Calidad del tracking

Solo se usan señales que ARKit expone públicamente — no se inventa un
"score de confianza":

- `ARFaceAnchor.isTracked` (bool).
- `ARCamera.trackingState`: `.normal` / `.limited(reason)` / `.notAvailable`.

El gate de calidad (`TrackingQualityEvaluator`) evalúa, en este orden
exacto (el mismo orden en que aparecen en el encargo, sección 7):

1. Rostro no detectado (`isFaceTracked == false`, o `trackingState`
   `.limited`/`.notAvailable`, agrupados bajo el mismo motivo raíz: sin
   medición métrica fiable posible).
2. Yaw o pitch excesivos (umbral configurable).
3. Medición inestable (desviación estándar de la ventana de 1s por encima de
   un umbral configurable).
4. Demasiados frames perdidos (ratio de frames inválidos en una ventana
   configurable).
5. Distancia fuera de rango (umbral configurable).
6. Ojos parcialmente fuera de cuadro (proyección 3D→2D de cada ojo vía
   `ARCamera.projectPoint`, comprobada contra los límites de
   `UIScreen.main.bounds` con un margen).

Un frame inválido siempre conserva su motivo de descarte — nunca se
descarta en silencio (`DistanceFrameRecord.discardReason`).

## Iluminación y brillo

- **Brillo de pantalla**: `UIScreen.main.brightness` (0–1, fuente: sistema).
  Es una lectura real y pública.
- **Brillo automático**: iOS **no** expone una API pública para leer si el
  brillo automático está activado. Se registra explícitamente como "no
  disponible" (`autoBrightnessStateKnown = false`) — nunca se adivina.
- **Luz ambiental**: se usa `ARFrame.lightEstimate?.ambientIntensity`
  (lúmenes), la estimación de iluminación que ARKit calcula para renderizado
  realista de contenido AR. Es una API real y documentada de Apple, pero
  **no es un fotómetro calibrado** — se etiqueta explícitamente como
  estimación no calibrada, en lúmenes, con ese origen, tanto en la UI como
  en el JSON exportado (`ambientLightProxyUnit`).

## Tamaño angular y reescalado del estímulo

iOS no expone el tamaño físico de la pantalla en milímetros. Se usa
`DeviceScreenGeometry`, una tabla fija `identificador de modelo (ej.
"iPhone15,2") -> ancho/alto físico en mm`, calculada como
`píxeles_de_resolución / ppi × 25.4` a partir de la resolución y densidad de
píxeles publicadas por Apple para cada modelo con TrueDepth (iPhone X en
adelante) — no de las dimensiones externas del case (que incluyen bisel) ni
de una cifra vaga de pulgadas diagonales. Los pares resolución/ppi se
verificaron por búsqueda web durante el desarrollo (no son solo memoria del
modelo); aun así, **esta tabla no ha sido verificada contra hardware real y
quedará desactualizada para modelos lanzados después de escribirse este
archivo**. Antes de confiar en el tamaño angular para análisis, verifica al
menos un modelo contra las especificaciones oficiales de Apple
(support.apple.com) o con un calibre físico, y añade cualquier modelo nuevo
a la tabla.

Con eso:

- `StimulusScaler.physicalSizeMillimeters(targetAngularSizeArcMinutes:
  distanceMeters:)` calcula el tamaño físico (mm) para mantener un tamaño
  angular objetivo — usa la fórmula exacta (`2·d·tan(θ/2)`), no la
  aproximación de ángulo pequeño, porque a 20cm el error de la aproximación
  ya no es despreciable.
- `ScreenGeometryHelper.pointsForMillimeters(_:)` convierte mm a puntos de
  SwiftUI usando el ancho de pantalla *en vivo* (`UIScreen.main.bounds.width`,
  en puntos) dividido por el ancho físico de la tabla — así el cálculo
  respeta automáticamente el ajuste de "Zoom" de accesibilidad del usuario
  (que cambia puntos por pantalla física sin cambiar el tamaño físico real).
- Si el modelo no está en la tabla, se usa una razón puntos/mm aproximada de
  respaldo (documentada como tal) y `SessionRecord.hasKnownScreenGeometry =
  false` queda registrado para que ese dato se pueda filtrar después.

## Optotipo: anillo de Landolt

Se dibuja como una `Shape` vectorial de SwiftUI (proporción estándar: hueco
= grosor del trazo = 1/5 del diámetro exterior), no con una fuente de
letras — da control geométrico exacto del tamaño físico y evita depender de
licencias de fuente. La orientación del hueco (`GapOrientation`, 8
alternativas) se define en `VisionMVPCore` en términos de brújula (0° =
arriba, sentido horario) y se convierte al ángulo de `Path.addArc` de
SwiftUI dentro de `LandoltCShape`.

**No verificado visualmente en pantalla** (este entorno no puede renderizar
SwiftUI): la correspondencia exacta entre `GapOrientation.up` y "el hueco se
ve arriba" no está confirmada. Esto **no afecta la validez científica**: la
misma `LandoltCShape` se usa tanto para dibujar el estímulo como para
construir los botones de respuesta (`GapDirectionResponsePad`), así que el
puntaje correcto/incorrecto es internamente consistente pase lo que pase.
Haz una comprobación visual rápida la primera vez que corras la app en un
dispositivo y ajusta el offset en `LandoltCShape.swift` si el hueco no
aparece donde dice la etiqueta.

## Protocolo psicofísico (staircase)

`StaircaseController` implementa un staircase simple 1-arriba/1-abajo (el
tamaño baja tras un acierto, sube tras un error, con el paso reduciéndose a
la mitad en cada reverso hasta un mínimo configurable). Converge cerca del
punto de ~50% de aciertos. **No es un protocolo psicofísico clínicamente
validado** — es una simplificación deliberada y documentada, adecuada para
un estudio de viabilidad con 30–40 personas, no para generar un umbral
clínico definitivo.

## Estructura de las cuatro sub-pruebas del módulo de test visual

- **Basal a distancia fija** (`staticBaseline`): el participante sostiene el
  teléfono a una distancia estable; el staircase controla el **tamaño
  físico** (mm) directamente. Es la variable "simple" de comparación
  (objetivo #4 del encargo).
- **Dinámica, ángulo constante** (`dynamicConstantAngularSize`) y
  **dinámica, tamaño fijo** (`dynamicFixedPhysicalSize`): el participante
  mueve el teléfono libremente; la app no controla la distancia (la controla
  la mano del participante), así que aquí **no hay staircase** — se
  presentan ensayos de elección forzada repetidos, registrando en cada uno
  la distancia real en ese instante. Comparar ambos modos entre sí es lo que
  responde el objetivo #3 ("¿qué ocurre si el estímulo cambia de tamaño?").
- **Cruce claro/borroso** (`blurCrossing`): estímulo de tamaño fijo, el
  participante marca con un toque el instante en que su percepción cruza
  entre claro y borroso mientras mueve el teléfono, con la trayectoria
  completa de distancia registrada en paralelo (reutilizando
  `DistanceRunRecorder`, el mismo pipeline del módulo de distancia).
  Responde al objetivo #2.

## Por qué no se genera un .xcodeproj a mano

No hay Xcode ni forma de verificar que un `project.pbxproj` escrito a mano
abra correctamente (es un formato frágil y fácil de corromper sin poder
probarlo). En su lugar, `project.yml` es una especificación de
[XcodeGen](https://github.com/yonaskolb/XcodeGen); correr `xcodegen
generate` en un Mac produce un `.xcodeproj` válido de forma determinista.

## Por qué no se genera un .zip al exportar

No hay una API pública de compresión ZIP sencilla y sin dependencias en
Foundation. En vez de eso, `ExportManager` comparte los archivos sueltos
(CSV/JSON) a través de la hoja de compartir nativa de iOS
(`ShareLink(items:)`), que ya maneja múltiples archivos (AirDrop, Files,
Correo, etc.). El investigador puede comprimirlos después si lo necesita.

## Persistencia

SwiftData (`Participant`, `SessionRecord`) para metadatos estructurados de
baja frecuencia; archivos CSV/JSON sueltos en
`Documents/Sessions/<sessionID>/` para datos de alta frecuencia (frames de
ARKit a 30–60Hz) y de ensayo. `ModelConfiguration(cloudKitDatabase: .none)`
explícito para garantizar que nunca hay sincronización remota, sin depender
de que el proyecto de Xcode no tenga casualmente capacidades de CloudKit
activadas.

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
licencias de fuente. La orientación del hueco (`GapOrientation`) se define
en `VisionMVPCore` en términos de brújula (0° = arriba, sentido horario) y
se convierte al ángulo de `Path.addArc` de SwiftUI dentro de
`LandoltCShape`. El tipo sigue soportando 8 alternativas, pero desde Fase 1
las pantallas de test (`StaticBaselineTrialView`, `DynamicTrialView`) solo
usan `GapOrientation.cardinalDirections` (arriba/abajo/izquierda/derecha)
— el encargo pide reducir a 4 para la fase de estabilización, y mantener las
8 en el tipo (en vez de eliminarlas) deja la puerta abierta a usarlas de
nuevo sin tocar el esquema de datos.

**No verificado visualmente en pantalla** (este entorno no puede renderizar
SwiftUI): la correspondencia exacta entre `GapOrientation.up` y "el hueco se
ve arriba" no está confirmada. Esto **no afecta la validez científica**: la
misma `LandoltCShape` se usa tanto para dibujar el estímulo como para
construir los botones de respuesta (`GapDirectionResponsePad`), así que el
puntaje correcto/incorrecto es internamente consistente pase lo que pase.
Haz una comprobación visual rápida la primera vez que corras la app en un
dispositivo y ajusta el offset en `LandoltCShape.swift` si el hueco no
aparece donde dice la etiqueta.

### Altura total vs. detalle crítico (MAR)

`physical_size_mm`/`angular_size_arcmin` (esquema v1) representaban el
**diámetro total** del anillo, no el detalle crítico — la auditoría de Fase 0
(`CURRENT_STATE_AUDIT.md`) identificó que esto llevaba a confundir el ángulo
total con el MAR, exactamente lo que el encargo advierte no asumir. Desde
Fase 1, `OptotypeGeometry` separa ambos explícitamente:

```
detalle_crítico_mm = altura_total_mm / 5
```

y `StimulusScaler.measurement(totalHeightMillimeters:distanceMeters:)`
calcula, en un solo lugar probado por tests, tanto el ángulo de la altura
total como el ángulo del detalle crítico — este último es el que
corresponde al MAR:

```
MAR_arcmin = ángulo_angular(detalle_crítico_mm, distancia_m)
logMAR = log10(MAR_arcmin)
```

`vision_trials.csv` (esquema v2, ver más abajo) exporta ambos ángulos por
separado, nunca uno en lugar del otro.

## Protocolo psicofísico (staircase)

`StaircaseController` implementa un staircase N-abajo/M-arriba genérico: el
tamaño baja tras `correctsRequiredToDecrease` aciertos consecutivos, sube
tras `incorrectsRequiredToIncrease` errores consecutivos, con el paso
reduciéndose a la mitad en cada reverso hasta un mínimo configurable. El
valor por defecto de estos dos parámetros es **2-abajo/1-arriba** (converge
cerca del 70.7% de aciertos), tal como pide el encargo de Fase 2 Test A —
1-abajo/1-arriba (converge cerca del 50%) sigue disponible pasando
`correctsRequiredToDecrease: 1` explícitamente, y así quedaron los tests que
ya existían antes de este cambio. **Sigue sin ser un protocolo
psicofísico clínicamente validado más allá de esta elección de N/M** —
la calibración fina contra un examen profesional es trabajo de Fase 4.

## Demanda acomodativa

`AccommodativeDemand.diopters(distanceMeters:)` implementa
`D = 1 / distancia_m` tal cual la especifica el encargo, sin ningún ajuste
por vergencia u otro refinamiento óptico. Se calcula y exporta por ensayo en
`vision_trials.csv` (columna `accommodative_demand_d`).

## Versionado

`InstrumentVersions` (en `VisionMVPCore`) centraliza `protocolVersion` y
`geometryVersion`; `StaircaseConfiguration.algorithmIdentifier` deriva el
identificador del algoritmo (p. ej. `"2down1up"`) directamente de la
configuración usada en cada corrida, en vez de vivir como una constante
separada que podría desincronizarse. Los tres valores se exportan por fila
en `vision_trials.csv`. Esto es deliberadamente mínimo (no hay todavía
versión de calibración de pantalla, porque `DisplayCalibrationService` aún
no existe — ver `CURRENT_STATE_AUDIT.md` §5, decisión pendiente #9) y se
ampliará cuando se agregue.

## Gating de estabilidad y de calidad en los ensayos de agudeza

Antes de Fase 1, ni `StaticBaselineTrialView` ni `DynamicTrialView` verificaban
nada sobre la distancia o la calidad del tracking antes de aceptar una
respuesta — el CSV de la primera prueba en dispositivo reflejó esto
directamente (sesión etiquetada `static_baseline` con distancia variando
44.6–69.8cm). Desde Fase 1:

- **`StaticBaselineTrialView`** exige 38–42cm sostenidos durante ≥500ms
  antes de presentar cada ensayo (`handle(_:)`); si el participante sale de
  ese rango mientras el estímulo está en pantalla, la vista vuelve a
  "settling" sin puntuar ese ensayo. La distancia objetivo (40cm) y la
  tolerancia (±2cm) son constantes en el archivo, ajustables si el piloto
  clínico sugiere otro rango.
- Ambas vistas ahora corren un `DistanceRunRecorder` durante toda la prueba
  (no solo un punto de distancia por respuesta), y solo un ensayo cuyo
  `recorder.latestFrame?.valid == true` en el instante de la respuesta
  alimenta el staircase o se cuenta hacia el resultado — un ensayo con mala
  calidad de tracking se sigue registrando (con `valid = false` y
  `discard_reason`), nunca se descarta en silencio, pero tampoco puede mover
  el umbral.
- La trayectoria completa de cada corrida se exporta como un CSV compañero
  (`distance_frames_static_baseline.csv`,
  `distance_frames_dynamic_constant_angular.csv`,
  `distance_frames_dynamic_fixed_physical.csv`), reutilizando el mismo
  esquema `DistanceFrameRecord` que ya usaban el Módulo de Distancia y el
  cruce claro/borroso.

## Rendimiento: publicación de `DistanceRunRecorder`

`frames` dejó de ser `@Published` (una corrida larga puede acumular miles de
filas; nada necesita actualizarse en vivo desde el arreglo crudo). `liveStats`
sigue siendo `@Published` pero ahora se publica como máximo cada 100ms
(~10Hz) en vez de en cada frame de ARKit (~30-60Hz) — el gating de calidad
por frame (`latestFrame`, usado por las vistas de ensayo para decidir
validez) no se ve afectado por este throttling, solo la UI en vivo.

## Estructura de las cuatro sub-pruebas del módulo de test visual

- **Basal a distancia fija** (`staticBaseline`): el participante sostiene el
  teléfono a una distancia estable (con gating activo desde Fase 1, ver
  arriba); el staircase controla la **altura total** del anillo (mm)
  directamente. Es la variable "simple" de comparación (objetivo #4 del
  encargo).
- **Dinámica, ángulo constante** (`dynamicConstantAngularSize`) y
  **dinámica, tamaño fijo** (`dynamicFixedPhysicalSize`): el participante
  mueve el teléfono libremente; la app no controla la distancia (la controla
  la mano del participante), así que aquí **no hay staircase** — se
  presentan ensayos de elección forzada repetidos, registrando en cada uno
  la distancia real en ese instante. Comparar ambos modos entre sí es lo que
  responde el objetivo #3 ("¿qué ocurre si el estímulo cambia de tamaño?").
  Nota: esto todavía no es el "Test B: punto próximo dinámico" completo del
  nuevo encargo (recorrido con marca de borroso/claro + verificación +
  histéresis) — eso vive en `BlurCrossingTrialView`, pendiente de
  reescritura (`CURRENT_STATE_AUDIT.md` §5, decisión pendiente #4).
- **Cruce claro/borroso** (`blurCrossing`): estímulo de tamaño fijo, el
  participante marca con un toque el instante en que su percepción cruza
  entre claro y borroso mientras mueve el teléfono, con la trayectoria
  completa de distancia registrada en paralelo (reutilizando
  `DistanceRunRecorder`, el mismo pipeline del módulo de distancia).
  Responde al objetivo #2. **Sin cambios en esta entrega** — sigue sin el
  paso de "verificación mediante optotipo aleatorio" que pide el protocolo
  completo de Test B; ver decisión pendiente #4 en el audit.

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

---

# Iteración: simplificación a un único test de 60 segundos

## Causa raíz del estado permanente `too_many_dropped_frames`

En `DistanceRunRecorder.ingest(_:)` (archivo ya eliminado), el ratio de
"frames perdidos" se calculaba sobre la **validez de calidad** de los frames
de la ventana móvil de 2s — no sobre discontinuidades reales de timestamps.
Consecuencia: los ~0,88s de movimiento inestable marcaron >30% de la ventana
como inválida; a partir de ahí, cada frame nuevo se evaluaba con
`recentFrameLossRatio > 0.30` → se marcaba `too_many_dropped_frames` → ese
mismo frame inválido entraba a la ventana → el ratio se mantenía en 100%
para siempre. Un bucle de retroalimentación positiva sin salida, confirmado
por la evidencia del CSV: 49,21s de "dropped frames" mientras ARKit seguía a
~60fps con tracking normal y rostro detectado al 99,8%.

Efecto en cascada: desde Fase 1, un ensayo cuyo frame estaba inválido no
alimentaba la escalera. Con todos los frames inválidos, la escalera nunca
avanzó (la figura no cambiaba de tamaño) y nunca convergió (el test no
terminaba). Los tres síntomas reportados tienen esta única causa.

## Corrección

- Los dropped frames reales se detectan ahora **solo** por timestamps:
  `FrameTimingTracker` (gap > 100ms = drop real; fps efectivo sobre ventana
  móvil de 2s). Un frame que llegó pero midió fuera de rango o inestable
  jamás cuenta como "perdido" — se exporta con `inside_distance_range` /
  `measurement_stable` como columnas booleanas separadas de `valid`.
- La lógica del test vive en `VisionTestEngine` (VisionMVPCore/Engine/), una
  máquina de estados pura y determinista: positioning → countdown → stimulus
  ⇄ paused → finished. Sin estado acumulativo desde el inicio de sesión: la
  calidad se evalúa frame a frame y con ventanas móviles, y salir del rango
  entra a `paused` con recuperación automática (500ms estables) conservando
  nivel, aciertos y reversiones. Nunca hay estado atrapado: toda ruta tiene
  salida por uno de los seis criterios de término.

## Definición única de distancia óptica

`viewing_distance_m` = distancia euclidiana desde el origen de
`ARFrame.camera.transform` (la cámara TrueDepth, que es el origen de medición
de ARKit) hasta el punto medio de ambos ojos
(`faceAnchor.transform * leftEyeTransform` / `rightEyeTransform`, promedio
de las dos distancias) = `LiveSample.distanceMeanEyesMeters`. Esta única
definición controla el rango 37–43cm, calcula el tamaño angular del estímulo
y llena la columna `viewing_distance_m` de todas las exportaciones.
`distance_camera_to_face_m` se mantiene como columna auxiliar de comparación.
No se aplica corrección cámara→plano de pantalla en esta versión (la cámara
está unos milímetros sobre el borde del display; limitación documentada).

## Por qué la figura parecía no cambiar de tamaño

Dos causas: (1) el bucle de frames inválidos congeló la escalera (arriba); y
(2) la escalera anterior operaba en milímetros continuos con paso que se
reducía a la mitad en cada reverso — cerca del umbral los cambios eran de
décimas de mm, imperceptibles por diseño. Ahora los niveles son una lista
fija logarítmica (0.8 → −0.2 logMAR, paso 0.1 = factor ×1,259 en tamaño),
cada movimiento es exactamente un nivel, y el tamaño en puntos se recalcula
y aplica en cada presentación (verificado por test: tamaños estrictamente
decrecientes entre niveles consecutivos).

## Reloj y criterios de término

- Reloj efectivo: corre solo mientras hay estímulo visible (incluye el
  periodo de gracia de 1s); se pausa en `paused` y ante gaps reales de
  frames (>0,3s), que se cargan al presupuesto de pausa.
- Término (lo que ocurra primero): 6 reversiones · 20 ensayos válidos ·
  60s efectivos · >15s de pausa acumulada · 75s reales (red de seguridad) ·
  abandono. Mínimo 10 ensayos válidos para un resultado; menos → no
  concluyente. 6 reversiones con SD ≤0,15 logMAR → completada; si no →
  aproximada.
- Timeout por figura: 5s de tiempo visible (la pausa no consume); cuenta
  como error para la escalera y pasa a la siguiente figura.

## Versiones

`protocol_version = "3"`, `algorithm_version = "levels-2down1up-v1"`,
geometría sin cambios (`landoltc-5x5-v1`). Exportadas en cada fila.

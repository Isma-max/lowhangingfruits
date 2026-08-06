# Auditoría del estado actual — Fase 0

Fecha: sesión de continuación tras la primera prueba en iPhone 15 Pro Max.
Alcance: solo diagnóstico. No se modifica código en este documento.

## 0. Resumen ejecutivo

El instrumento mide distancia con una arquitectura sólida (ARKit → transformaciones
métricas → gate de calidad → estadística por ventana, todo en un paquete Swift puro
y testeable). Ese cimiento es reutilizable y no requiere reescritura.

Pero el **módulo de test visual** (el que generó `vision_trials.csv`) tiene cuatro
problemas estructurales que explican exactamente lo que reportaste:

1. La pantalla "Prueba basal a distancia fija" nunca exige ni verifica que la
   distancia se mantenga estable — es "basal" solo de nombre.
2. La escalera es 1-arriba/1-abajo (baja el tamaño tras cada acierto), no
   2-abajo/1-arriba — por eso el tamaño caía rápido, a la vez que la distancia
   cambiaba libremente, dando la sensación de "todo cambia a la vez".
3. `physical_size_mm` es el diámetro **total** del anillo, no el detalle crítico
   (MAR). El ángulo exportado tampoco es MAR. Esto no está mal calculado — está
   incompleto: falta separar altura total de detalle crítico.
4. Los ensayos de agudeza no usan el registro continuo ni el filtro de calidad
   que sí existen y funcionan en el Módulo de Distancia — se creó una vez pero
   no se conectó a las pantallas de test visual.

Ninguno de estos cuatro puntos requiere reescribir la aplicación. Son fixes
localizados sobre una base que ya funciona (confirmado: compila, corre en
dispositivo real, mide distancia con valores plausibles).

## 1. Qué está implementado del encargo original vs. este documento

| Capa (este documento) | Estado actual |
|---|---|
| A. Motor de medición | Implementado para distancia/pose/calidad (`FaceTrackingSession`, `DistanceRunRecorder`, `TrackingQualityEvaluator`). **No conectado** a los ensayos de agudeza visual. |
| B. Motor clínico experimental | No existe. No hay MAR/logMAR, no hay demanda acomodativa calculada, no hay `PresbyopiaScoreEngine`. Esperado en esta etapa — es Fase 5 del roadmap. |
| C. Motor de recomendación | No existe. Esperado — Fase 6. |
| D. Capa conversacional (LLM) | No existe. Esperado — Fase 7. |

Es decir: el repositorio está exactamente donde el roadmap dice que debería
estar antes de Fase 1 — con la Fase 1 misma a medio terminar (existe para el
módulo de distancia, falta para el módulo de agudeza).

## 2. Mapeo de arquitectura

El repo no usa la nomenclatura `Features/` + `Services/` sugerida en la
sección 6 del encargo, pero la organización actual es coherente y cada pieza
tiene un hogar claro. Propongo **no forzar el renombrado** (el propio encargo
lo permite) y mapear así:

| Propuesto en el encargo | Existe hoy como | Nota |
|---|---|---|
| `Features/Onboarding` | `Screens/Home`, `Screens/Compatibility` | — |
| `Features/SafetyScreening` | `Screens/ConsentAndAlarms` | — |
| `Features/Calibration` | `Screens/DistanceModule` | Es el "modo de verificación de distancia"; falta la verificación manual con tarjeta ISO ID-1 (§1.2 del encargo). |
| `Features/NearAcuityTest` (Test A) | `Screens/VisionTest/StaticBaselineTrialView` | Existe pero no cumple el protocolo de Test A (ver hallazgo #1). |
| `Features/DynamicNearPointTest` (Test B) | `Screens/VisionTest/BlurCrossingTrialView` (parcial) | Falta el paso de "verificación mediante optotipo aleatorio" y la distinción explícita ida/vuelta con histéresis. |
| `Features/AcuityDemandCurve` (Test C) | **No existe** | Pantalla nueva a construir en Fase 2. |
| `Features/Results` | `Screens/SessionSummaryView` (mínimo) | Solo confirma guardado; no hay resultado técnico aún (correcto para esta etapa). |
| `Features/ResearcherMode` | Repartido: `Screens/DistanceModule`, `ParticipantInfoView`, ajustes de umbral | Funciona pero no está agrupado como "modo investigador" explícito. |
| `Features/Export` | `Screens/Export`, `Persistence/ExportManager` | — |
| `Services/FaceDistanceService` | `Tracking/FaceTrackingSession` | Mismo rol, otro nombre. |
| `Services/DisplayCalibrationService` | **No existe como servicio único** — repartido entre `Stimulus/DeviceScreenGeometry.swift` (tabla) y `Stimulus/ScreenGeometryHelper.swift` (conversión) | Hallazgo #9. |
| `Services/StimulusGeometryService` | `VisionMVPCore/Stimulus/StimulusScaler.swift` + `LandoltCShape.swift` | Falta MAR/logMAR (hallazgo #3). |
| `Services/QualityControlService` | `VisionMVPCore/Tracking/TrackingQualityEvaluator.swift` | Existe y funciona, pero no está conectado a los ensayos de agudeza (hallazgo #5). |
| `Services/PresbyopiaScoreEngine`, `RecommendationEngine`, `LLMExplanationService`, `ProductCatalogService` | No existen | Correcto para esta etapa (Fases 5-8). |
| `Models/`, `Analytics/` | `Models/` existe; `Analytics/` no existe | No se necesita `Analytics/` todavía. |

## 3. Cómo se calcula cada cosa hoy (auditoría técnica pedida en §5 Fase 0)

### Distancia
`FaceTrackingSession.deriveSample(from:)` (`Tracking/FaceTrackingSession.swift`):
distancia = norma euclidiana entre la traslación de `ARFrame.camera.transform`
y la de `ARFaceAnchor.transform`, ambos en el espacio "world" de ARKit. Correcto
y ya validado empíricamente por ti (valores 44.6–69.8cm plausibles para un
recorrido de acercamiento/alejamiento). Este cálculo **no cambia** en Fase 1.

### Tamaño físico del estímulo
`LandoltCShape.swift`: el anillo se dibuja con diámetro exterior = tamaño pasado
por el llamador; grosor del trazo = diámetro/5; abertura = grosor del trazo
(también diámetro/5). Cumple la proporción 5×5 en cuanto a *forma*, pero:

**`physical_size_mm` en `vision_trials.csv` corresponde a la altura/diámetro
total del anillo, no al detalle crítico (la abertura).** Confirmado leyendo
`StaticBaselineTrialView.swift:84` y `DynamicTrialView.swift`: `sizeMm` es
directamente el valor que controla el diámetro completo pasado a
`StimulusView`. Nunca se calcula ni se exporta el tamaño de la abertura por
separado (que sería `sizeMm / 5`).

### Tamaño angular
`StimulusScaler.angularSizeArcMinutes(physicalSizeMillimeters:distanceMeters:)`
(`VisionMVPCore/Stimulus/StimulusScaler.swift`) usa la fórmula exacta (no
aproximación de ángulo pequeño) — matemáticamente correcta. Pero se aplica
siempre sobre el diámetro **total**, así que `angular_size_arcmin` en el CSV
es el ángulo total, no el MAR. No existe conversión a logMAR en ninguna parte
del código.

### Reversiones y step size
`StaircaseController.recordResponse(correct:)` (`VisionMVPCore/Stimulus/StaircaseController.swift:81-93`):
una reversión se registra cuando el sentido del movimiento (subir/bajar)
cambia respecto al ensayo anterior. Esto es correcto *para el algoritmo que
implementa*, que es **1-arriba/1-abajo** (baja tras cada acierto, sube tras
cada error) — no el 2-abajo/1-arriba que pide este documento. El mecanismo de
reversiones en sí (conteo, reducción de paso a la mitad, promedio de las
últimas N reversiones para el umbral) es reutilizable sin cambios; solo hay
que generalizar cuántos aciertos consecutivos se necesitan para bajar.

### Calibración de pantalla
`DeviceScreenGeometry.swift`: tabla fija `identificador de modelo → ancho/alto
físico en mm`, calculada como `píxeles / ppi × 25.4` a partir de
especificaciones de Apple obtenidas por búsqueda web durante el desarrollo —
**nunca verificada contra hardware real ni contra una tarjeta física de
referencia**. Para iPhone 15 Pro Max (`iPhone16,2`) el valor almacenado es
71.24 × 154.37mm. `ScreenGeometryHelper.pointsForMillimeters` divide el ancho
de pantalla en puntos (en vivo, vía `UIScreen.main.bounds.width`) por ese
valor. No hay ningún paso de verificación manual con tarjeta ISO ID-1, ni
almacenamiento de un factor de corrección.

## 4. Lista priorizada de errores y hallazgos

**[CRÍTICO] #1 — "Prueba basal a distancia fija" no exige distancia estable.**
`Screens/VisionTest/StaticBaselineTrialView.swift`. Solo muestra la distancia
actual como texto informativo (líneas 40-43); no bloquea, pausa ni oculta el
estímulo si el participante sale de rango. Es la causa raíz directa de lo que
reportaste: el CSV etiquetado `static_baseline` reflejando en realidad un
recorrido dinámico de 44.6–69.8cm.

**[CRÍTICO] #2 — Escalera 1-arriba/1-abajo en vez de 2-abajo/1-arriba.**
`VisionMVPCore/Stimulus/StaircaseController.swift:83`. Baja el tamaño tras
cada acierto único. Con 12/16 aciertos en la primera prueba, el tamaño cayó
muy rápido — combinado con el hallazgo #1, da la impresión de que "todo
cambia a la vez".

**[CRÍTICO] #3 — `physical_size_mm`/`angular_size_arcmin` son altura total, no MAR.**
No existe ningún campo que represente el detalle crítico (abertura) por
separado, ni MAR, ni logMAR, en `VisionTrialRecord.swift` ni en ningún otro
esquema exportado.

**[CRÍTICO] #4 — Sin trayectoria continua en los ensayos de agudeza.**
Ni `StaticBaselineTrialView` ni `DynamicTrialView` usan `DistanceRunRecorder`
(que ya existe y funciona en `DistanceModuleView`/`BlurCrossingTrialView`).
Solo capturan un punto de distancia en el instante de cada respuesta — sin
yaw/pitch/roll, calidad de tracking, ni frames descartados en
`vision_trials.csv`.

**[ALTO] #5 — Ningún ensayo de agudeza pasa por el filtro de calidad.**
`TrackingQualityEvaluator` nunca se consulta en `StaticBaselineTrialView` ni
`DynamicTrialView`. Un ensayo se acepta como válido sin importar si el rostro
estaba centrado, el yaw era excesivo, o el tracking estaba `.limited` /
`.notAvailable`. Contradice el principio de "medición no concluyente" del
encargo original.

**[ALTO] #6 — 8 orientaciones (incluidas diagonales) en vez de 4 cardinales.**
`GapOrientation.allDirectionsClockwise` (8 casos) se usa en ambas vistas de
ensayo. Este documento pide reducir a 4 para la fase de estabilización.

**[MEDIO] #7 — Sin demanda acomodativa (`D = 1/distancia_m`) calculada ni exportada.**
Se puede derivar en post-proceso desde `distance_m`, pero el encargo pide
calcularla y exportarla explícitamente en el propio registro.

**[MEDIO] #8 — Sin versión de protocolo/algoritmo/geometría/calibración en ningún registro.**
Confirmado por búsqueda en todo el repo: solo existen `appVersion` (build de
la app) e `iosVersion`. Ningún cambio de la Fase 1 (escalera, geometría,
calibración) quedará distinguible en los datos si no se versiona antes de
tocar el código.

**[MEDIO] #9 — Sin `DisplayCalibrationService` centralizado ni verificación manual.**
La conversión mm↔pt está repartida en dos archivos del target de la app; la
tabla de tamaños físicos nunca se verificó contra hardware real ni contra una
tarjeta física de referencia; no hay forma de que el investigador corrija el
factor si la tabla está equivocada para un modelo específico.

**[MEDIO] #10 — Riesgo de rendimiento: buffer en memoria + republicación en cada frame de ARKit.**
`DistanceRunRecorder.ingest(_:)` hace `frames.append(record)` y reconstruye
`liveStats` en cada frame (~30-60Hz), dentro de una propiedad `@Published`
que SwiftUI observa. Para las grabaciones cortas del Módulo de Distancia
probablemente no se nota, pero el nuevo Test B (recorridos de varios segundos
× 3 repeticiones por sentido) podría acumular miles de frames por sesión —
riesgo real de bloqueo de interfaz, tal como advierte el encargo.

**[BAJO] #11 — Sin escritura incremental; nada se persiste hasta "Detener"/"Exportar".**
`FileStore.writeCSV` codifica el array completo a un `String` y escribe una
sola vez, al final. Si la app se cierra, se suspende, o crashea a mitad de
una grabación, se pierde toda la sesión en curso. Riesgo de pérdida de datos
explícitamente señalado como prioridad en el encargo original.

**[INFO] #12 — Ningún test de `VisionMVPCore` se ha ejecutado nunca.**
Documentado ya en `DECISIONS.md`: este entorno no tiene toolchain de Swift.
Ahora que confirmamos que la app compila y corre en un iPhone real, tiene
sentido pedirte que corras `swift test` en tu Mac como parte de esta próxima
entrega, para tener la primera confirmación real de la lógica pura.

**[INFO] #13 — Parámetros hardcodeados a revisar (no necesariamente errores, pero sin justificación documentada ni versión):**
- `StaticBaselineTrialView`: tamaño inicial 12mm, paso inicial 3mm, paso
  mínimo 0.25mm, 8 reversiones para detener, máximo 40 ensayos.
- `DynamicTrialView`: tamaño angular objetivo por defecto 24 arcmin, tamaño
  físico fijo por defecto 5mm, 20 ensayos por defecto.
- `ScreenGeometryHelper`: si el modelo no está en la tabla, usa una razón de
  respaldo de 6.0 puntos/mm sin avisar en la fila del CSV (solo queda
  registrado indirectamente en `SessionRecord.hasKnownScreenGeometry`, a
  nivel de sesión, no de ensayo). No debería activarse en iPhone 15 Pro Max
  (sí está en la tabla), pero conviene que quede trazable por fila si ocurre
  en otro dispositivo.

## 5. Riesgos y decisiones pendientes (necesito tu confirmación antes de Fase 1)

1. **Escalera:** ¿reemplazo 1-arriba/1-abajo por 2-abajo/1-arriba directamente
   en `StaircaseController`, generalizándolo para aceptar cualquier N-abajo/M-arriba
   (dejando 1-arriba/1-abajo disponible como caso particular, no como
   comportamiento por defecto)? Es lo que recomiendo — cambia el default, no
   elimina flexibilidad.

2. **Orientaciones:** ¿limito `GapOrientation` a 4 casos a nivel de tipo
   (elimino las 4 diagonales del enum), o mantengo las 8 en `VisionMVPCore` y
   solo restrinjo qué subconjunto usan las vistas de la Fase 1? Recomiendo lo
   segundo: menos invasivo, reversible, no afecta el CSV histórico si algún
   día se retoman las diagonales.

3. **Tarjeta ISO ID-1:** ¿verificación completamente manual (el investigador
   mide en pantalla con una regla/calibre y escribe el factor de corrección a
   mano), o semi-automática (la app intenta detectar el borde de la tarjeta
   con la cámara)? Recomiendo manual para la Fase 1 — la detección de objetos
   por visión añade una fuente de error nueva que no podemos validar sin
   hardware, y el encargo mismo describe la verificación como algo que hace
   el investigador con una tarjeta física.

4. **Test B (`BlurCrossingTrialView`):** ¿lo reescribo para cumplir el
   protocolo completo del encargo (ida hasta desenfoque → marca → verificación
   con optotipo aleatorio → vuelta hasta claridad → marca → verificación →
   3 repeticiones por sentido, con tamaño angular constante), o dejo la
   versión actual (más simple, sin el paso de verificación con optotipo) y
   creo uno nuevo en paralelo? Recomiendo reescribirlo — es pronto en el
   desarrollo para mantener dos versiones del mismo test.

5. **Test C (curva agudeza-demanda):** confirmo que es una pantalla nueva,
   perteneciente a la Fase 2 del roadmap, no a la Fase 1 de estabilización.
   No la construyo todavía salvo que me digas lo contrario.

6. **Compatibilidad con el CSV ya generado:** dado que solo existe una sesión
   de prueba y el instrumento todavía está en fase experimental, recomiendo
   **no** intentar migrar `vision_trials.csv` al esquema nuevo — documentar la
   versión del esquema y tratar todo lo generado antes de Fase 1 como datos de
   una versión anterior, no comparable directamente.

7. **Estructura de carpetas:** mantengo `Screens/` + `Tracking/` +
   `Persistence/` + `Stimulus/` tal como están; agrego archivos nuevos con
   nombres equivalentes a los `Services/` sugeridos (p. ej.
   `DisplayCalibrationService.swift`) sin reorganizar lo existente. Avísame si
   prefieres que sí migre a la nomenclatura `Features/`/`Services/` completa.

## 6. Propuesta de cambios para Fase 1 (a la espera de tu aprobación — no implementado todavía)

Archivos que se modificarían:

- `VisionMVPCore/Stimulus/StaircaseController.swift` — generalizar a
  N-abajo/M-arriba; cambiar el default de Test A a 2-abajo/1-arriba.
- `VisionMVPCore/Stimulus/StimulusScaler.swift` — separar altura total de
  detalle crítico; añadir MAR y logMAR.
- `VisionMVPCore/Export/VisionTrialRecord.swift` — nuevas columnas: altura
  total (mm/px/pt), ángulo total (arcmin), ángulo de detalle crítico (arcmin,
  = MAR), logMAR, demanda acomodativa (D), yaw/pitch/roll, estado de calidad,
  versión de protocolo/algoritmo/geometría.
- `VisionMVPCore/Export/DomainEnums.swift` — evaluar el alcance de
  `GapOrientation` según decisión pendiente #2.
- Nuevo `VisionMVPCore/Tracking/AccommodativeDemand.swift` — `D = 1/distancia_m`, con test unitario.
- Nuevo `VisionDistanceMVP/Services/DisplayCalibrationService.swift` —
  consolida `DeviceScreenGeometry` + `ScreenGeometryHelper`, añade
  verificación manual con tarjeta ISO ID-1 y factor de corrección
  persistido.
- `VisionDistanceMVP/Screens/VisionTest/StaticBaselineTrialView.swift` —
  gating de estabilidad de distancia (38–42cm, ≥500ms), escalera
  2-abajo/1-arriba, registro continuo vía `DistanceRunRecorder`, filtro de
  calidad.
- `VisionDistanceMVP/Screens/VisionTest/DynamicTrialView.swift` — filtro de
  calidad, registro continuo.
- `VisionDistanceMVP/Screens/VisionTest/BlurCrossingTrialView.swift` — según
  decisión pendiente #4.
- `VisionDistanceMVP/Stimulus/LandoltCShape.swift` /
  `GapDirectionResponsePad.swift` — soportar subconjunto de 4 direcciones.
- `VisionDistanceMVP/Tracking/DistanceRunRecorder.swift` — mitigar el riesgo
  de rendimiento (hallazgo #10): throttling de `liveStats` (p. ej. recalcular
  a ≤10Hz en vez de en cada frame) manteniendo el buffer completo de `frames`
  para exportación.
- Nuevos tests: `OptotypeGeometryTests.swift` / ampliar
  `StimulusScalerTests.swift` (MAR/logMAR), `AccommodativeDemandTests.swift`,
  actualizar `StaircaseControllerTests.swift` para el modo N-abajo/M-arriba.
- `DECISIONS.md` — documentar las fórmulas nuevas y el esquema de versionado.

## 7. Qué NO voy a tocar todavía

- El cálculo de distancia (`FaceTrackingSession`/`DistanceCalculator`) — ya
  validado empíricamente, sin evidencia de error.
- La arquitectura de carpetas — se mantiene, según decisión pendiente #7.
- Fases 2–9 completas (Test C, puntaje 1-10, motor de recomendación, LLM,
  catálogo, piloto clínico) — fuera de alcance hasta agotar Fase 1.

Quedo a la espera de tu aprobación (y de tus respuestas a las 7 decisiones
pendientes de la sección 5) antes de escribir cualquier código de Fase 1.

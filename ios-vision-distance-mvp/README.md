# Vision Distance MVP (prototipo de investigación)

MVP experimental nativo de iOS para evaluar si un iPhone con cámara
TrueDepth puede medir, de forma orientativa y repetible, la distancia entre
los ojos de una persona y la pantalla, y si esa medición dinámica aporta
información útil sobre visión cercana más allá de variables simples como
edad y agudeza a distancia fija.

**Esto no es una app de diagnóstico.** No diagnostica presbicia, no genera
recetas y no reemplaza una evaluación oftalmológica u optométrica. Ver
`DECISIONS.md` para el detalle exacto de cada fórmula y decisión técnica, y
el encargo original para el diseño completo del experimento.

## ⚠️ Estado de este código

Este código fue escrito en un entorno sin Xcode, sin simulador de iOS y sin
toolchain de Swift — **nunca se ha compilado**. `VisionMVPCore` (toda la
matemática: distancia, calidad, estadística, escalado, staircase, CSV/JSON)
tiene tests completos que puedes correr con `swift test` sin abrir Xcode
para verificarla primero. El target de la app (SwiftUI/ARKit/SwiftData) sí
necesita Xcode para compilar y, sobre todo, un iPhone físico con TrueDepth
para probarse — ARKit face tracking no funciona en el simulador.

Antes de usar esto en el experimento real: ábrelo en Xcode, corrígelo hasta
que compile, y valida el módulo de distancia contra una cinta métrica o
medidor láser en los hitos de 20 a 80cm.

## Requisitos

- macOS con Xcode 15 o superior.
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).
- Un iPhone físico con cámara TrueDepth (iPhone X en adelante) e iOS 17+
  para probar el seguimiento facial — no funciona en el simulador.

## Verificar la lógica pura (sin Xcode)

```bash
cd ios-vision-distance-mvp
swift test
```

Esto compila y corre todos los tests de `VisionMVPCore`: matemática de
distancia/pose, gate de calidad, estadística por ventana, escalado de
estímulo, staircase, y codificación CSV/JSON. Ninguno de estos tests
requiere ARKit, SwiftUI ni un dispositivo.

## Generar y abrir el proyecto de Xcode

```bash
cd ios-vision-distance-mvp
xcodegen generate
open VisionDistanceMVP.xcodeproj
```

Antes de correr en un dispositivo:

1. En el target `VisionDistanceMVP`, pestaña "Signing & Capabilities",
   selecciona tu Team de desarrollador y ajusta el Bundle Identifier si
   `com.wemul.visiondistancemvp` ya está en uso.
2. Conecta un iPhone con TrueDepth por cable o Wi-Fi y selecciónalo como
   destino de ejecución (no el simulador).

## Estructura

```
ios-vision-distance-mvp/
  Package.swift                    — paquete Swift local, sin dependencias de Apple
  Sources/VisionMVPCore/           — toda la lógica pura y testeable
    Geometry/                      — Matrix4x4, Vector3 (sin `simd`)
    Tracking/                      — distancia, pose, gate de calidad, estadística por ventana
    Stimulus/                      — escalado ángulo↔mm↔puntos, tabla de tamaños de pantalla, staircase
    Export/                        — esquemas CSV/JSON y sus enums de dominio
  Tests/VisionMVPCoreTests/        — XCTest, corre con `swift test`
  project.yml                      — especificación XcodeGen (genera el .xcodeproj)
  VisionDistanceMVP/                — target de la app (SwiftUI + ARKit + SwiftData)
    App/                           — punto de entrada, navegación, estado de sesión en curso
    Models/                        — Participant, SessionRecord (SwiftData), payloads de exportación
    Persistence/                   — SwiftData stack, repositorio, archivos CSV/JSON en disco
    Tracking/                      — FaceTrackingSession (ARKit), DistanceRunRecorder, CoreMotion
    Stimulus/                      — LandoltCShape, panel de respuesta de 8 direcciones
    Screens/                       — las 5 pantallas base + módulo de distancia + módulo de test visual + sesiones/exportar/privacidad
```

## Qué guarda cada sesión

Por sesión, en `Documents/Sessions/<sessionID>/` dentro del propio
dispositivo (nunca sale de ahí salvo exportación explícita):

- `distance_frames.csv` — un renglón por frame de ARKit del módulo de
  distancia (válido o descartado, con motivo).
- `distance_summary.json` — resumen por hito/repetición.
- `vision_trials.csv` — un renglón por ensayo del módulo de test visual.
- `blur_crossings.csv` — los cruces claro/borroso marcados por el
  participante.
- `distance_frames_blur_crossing_rep<N>.csv` — trayectoria de distancia de
  cada repetición del cruce claro/borroso.

Nunca se guardan fotografías, video, ni ningún identificador personal.

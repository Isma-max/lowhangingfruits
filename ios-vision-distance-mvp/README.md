# Vision Distance MVP (prototipo de investigación)

MVP experimental nativo de iOS: un test de visión cercana de un minuto que
usa la cámara TrueDepth para mantener y registrar la distancia ojo-pantalla
mientras mide el tamaño angular mínimo que la persona puede identificar.

**Esto no es una app de diagnóstico.** No diagnostica presbicia, no genera
recetas y no reemplaza una evaluación oftalmológica u optométrica. Ver
`DECISIONS.md` para el detalle exacto de cada fórmula y decisión técnica.

## ⚠️ Estado de este código

Este código fue escrito en un entorno sin Xcode, sin simulador de iOS y sin
toolchain de Swift — **nunca se ha compilado aquí**. `VisionMVPCore` (toda
la lógica pura: motor del test, escalera, geometría, persistencia y
exportación) tiene tests completos que puedes correr con `swift test` sin
abrir Xcode para verificarla primero. El target de la app (SwiftUI + ARKit)
necesita Xcode para compilar y, sobre todo, un iPhone físico con TrueDepth
para probarse — ARKit face tracking no funciona en el simulador.

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
estímulo, escalera, motor del test, simulaciones, persistencia y
exportación. Ninguno de estos tests requiere ARKit, SwiftUI ni un
dispositivo.

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

## Flujo de la app (versión simplificada)

Un único camino: Inicio → "Comenzar test visual" → explicación con demo →
práctica de 4 figuras → posicionamiento a ~40 cm → cuenta regresiva 3-2-1 →
test de máximo 60 segundos efectivos → resultado (completada / aproximada /
no concluyente). El módulo de caracterización de distancia fue eliminado de
la interfaz; la medición TrueDepth sigue funcionando por debajo.

## Estructura

```
ios-vision-distance-mvp/
  Package.swift                    — paquete Swift local, sin dependencias de Apple
  Sources/VisionMVPCore/           — toda la lógica pura y testeable
    Geometry/                      — Matrix4x4, Vector3 (sin `simd`)
    Tracking/                      — distancia, pose, timing real de frames, estadística por ventana
    Stimulus/                      — niveles logMAR, escalera 2-down/1-up por niveles, geometría 5×5
    Engine/                        — VisionTestEngine: máquina de estados completa del test
    Export/                        — esquemas CSV/JSON (frames, ensayos, resumen de sesión)
  Tests/VisionMVPCoreTests/        — XCTest, corre con `swift test` (incluye simulaciones §27)
  project.yml                      — especificación XcodeGen (genera el .xcodeproj)
  VisionDistanceMVP/                — target de la app (SwiftUI + ARKit)
    App/                           — punto de entrada y navegación
    Models/                        — chequeo de capacidades del dispositivo
    Persistence/                   — instancia compartida del SessionStore
    Tracking/                      — FaceTrackingSession (ARKit), VisionTestRunner (puente al motor)
    Stimulus/                      — LandoltCShape, panel de respuesta de 4 direcciones
    Screens/                       — Home, Intro, Práctica, Test, Resultados anteriores, Privacidad
```

## Qué guarda cada sesión

Cada test terminado se guarda automáticamente, antes de mostrar el
resultado, en `Application Support/Sessions/<session_id>/` dentro del propio
dispositivo (nunca sale de ahí salvo que el usuario comparta):

- `session_summary.json` — resumen de la sesión: estado, calidad, códigos de
  explicación, umbral estimado, conteos y estadísticas. Los valores
  faltantes aparecen como `null`, nunca como cero.
- `vision_trials.csv` — un renglón por figura presentada (nivel logMAR,
  tamaños, respuesta, tiempo de reacción, estado de la escalera).
- `distance_frames.csv` — un renglón por frame de tracking durante el test
  (distancia óptica, pose, calidad, estado del test, fps efectivo).
- `README.txt` — qué es cada archivo, unidades y aviso experimental.
- `session_complete.json` — manifiesto interno; su presencia marca que el
  guardado terminó íntegro.

Los archivos comparten el mismo `session_id`. "Compartir resultados" genera
un ZIP en `Application Support/Exports/` y lo entrega a la hoja de compartir
de iOS. Nunca se guardan fotografías, video, ni identificadores personales
(el identificador de participante es opcional y libre; si queda vacío se
genera uno automático).

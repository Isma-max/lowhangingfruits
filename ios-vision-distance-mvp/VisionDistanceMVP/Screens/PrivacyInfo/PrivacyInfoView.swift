import SwiftUI

/// Brief section 6 Pantalla 1: "Acceso a información de privacidad".
struct PrivacyInfoView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Privacidad").font(.title2.bold())

                group("Qué se procesa", [
                    "La cámara TrueDepth se usa únicamente para calcular, en el propio " +
                    "dispositivo, la posición y distancia de tu rostro y ojos respecto a la " +
                    "pantalla, mediante ARKit.",
                    "No se graban ni almacenan fotografías ni videos en ningún momento. Los " +
                    "fotogramas de la cámara se procesan de forma transitoria y se descartan " +
                    "inmediatamente; solo se guardan los valores numéricos derivados " +
                    "(distancias, ángulos, tamaños, respuestas, tiempos).",
                ])

                group("Qué se guarda", [
                    "Un identificador pseudónimo que tú o el investigador eligen — nunca tu " +
                    "nombre, RUT, correo o teléfono.",
                    "Edad por rango, uso de lentes, y respuestas de autoevaluación.",
                    "Mediciones de distancia, tamaño y ángulo del estímulo, aciertos/errores y " +
                    "tiempos de respuesta.",
                    "Lecturas del entorno (brillo de pantalla, inclinación del dispositivo, " +
                    "estimación aproximada de luz ambiental), cada una con su origen y unidad " +
                    "indicados explícitamente.",
                ])

                group("Dónde se guarda", [
                    "Todo se guarda localmente en este dispositivo. No hay backend ni servidor " +
                    "remoto en esta versión, ni sincronización en la nube.",
                    "Los datos solo salen del dispositivo si el investigador los comparte " +
                    "explícitamente mediante la función de exportación.",
                ])

                group("Qué no hace esta app", [
                    "No diagnostica presbicia ni ninguna otra condición.",
                    "No genera recetas ni recomienda dioptrías.",
                    "No usa cuentas de usuario ni reconocimiento de identidad.",
                    "No sustituye una evaluación oftalmológica u optométrica profesional.",
                ])
            }
            .padding()
        }
        .navigationTitle("Privacidad")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func group(_ title: String, _ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Text("•")
                    Text(item)
                }
                .font(.subheadline)
            }
        }
    }
}

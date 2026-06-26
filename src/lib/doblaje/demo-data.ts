import { v4 as uuidv4 } from 'uuid'
import { VideoAnalysis } from './gemini'

export function getDemoAnalysis(): VideoAnalysis {
  const seg1 = uuidv4()
  const seg2 = uuidv4()
  const seg3 = uuidv4()
  const seg4 = uuidv4()

  return {
    duration: 30,
    speakers: [
      { id: 'speaker_0', label: 'Narrador Principal', voiceId: 'pNInz6obpgDQGcFmaJgB' },
      { id: 'speaker_1', label: 'Comentarista', voiceId: 'VR6AewLTigWG4xSOukaG' },
    ],
    segments: [
      {
        id: seg1,
        startTime: 0,
        endTime: 7,
        speakerId: 'speaker_0',
        emotion: 'tenso',
        context: 'El quarterback recibe el balón y busca a sus receptores bajo presión de la defensa',
      },
      {
        id: seg2,
        startTime: 7,
        endTime: 15,
        speakerId: 'speaker_1',
        emotion: 'emocionado',
        context: 'Pase largo hacia la zona de anotación, el receptor salta entre dos defensores',
      },
      {
        id: seg3,
        startTime: 15,
        endTime: 22,
        speakerId: 'speaker_0',
        emotion: 'celebrando',
        context: 'Touchdown anotado, el jugador celebra en el end zone con sus compañeros',
      },
      {
        id: seg4,
        startTime: 22,
        endTime: 30,
        speakerId: 'speaker_1',
        emotion: 'narrando',
        context: 'El estadio explota de emoción mientras el equipo se abraza en el campo',
      },
    ],
  }
}

export function getDemoScriptOptions() {
  return [
    [
      { id: uuidv4(), segmentId: '', humor: 'sutil' as const, text: 'Y aquí el señor quarterback mirando si su ex está en las gradas antes de lanzar.' },
      { id: uuidv4(), segmentId: '', humor: 'exagerado' as const, text: '¡ESTÁ SUDANDO, ESTÁ TEMBLANDO, LE TIEMBLAN HASTA LAS HOMBRERAS, DIOS MÍO!' },
      { id: uuidv4(), segmentId: '', humor: 'absurdo' as const, text: 'El balón le pregunta adónde va. El quarterback responde: ni idea, solo lo lanzo.' },
    ],
    [
      { id: uuidv4(), segmentId: '', humor: 'sutil' as const, text: 'El pase sale... con la precisión de quien lanza el papel al tacho desde lejos.' },
      { id: uuidv4(), segmentId: '', humor: 'exagerado' as const, text: '¡EL BALÓN SURCA LOS CIELOS COMO UN ÁGUILA MAJESTUOSA EN CÁMARA LENTÍSIMA!' },
      { id: uuidv4(), segmentId: '', humor: 'absurdo' as const, text: 'El receptor salta tan alto que brevemente se convierte en satélite de la NASA.' },
    ],
    [
      { id: uuidv4(), segmentId: '', humor: 'sutil' as const, text: 'Touchdown. El jugador celebra como si hubiera encontrado el control del televisor.' },
      { id: uuidv4(), segmentId: '', humor: 'exagerado' as const, text: '¡TOUCHDOWN! ¡EL UNIVERSO ENTERO TIEMBLA! ¡LOS PLANETAS CAMBIAN DE ÓRBITA!' },
      { id: uuidv4(), segmentId: '', humor: 'absurdo' as const, text: 'El árbitro también celebra. Nadie sabe por qué. Él tampoco lo sabe.' },
    ],
    [
      { id: uuidv4(), segmentId: '', humor: 'sutil' as const, text: 'El estadio aplaude. Algunos lloran. Uno está dormido desde el segundo cuarto.' },
      { id: uuidv4(), segmentId: '', humor: 'exagerado' as const, text: '¡LA GENTE GRITA TAN FUERTE QUE SE ESCUCHA EN MARTE, SEÑORES!' },
      { id: uuidv4(), segmentId: '', humor: 'absurdo' as const, text: 'Un hincha en la fila 47 todavía no sabe que anotaron. Está comiendo un hot dog.' },
    ],
  ]
}

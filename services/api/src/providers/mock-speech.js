import { randomUUID } from 'node:crypto';

function createWaveFileBase64(text) {
  const sampleRate = 8000;
  const durationSeconds = 0.4;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const samples = Buffer.alloc(totalSamples * 2);
  const frequency = 440;

  for (let index = 0; index < totalSamples; index += 1) {
    const amplitude = Math.sin((2 * Math.PI * frequency * index) / sampleRate);
    const value = Math.round(amplitude * 0x3fff);
    samples.writeInt16LE(value, index * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples.length, 40);

  return Buffer.concat([header, samples]).toString('base64');
}

export async function synthesizeMockSpeech({ text, voice = 'mock-default' }) {
  if (!text) {
    throw new Error('Transcript text is required.');
  }

  return {
    audioUrl: `data:audio/wav;base64,${createWaveFileBase64(text)}`,
    transcript: text,
    voice,
    traceId: randomUUID(),
  };
}

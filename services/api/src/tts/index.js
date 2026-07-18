import { synthesizeMockSpeech } from '../providers/mock-speech.js';

export async function synthesizeSpeech({ text, voice }) {
  return synthesizeMockSpeech({ text, voice });
}

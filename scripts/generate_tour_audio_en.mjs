import fs from 'node:fs/promises';
import path from 'node:path';

const API_KEYS = (process.env.GEMINI_API_KEYS?.split(',') || [])
  .map(k => k.trim())
  .filter(k => k && k.startsWith('AIzaSy'));

if (API_KEYS.length === 0) {
  console.error("Error: No valid GEMINI_API_KEYS starting with 'AIzaSy' found.");
  process.exit(1);
}
const model = 'gemini-3.1-flash-tts-preview';

const narrations = [
  { id: 'welcome_en', text: "Welcome, ladies and gentlemen, to the simulation of the paper-making gallery located at 189 Trich Sai, Tay Ho, Hanoi. Before we begin, did you know that Vietnam has a traditional paper called Dó paper? This paper was used by our people to paint Dong Ho paintings, write royal decrees, or store Buddhist scriptures. The method of making this Dó paper has been passed down since the 13th century. However, due to economic changes during the Doi Moi period in the 1980s, traditional hand-made paper families switched to other jobs, causing the traditional Dó paper method to almost fade away. Here, I will introduce to you the 10 steps in this traditional Dó paper making process." },
  { id: 'step1_en', text: "Dó bark is cooked with lime to soften the fibers before the next stages." },
  { id: 'step2_en', text: "Cooked bark is washed, cleaned, and prepared." },
  { id: 'step3_en', text: "Dó fibers are pounded into fine paper pulp." },
  { id: 'step4_en', text: "This stage prepares the paper edges and tools for sheet forming." },
  { id: 'step5_en', text: "The pulp is sifted to remove hard bark and impurities." },
  { id: 'step6_en', text: "Natural glue is mixed into the pulp vat to support fiber bonding." },
  { id: 'step7_en', text: "The maker uses a mould to spread fibers into a thin sheet." },
  { id: 'step8_en', text: "Wet sheets are pressed to remove water." },
  { id: 'step9_en', text: "The paper is flattened before finishing." },
  { id: 'step10_en', text: "Dried sheets are peeled from the drying wall and stacked." },
  { id: 'after_en', text: "Dó paper is usually made in certain seasons when the weather is not too rainy, not too sunny, and not humid. The people of Yen Thai village in the past were both farmers and paper-making artisans. When the agricultural season ended, they switched to making paper since they had time. Learning to make paper is not difficult, taking only a year; but to make a high-quality sheet of paper, a villager had to practice for 5 to 6 years or more." },
  { id: 'end_en', text: "Here, our simulation journey has come to an end. Thank you very much for accompanying me." }
];

function convertPcmToWav(pcmBuffer, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // LPCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function run() {
  const outputDir = '/home/sonnq6/CtrlAltDefeat/apps/web/audio/narration';
  await fs.mkdir(outputDir, { recursive: true });

  let keyIndex = 0;

  for (const item of narrations) {
    const fileName = path.join(outputDir, `${item.id}.wav`);
    
    // Skip if already successfully created
    try {
      const stats = await fs.stat(fileName);
      if (stats.size > 1000) {
        console.log(`Skipping already generated: ${item.id}.wav`);
        continue;
      }
    } catch {
      // file does not exist, proceed
    }

    let success = false;
    let attempt = 0;
    const maxAttempts = 15;

    while (!success && attempt < maxAttempts) {
      attempt++;
      const apiKey = API_KEYS[keyIndex % API_KEYS.length];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      console.log(`Generating: ${item.id} (Attempt ${attempt}/${maxAttempts}, Key Index: ${keyIndex % API_KEYS.length})...`);
      
      const payload = {
        contents: [{
          parts: [{
            text: `Please read aloud this narration text in English using a polite, gentle, and clear female voice: ${item.text}`
          }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede"
              }
            }
          }
        }
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(45000) // 45 seconds timeout
        });

        if (response.status === 429) {
          console.warn(`Rate limited (429) on key index ${keyIndex % API_KEYS.length}. Rotating key and backing off...`);
          keyIndex++;
          await new Promise(r => setTimeout(r, 6000));
          continue;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${await response.text()}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];
        const part = candidate?.content?.parts?.find(p => p.inlineData);

        if (part && part.inlineData) {
          const rawPcm = Buffer.from(part.inlineData.data, 'base64');
          const wavData = convertPcmToWav(rawPcm, 24000);
          await fs.writeFile(fileName, wavData);
          console.log(`Saved: ${fileName} (${wavData.length} bytes)`);
          success = true;
          keyIndex++; // Rotate key
        } else {
          console.warn(`No audio returned. Response:`, JSON.stringify(result));
          keyIndex++;
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        console.error(`Attempt failed:`, err.message);
        keyIndex++;
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (!success) {
      console.error(`Failed to generate ${item.id} after ${maxAttempts} attempts. Skipping to next...`);
    }

    // Delay between items to avoid hitting rate limits
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log("English Audio generation run completed!");
}

run().catch(console.error);

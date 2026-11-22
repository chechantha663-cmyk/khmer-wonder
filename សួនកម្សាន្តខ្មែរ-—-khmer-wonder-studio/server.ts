import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_EMAIL = 'chechantha663@gmail.com';
const app = express();

// Load public Firebase Web API key from generated config for ID token verification
let firebaseWebApiKey = '';
try {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { apiKey?: string };
  firebaseWebApiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : '';
} catch {
  firebaseWebApiKey = '';
}

// Allow base64 audio payloads (up to 25MB) for microphone transcription
app.use(express.json({ limit: '25mb' }));

async function verifyAdminRequest(
  req: express.Request,
): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'មុខងារនេះត្រូវការចូលគណនី Google Admin ជាមុនសិន។',
    };
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 8192) {
    return { ok: false, status: 401, error: 'Invalid authentication token.' };
  }
  if (!firebaseWebApiKey) {
    return { ok: false, status: 500, error: 'Firebase Auth verification is not configured.' };
  }

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseWebApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!verifyRes.ok) {
      return {
        ok: false,
        status: 401,
        error: 'សម័យចូលគណនីបានផុតកំណត់ សូមចូលគណនី Google ម្ដងទៀត។',
      };
    }
    const payload = (await verifyRes.json()) as {
      users?: { email?: string; emailVerified?: boolean }[];
    };
    const account = payload.users?.[0];
    if (
      !account?.email ||
      account.emailVerified !== true ||
      account.email.toLowerCase() !== ADMIN_EMAIL
    ) {
      return {
        ok: false,
        status: 403,
        error: 'មុខងារនេះអនុញ្ញាតសម្រាប់តែម្ចាស់គេហទំព័រ (Admin) ប៉ុណ្ណោះ។',
      };
    }
    return { ok: true, email: account.email };
  } catch {
    return { ok: false, status: 502, error: 'Unable to verify Admin identity right now.' };
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your API key in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (/PERMISSION_DENIED|403|API_KEY_INVALID/i.test(raw)) {
    return {
      status: 403,
      message:
        'API key error or permission denied. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (/RESOURCE_EXHAUSTED|429|billing|paid/i.test(raw)) {
    return {
      status: 429,
      message:
        'Quota limit or paid billing key required for this model. You can attach a billing-enabled API key in Settings > Secrets.',
    };
  }
  return {
    status: 500,
    message: raw || 'Upstream Gemini API request failed.',
  };
}

// ===== POST /api/audio/transcribe (Admin-only, gemini-3.5-transcribe) =====
app.post('/api/audio/transcribe', async (req, res) => {
  try {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }

    const { audioBase64, mimeType, languageHint } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      languageHint?: string;
    };

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing audioBase64 payload.' });
    }
    if (audioBase64.length > 24_000_000) {
      return res.status(413).json({ error: 'Audio recording is too large (max ~18MB).' });
    }

    const allowedMimes = [
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/aac',
      'audio/flac',
    ];
    const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    const safeMime = allowedMimes.includes(cleanMime) ? cleanMime : 'audio/webm';

    const promptText =
      languageHint === 'km'
        ? 'Transcribe this audio accurately in Khmer script. Return only the clean transcription text without extra commentary.'
        : languageHint === 'en'
          ? 'Transcribe this audio accurately in English. Return only the clean transcription text without extra commentary.'
          : 'Transcribe this audio accurately in the spoken language (Khmer, English, or mixed). Return only the clean transcription text without extra commentary.';

    const ai = getGeminiClient();
    const interaction = await ai.interactions.create({
      model: 'gemini-3.5-transcribe',
      input: [
        {
          type: 'audio',
          data: audioBase64,
          mime_type: safeMime,
        },
        {
          type: 'text',
          text: promptText,
        },
      ],
    });

    const transcript = (interaction.output_text || '').trim();
    if (!transcript) {
      return res.status(422).json({
        error: 'No speech was detected in the recording. Please speak clearly and try again.',
      });
    }

    return res.json({ transcript });
  } catch (err) {
    console.error('Audio transcription error:', err);
    const { status, message } = formatGeminiError(err);
    return res.status(status).json({ error: message });
  }
});

// ===== POST /api/video/generate (Admin-only, gemini-omni-1.2-flash via Interactions API) =====
app.post('/api/video/generate', async (req, res) => {
  try {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }

    const { prompt, aspectRatio, duration } = req.body as {
      prompt?: string;
      aspectRatio?: string;
      duration?: string;
    };

    const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    if (!trimmedPrompt || trimmedPrompt.length > 1000) {
      return res.status(400).json({
        error: 'Please provide a video prompt between 1 and 1000 characters.',
      });
    }

    const safeAspectRatio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
    const allowedDurations = ['5s', '8s', '10s'] as const;
    const safeDuration = allowedDurations.includes(duration as (typeof allowedDurations)[number])
      ? (duration as (typeof allowedDurations)[number])
      : '8s';

    const ai = getGeminiClient();
    const interaction = await ai.interactions.create(
      {
        model: 'gemini-omni-1.2-flash',
        input: trimmedPrompt,
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: safeAspectRatio,
          duration: safeDuration,
          resolution: '720p',
        },
      },
      { timeout: 300000 },
    );

    const videoPart = interaction.output_video;
    if (!videoPart || (!videoPart.data && !videoPart.uri)) {
      return res.status(502).json({
        error: 'The model did not return a video payload. Please try refining your prompt.',
      });
    }

    return res.json({
      videoBase64: videoPart.data || null,
      videoUri: videoPart.uri || null,
      mimeType: videoPart.mime_type || 'video/mp4',
      aspectRatio: safeAspectRatio,
      duration: safeDuration,
    });
  } catch (err) {
    console.error('Video generation error:', err);
    const { status, message } = formatGeminiError(err);
    return res.status(status).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Khmer Wonder Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

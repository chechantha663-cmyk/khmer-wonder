import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Film,
  Loader2,
  LogIn,
  Mic,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  Wand2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  deleteUserTranscript,
  fetchUserTranscripts,
  fetchUserVideoPrompts,
  saveVideoPromptRecord,
  saveVoiceTranscript,
  type CloudTranscript,
  type CloudVideoPrompt,
} from '../lib/firestoreStore';
import { playSfx, speakText, type VoiceSettings } from '../utils/audio';

interface MediaStudioViewProps {
  voiceSettings: VoiceSettings;
  onBurst: () => void;
  onUseTranscriptAsScene?: (text: string) => void;
}

type StudioTab = 'transcribe' | 'video';

const VIDEO_PRESETS = [
  {
    label: 'អង្គរថ្ងៃលិច និងផ្កាឈូក',
    prompt:
      'Cinematic golden-hour aerial glide over ancient Angkor stone temple causeway surrounded by shimmering lotus moats, drifting warm temple lanterns, gentle wind through palm trees, poetic storybook lighting.',
  },
  {
    label: 'សុភាទន្សាយក្នុងព្រៃបៃតង',
    prompt:
      'Enchanted emerald Cambodian forest at sunrise, a clever golden-furred hare hopping gracefully across mossy stepping stones beside a sparkling stream with floating fireflies, lush painterly animation style.',
  },
  {
    label: 'ស្ពាននាគ និងដងទន្លេមេគង្គ',
    prompt:
      'Moonlit Mekong river with traditional carved wooden boats gliding softly past glowing paper lanterns, reflections shimmering on calm water, serene Khmer folklore atmosphere.',
  },
  {
    label: 'រាត្រីគោមភ្លើងភូមិខ្មែរ',
    prompt:
      'Festive Khmer village courtyard at twilight illuminated by warm woven bamboo lanterns and golden sparklers rising into a starry sky, joyful cinematic camera pan.',
  },
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const str = typeof reader.result === 'string' ? reader.result : '';
      const comma = str.indexOf(',');
      resolve(comma >= 0 ? str.slice(comma + 1) : str);
    };
    reader.onerror = () => reject(new Error('Failed to read audio blob.'));
    reader.readAsDataURL(blob);
  });
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MediaStudioView({
  voiceSettings,
  onBurst,
  onUseTranscriptAsScene,
}: MediaStudioViewProps) {
  const { user, signInWithGoogle, signingIn, getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState<StudioTab>('transcribe');

  // --- Audio Transcription State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(16).fill(0.12));
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/webm');
  const [languageHint, setLanguageHint] = useState<'auto' | 'km' | 'en'>('auto');
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptTitle, setTranscriptTitle] = useState('');
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [savedTranscriptNotice, setSavedTranscriptNotice] = useState(false);
  const [cloudTranscripts, setCloudTranscripts] = useState<CloudTranscript[]>([]);

  // --- Video Generation State ---
  const [videoPrompt, setVideoPrompt] = useState(VIDEO_PRESETS[0].prompt);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoDuration, setVideoDuration] = useState<'5s' | '8s' | '10s'>('5s');
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [cloudVideoPrompts, setCloudVideoPrompts] = useState<CloudVideoPrompt[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number>(0);
  const timerRef = useRef<number>(0);

  // Load user cloud history when signed in
  const refreshCloudHistory = useCallback(async () => {
    if (!user) {
      setCloudTranscripts([]);
      setCloudVideoPrompts([]);
      return;
    }
    try {
      const [trs, vids] = await Promise.all([
        fetchUserTranscripts(user.uid),
        fetchUserVideoPrompts(user.uid),
      ]);
      setCloudTranscripts(trs);
      setCloudVideoPrompts(vids);
    } catch {
      // Non-fatal; user profile may still be initializing
    }
  }, [user]);

  useEffect(() => {
    refreshCloudHistory();
  }, [refreshCloudHistory]);

  // Cleanup audio recorder resources on unmount
  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(levelRafRef.current);
      window.clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  const stopRecordingTracks = () => {
    window.cancelAnimationFrame(levelRafRef.current);
    window.clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setLevels(Array(16).fill(0.12));
  };

  const handleStartRecording = async () => {
    setTranscribeError(null);
    setSavedTranscriptNotice(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime =
        mimeCandidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ||
        '';

      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const finalMime = (recorder.mimeType || supportedMime || 'audio/webm').split(';')[0];
        const blob = new Blob(chunksRef.current, { type: finalMime });
        setAudioBlob(blob);
        setAudioMimeType(finalMime);
        setAudioPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        stopRecordingTracks();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      playSfx('click', voiceSettings.sfxEnabled);

      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      // Live Web Audio frequency meter
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        const ac = new AC();
        audioCtxRef.current = ac;
        const source = ac.createMediaStreamSource(stream);
        const analyser = ac.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const updateBars = () => {
          analyser.getByteFrequencyData(data);
          const next = Array.from({ length: 16 }, (_, idx) => {
            const val = data[idx] ?? 0;
            return Math.max(0.12, Math.min(1, val / 210));
          });
          setLevels(next);
          levelRafRef.current = window.requestAnimationFrame(updateBars);
        };
        updateBars();
      }
    } catch (err) {
      setTranscribeError(
        err instanceof Error
          ? `មិនអាចបើកមីក្រូហ្វូនបានទេ៖ ${err.message}`
          : 'សូមអនុញ្ញាតសិទ្ធិប្រើមីក្រូហ្វូនក្នុង Browser។',
      );
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    playSfx('click', voiceSettings.sfxEnabled);
  };

  const handleUploadAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTranscribeError(null);
    setAudioBlob(file);
    setAudioMimeType(file.type || 'audio/mp3');
    setAudioPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setTranscriptTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    setTranscribing(true);
    setTranscribeError(null);
    setSavedTranscriptNotice(false);
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error('សូមចូលគណនី Google Admin ជាមុនសិន។');
      }
      const audioBase64 = await blobToBase64(audioBlob);
      const res = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioMimeType,
          languageHint,
        }),
      });
      const json = (await res.json()) as { transcript?: string; error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'ការបម្លែងសំឡេងមិនជោគជ័យទេ។');
      }
      setTranscriptText(json.transcript || '');
      if (!transcriptTitle.trim()) {
        setTranscriptTitle(`កំណត់ត្រាសំឡេង (${formatTimer(recordSeconds)})`);
      }
      playSfx('success', voiceSettings.sfxEnabled);
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'មានបញ្ហាក្នុងការបម្លែងសំឡេង។');
    } finally {
      setTranscribing(false);
    }
  };

  const handleSaveTranscript = async () => {
    if (!user || !transcriptText.trim()) return;
    setSavingTranscript(true);
    try {
      const saved = await saveVoiceTranscript(user.uid, {
        title: transcriptTitle.trim() || 'កំណត់ត្រាសំឡេង',
        transcript: transcriptText.trim(),
        language: languageHint,
        durationSec: recordSeconds,
      });
      setCloudTranscripts((prev) => [saved, ...prev]);
      setSavedTranscriptNotice(true);
      playSfx('success', voiceSettings.sfxEnabled);
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'មិនអាចរក្សាទុកបានទេ។');
    } finally {
      setSavingTranscript(false);
    }
  };

  const handleDeleteTranscript = async (id: string) => {
    if (!user) return;
    try {
      await deleteUserTranscript(user.uid, id);
      setCloudTranscripts((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // Ignore
    }
  };

  const handleGenerateVideo = async () => {
    const trimmed = videoPrompt.trim();
    if (!trimmed) return;
    setGeneratingVideo(true);
    setVideoError(null);
    setGeneratedVideoUrl(null);

    try {
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error('សូមចូលគណនី Google Admin ជាមុនសិន។');
      }
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt: trimmed,
          aspectRatio,
          duration: videoDuration,
        }),
      });
      const json = (await res.json()) as {
        videoBase64?: string;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !json.videoBase64) {
        throw new Error(json.error || 'ការបង្កើតវីដេអូមិនជោគជ័យទេ។');
      }
      const mime = json.mimeType || 'video/mp4';
      setGeneratedVideoUrl(`data:${mime};base64,${json.videoBase64}`);
      playSfx('victory', voiceSettings.sfxEnabled);
      onBurst();

      // Persist prompt metadata (never video blob) to Firestore if signed in
      if (user) {
        try {
          const rec = await saveVideoPromptRecord(user.uid, {
            prompt: trimmed,
            aspectRatio,
            duration: videoDuration,
          });
          setCloudVideoPrompts((prev) => [rec, ...prev]);
        } catch {
          // Non-fatal
        }
      }
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'មិនអាចបង្កើតវីដេអូបានទេ។');
    } finally {
      setGeneratingVideo(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header & Mode Tabs */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm sm:flex-row sm:items-center sm:p-7">
        <div>
          <p className="text-xs font-semibold text-[var(--accent-main)]">
            ស្ទូឌីយោច្នៃប្រឌិត AI · បម្លែងសំឡេង & បង្កើតវីដេអូ
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold text-[var(--ink-primary)] sm:text-3xl">
            បម្លែងសំឡេងជាអក្សរ និងបង្កើតវីដេអូពីអត្ថបទ
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ink-secondary)]">
            ថតសំឡេងនិទានរឿងដើម្បីបម្លែងជាអក្សរ រួចយកអត្ថបទទៅបង្កើតជាវីដេអូឈុតឆាកមានជីវិត។
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('transcribe')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'transcribe'
                ? 'bg-[var(--accent-main)] text-[var(--accent-ink)] shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            <Mic className="h-4 w-4" />
            បម្លែងសំឡេង
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'video'
                ? 'bg-[var(--accent-main)] text-[var(--accent-ink)] shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            <Film className="h-4 w-4" />
            បង្កើតវីដេអូ AI
          </button>
        </div>
      </div>

      {/* TAB 1: MICROPHONE AUDIO TRANSCRIPTION */}
      {activeTab === 'transcribe' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Recorder & Transcript Editor */}
          <div className="space-y-5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-8">
            {/* Recorder Box */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-main)] px-5 py-3 text-sm font-bold text-[var(--accent-ink)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] whitespace-nowrap"
                    >
                      <Mic className="h-4 w-4" />
                      ចាប់ផ្ដើមថតសំឡេង
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-rose-700 whitespace-nowrap"
                    >
                      <Square className="h-4 w-4 fill-white" />
                      បញ្ឈប់ការថត ({formatTimer(recordSeconds)})
                    </button>
                  )}

                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3.5 py-2.5 text-xs font-semibold text-[var(--ink-primary)] hover:border-[var(--accent-main)] whitespace-nowrap">
                    <Upload className="h-3.5 w-3.5 text-[var(--accent-main)]" />
                    ផ្ទុកឯកសារសំឡេង
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleUploadAudioFile}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[var(--ink-secondary)]">ភាសា៖</label>
                  <select
                    value={languageHint}
                    onChange={(e) => setLanguageHint(e.target.value as 'auto' | 'km' | 'en')}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-primary)]"
                  >
                    <option value="auto">ស្វ័យប្រវត្តិ (ខ្មែរ/អង់គ្លេស)</option>
                    <option value="km">ភាសាខ្មែរ</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              {/* Real-time Audio Level Visualizer */}
              <div className="mt-5 flex h-12 items-end justify-center gap-1.5 rounded-xl bg-[var(--surface-elevated)] px-4 py-2.5">
                {levels.map((lvl, idx) => (
                  <div
                    key={idx}
                    className="w-2 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.round(lvl * 100)}%`,
                      backgroundColor: isRecording ? 'var(--accent-main)' : 'var(--border-hairline)',
                    }}
                  />
                ))}
              </div>

              {/* Recorded Audio Preview + Transcribe Action */}
              {audioPreviewUrl && (
                <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-hairline)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <audio controls src={audioPreviewUrl} className="h-10 w-full sm:max-w-xs" />
                  <button
                    type="button"
                    disabled={transcribing}
                    onClick={handleTranscribe}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-main)] px-5 py-2.5 text-sm font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-60 whitespace-nowrap"
                  >
                    {transcribing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        កំពុងបម្លែងសំឡេង...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        បម្លែងសំឡេងជាអក្សរ
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {transcribeError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{transcribeError}</span>
              </div>
            )}

            {/* Transcript Result Editor */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  type="text"
                  value={transcriptTitle}
                  onChange={(e) => setTranscriptTitle(e.target.value)}
                  placeholder="ចំណងជើងកំណត់ត្រា (ឧ. រឿងនិទានរបស់ខ្ញុំ)"
                  className="min-w-[220px] flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2 text-sm font-semibold text-[var(--ink-primary)]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!transcriptText.trim()}
                    onClick={() => {
                      navigator.clipboard.writeText(transcriptText).catch(() => {});
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--ink-primary)] disabled:opacity-40"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'បានចម្លង' : 'ចម្លង'}
                  </button>
                  <button
                    type="button"
                    disabled={!transcriptText.trim()}
                    onClick={() => speakText(transcriptText, voiceSettings, { lang: 'km-KH' })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--ink-primary)] disabled:opacity-40"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-[var(--accent-main)]" />
                    អានឮៗ
                  </button>
                </div>
              </div>

              <textarea
                rows={6}
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="អត្ថបទដែលបម្លែងចេញពីសំឡេងនឹងបង្ហាញនៅទីនេះ... អ្នកអាចកែសម្រួលបន្ថែមបាន។"
                className="w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 text-sm leading-relaxed text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {onUseTranscriptAsScene && (
                    <button
                      type="button"
                      disabled={!transcriptText.trim()}
                      onClick={() => {
                        onUseTranscriptAsScene(transcriptText.trim());
                        playSfx('click', voiceSettings.sfxEnabled);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-main)] px-4 py-2.5 text-xs font-bold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40"
                    >
                      <Sparkles className="h-4 w-4" />
                      បញ្ចូលជាវគ្គរឿងនិទាន
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!transcriptText.trim()}
                    onClick={() => {
                      setVideoPrompt(transcriptText.trim());
                      setActiveTab('video');
                      playSfx('click', voiceSettings.sfxEnabled);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent-main)] bg-[var(--accent-soft)] px-4 py-2.5 text-xs font-bold text-[var(--accent-main)] transition-colors hover:bg-[var(--accent-main)] hover:text-[var(--accent-ink)] disabled:opacity-40"
                  >
                    <Wand2 className="h-4 w-4" />
                    យកអត្ថបទនេះទៅបង្កើតវីដេអូ
                  </button>
                </div>

                {user ? (
                  <button
                    type="button"
                    disabled={!transcriptText.trim() || savingTranscript}
                    onClick={handleSaveTranscript}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-main)] px-4 py-2.5 text-xs font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-40"
                  >
                    {savingTranscript ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {savedTranscriptNotice ? 'បានរក្សាទុក!' : 'រក្សាទុកក្នុងគណនី'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={signingIn}
                    onClick={signInWithGoogle}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-primary)] hover:border-[var(--accent-main)]"
                  >
                    <LogIn className="h-3.5 w-3.5 text-[var(--accent-main)]" />
                    ចូល Google ដើម្បីរក្សាទុកប្រវត្តិ
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Saved Transcripts History */}
          <aside className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-4">
            <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
              កំណត់ត្រាសំឡេងដែលបានរក្សាទុក
            </h2>
            {!user ? (
              <div className="mt-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
                <p>ចូលគណនី Google ដើម្បីរក្សាទុកកំណត់ត្រាសំឡេងរបស់អ្នក និងបើកប្រើឡើងវិញលើឧបករណ៍ផ្សេងៗ។</p>
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={signInWithGoogle}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-main)] px-3.5 py-2 text-xs font-bold text-[var(--accent-ink)]"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  ចូលដោយ Google
                </button>
              </div>
            ) : cloudTranscripts.length === 0 ? (
              <p className="mt-4 text-xs text-[var(--ink-secondary)]">
                មិនទាន់មានកំណត់ត្រានៅឡើយទេ។ ថតសំឡេង ហើយចុច «រក្សាទុកក្នុងគណនី»។
              </p>
            ) : (
              <div className="mt-4 space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {cloudTranscripts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTranscriptTitle(item.title);
                          setTranscriptText(item.transcript);
                        }}
                        className="text-left"
                      >
                        <p className="text-xs font-bold text-[var(--ink-primary)] hover:text-[var(--accent-main)]">
                          {item.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--ink-secondary)]">
                          {item.transcript}
                        </p>
                      </button>
                      <button
                        type="button"
                        aria-label="លុប"
                        onClick={() => handleDeleteTranscript(item.id)}
                        className="rounded-lg p-1.5 text-[var(--ink-secondary)] hover:bg-rose-500/15 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* TAB 2: TEXT-TO-VIDEO GENERATOR */}
      {activeTab === 'video' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-7">
            {/* Quick Khmer Story Presets */}
            <div>
              <p className="text-xs font-bold text-[var(--ink-secondary)]">គំរូឈុតឆាករឿងនិទានខ្មែរ</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {VIDEO_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setVideoPrompt(preset.prompt)}
                    className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--accent-main)] hover:text-[var(--accent-main)]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink-primary)]">
                ពិពណ៌នាឈុតវីដេអូដែលអ្នកចង់បង្កើត
              </label>
              <textarea
                rows={4}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="ពិពណ៌នាឈុតឆាក ចលនាកាមេរ៉ា ពន្លឺ និងបរិយាកាស..."
                className="mt-2 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 text-sm leading-relaxed text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
              />
            </div>

            {/* Aspect Ratio & Duration Controls */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--ink-secondary)]">
                  ទំហំអេក្រង់ (Aspect Ratio)
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['16:9', '9:16'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        aspectRatio === ratio
                          ? 'border-[var(--accent-main)] bg-[var(--accent-soft)] text-[var(--accent-main)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]'
                      }`}
                    >
                      {ratio === '16:9' ? '16:9 ផ្ដេក' : '9:16 បញ្ឈរ'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ink-secondary)]">
                  រយៈពេលវីដេអូ
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(['5s', '8s', '10s'] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setVideoDuration(dur)}
                      className={`font-mono-num rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                        videoDuration === dur
                          ? 'border-[var(--accent-main)] bg-[var(--accent-soft)] text-[var(--accent-main)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]'
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={generatingVideo || !videoPrompt.trim()}
              onClick={handleGenerateVideo}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-main)] px-6 py-3.5 text-sm font-bold text-[var(--accent-ink)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {generatingVideo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  កំពុងបង្កើតវីដេអូ 720p... (ប្រហែល ៣០–៩០ វិនាទី)
                </>
              ) : (
                <>
                  <Film className="h-4 w-4" />
                  បង្កើតវីដេអូ AI ឥឡូវនេះ
                </>
              )}
            </button>

            {videoError && (
              <div className="space-y-1.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-300">
                <div className="flex items-start gap-2 font-bold">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{videoError}</span>
                </div>
                <p className="pl-6 text-[11px] opacity-90">
                  ចំណាំ៖ ការបង្កើតវីដេអូ AI ត្រូវការ GEMINI_API_KEY ដែលមានបើក Billing នៅក្នុង Settings → Secrets។
                </p>
              </div>
            )}
          </div>

          {/* Right: Video Preview + Prompt History */}
          <div className="space-y-5 lg:col-span-5">
            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
                  លទ្ធផលវីដេអូ
                </h2>
                {generatedVideoUrl && (
                  <a
                    href={generatedVideoUrl}
                    download="khmer-wonder-story.mp4"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-main)] px-3 py-1.5 text-xs font-bold text-[var(--accent-ink)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    ទាញយក MP4
                  </a>
                )}
              </div>

              <div className="mt-4 flex min-h-[240px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-stone-950">
                {generatingVideo ? (
                  <div className="flex flex-col items-center gap-3 p-6 text-center text-amber-100">
                    <Loader2 className="h-9 w-9 animate-spin text-amber-400" />
                    <p className="text-sm font-bold">កំពុងរចនាឈុតឆាកវីដេអូ...</p>
                    <p className="text-xs text-amber-200/75">
                      សូមរង់ចាំបន្តិច ម៉ូដែលកំពុងបង្កើតវីដេអូ 720p ជូនអ្នក។
                    </p>
                  </div>
                ) : generatedVideoUrl ? (
                  <video
                    src={generatedVideoUrl}
                    controls
                    playsInline
                    loop
                    className="max-h-[380px] w-full object-contain"
                  />
                ) : (
                  <div className="p-6 text-center text-stone-400">
                    <Film className="mx-auto h-10 w-10 opacity-40" />
                    <p className="mt-2 text-xs">វីដេអូដែលអ្នកបង្កើតនឹងបង្ហាញនៅទីនេះ</p>
                  </div>
                )}
              </div>
            </div>

            {user && cloudVideoPrompts.length > 0 && (
              <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm">
                <h3 className="text-xs font-bold text-[var(--ink-secondary)]">
                  ប្រវត្តិអត្ថបទបង្កើតវីដេអូថ្មីៗ
                </h3>
                <div className="mt-3 space-y-2">
                  {cloudVideoPrompts.slice(0, 5).map((rec) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => {
                        setVideoPrompt(rec.prompt);
                        setAspectRatio(rec.aspectRatio);
                        setVideoDuration(rec.duration);
                      }}
                      className="block w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-2.5 text-left text-xs text-[var(--ink-primary)] hover:border-[var(--accent-main)]"
                    >
                      <p className="line-clamp-2">{rec.prompt}</p>
                      <p className="font-mono-num mt-1 text-[10px] text-[var(--ink-secondary)]">
                        {rec.aspectRatio} · {rec.duration}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

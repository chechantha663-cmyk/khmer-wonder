import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  LogIn,
  LogOut,
  Music,
  Palette,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_THEMES, type AppTheme } from '../data/themes';
import { AMBIENT_PROFILES } from '../utils/ambientMusic';
import {
  speakText,
  type VoiceEngine,
  type VoiceSettings,
} from '../utils/audio';

interface StudioSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTheme: AppTheme;
  onSelectTheme: (themeId: string) => void;
  onCycleTheme: () => void;
  voiceSettings: VoiceSettings;
  onUpdateVoiceSettings: (next: VoiceSettings) => void;
  musicPlaying: boolean;
  musicVolume: number;
  syncStoryMusic: boolean;
  activeSoundThemeId: string;
  onToggleMusic: () => void;
  onChangeMusicVolume: (val: number) => void;
  onToggleSyncStoryMusic: (enabled: boolean) => void;
  onOpenAdmin?: () => void;
}

export function StudioSettingsDrawer({
  open,
  onClose,
  activeTheme,
  onSelectTheme,
  onCycleTheme,
  voiceSettings,
  onUpdateVoiceSettings,
  musicPlaying,
  musicVolume,
  syncStoryMusic,
  activeSoundThemeId,
  onToggleMusic,
  onChangeMusicVolume,
  onToggleSyncStoryMusic,
  onOpenAdmin,
}: StudioSettingsDrawerProps) {
  const { user, isAdmin, signingIn, authError, signInWithGoogle, signOut } = useAuth();
  const activeSoundProfile =
    AMBIENT_PROFILES[activeSoundThemeId] || AMBIENT_PROFILES['angkor-amber'];
  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testNote, setTestNote] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      setDeviceVoices(list);
    };
    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  const update = (patch: Partial<VoiceSettings>) => {
    onUpdateVoiceSettings({ ...voiceSettings, ...patch });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            aria-label="ការកំណត់ផ្ទៃ និងសំឡេង"
            className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border-hairline)] bg-[var(--surface-elevated)] text-[var(--ink-primary)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Palette className="h-5 w-5 text-[var(--accent-main)]" />
                <h2 className="font-display text-lg font-bold">រូបភាព ពណ៌ និងសំឡេង</h2>
              </div>
              <button
                type="button"
                aria-label="បិទ"
                onClick={onClose}
                className="rounded-lg p-2 text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {/* Account & Cloud Sync */}
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4">
                {user ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'User'}
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-full border border-[var(--border-hairline)] object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-main)]">
                          <UserCheck className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                          {user.displayName || 'គណនី Google'}
                        </p>
                        <p className="truncate text-xs text-[var(--ink-secondary)]">
                          រក្សាទុកផ្កាយ ពិន្ទុហ្គេមរត់ប្រណាំង និងប្រវត្តិស្វ័យប្រវត្តិ
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={signOut}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      ចេញ
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                      ចូលគណនី Google ដើម្បីរក្សាទុកផ្កាយរឿងគំនិតជីវិត ពិន្ទុហ្គេមរត់ប្រណាំង និងឈ្មោះមិត្តភក្តិរបស់អ្នក។
                    </p>
                    <button
                      type="button"
                      disabled={signingIn}
                      onClick={signInWithGoogle}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-main)] px-4 py-2.5 text-xs font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
                    >
                      <LogIn className="h-4 w-4" />
                      {signingIn ? 'កំពុងចូលគណនី...' : 'ចូលគណនីដោយ Google'}
                    </button>
                    {authError && <p className="text-xs text-rose-500">{authError}</p>}
                  </div>
                )}

                {isAdmin && onOpenAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdmin();
                    }}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-main)] px-4 py-2.5 text-xs font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    បើក Admin Studio (ស្ថិតិ · រឿង · AI)
                  </button>
                )}
              </div>

              {/* Theme & Background Selector */}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--ink-primary)]">
                    ប្ដូររូបភាពផ្ទៃខាងក្រោយ និងពណ៌
                  </h3>
                  <button
                    type="button"
                    onClick={onCycleTheme}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-main)] hover:underline"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    ប្ដូររហ័ស
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  {APP_THEMES.map((t) => {
                    const selected = t.id === activeTheme.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTheme(t.id)}
                        className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                          selected
                            ? 'border-[var(--accent-main)] ring-2 ring-[var(--accent-main)]/30'
                            : 'border-[var(--border-hairline)] hover:border-[var(--accent-main)]'
                        }`}
                      >
                        <div className="relative h-20 w-full overflow-hidden bg-stone-800">
                          <img
                            src={t.image}
                            alt={t.nameKm}
                            referrerPolicy="no-referrer"
                            className="h-full w-full scale-110 object-cover transition-transform duration-300 group-hover:scale-115"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                          <span
                            className="absolute top-2 left-2 h-3.5 w-3.5 rounded-full border border-white/80 shadow"
                            style={{ backgroundColor: t.swatch }}
                          />
                          {selected && (
                            <span className="absolute top-2 right-2 grid h-5 w-5 place-items-center rounded-full bg-white text-stone-900 shadow">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <span className="absolute right-2 bottom-1.5 left-2 truncate text-xs font-bold text-white">
                            {t.nameKm}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ambient Background Music */}
              <div className="space-y-3 border-t border-[var(--border-hairline)] pt-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-[var(--accent-main)]" />
                    <h3 className="text-sm font-bold text-[var(--ink-primary)]">
                      តន្ត្រីបរិយាកាស (Ambient Music)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleMusic}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      musicPlaying
                        ? 'bg-[var(--accent-main)] text-[var(--accent-ink)]'
                        : 'border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] hover:border-[var(--accent-main)]'
                    }`}
                  >
                    {musicPlaying ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        ផ្អាកភ្លេង
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        ចាក់ភ្លេង
                      </>
                    )}
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--ink-primary)]">
                      {activeSoundProfile.labelKm}
                    </span>
                    <span className="text-[var(--ink-secondary)]">
                      {activeSoundProfile.moodLabelKm}
                    </span>
                  </div>

                  <div>
                    <label className="flex justify-between text-xs font-medium text-[var(--ink-secondary)]">
                      <span>កម្រិតសំឡេងភ្លេង</span>
                      <span className="font-mono-num">{Math.round(musicVolume * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={musicVolume}
                      onChange={(e) => onChangeMusicVolume(Number(e.target.value))}
                      className="mt-1.5 w-full accent-[var(--accent-main)]"
                    />
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-2.5 text-xs font-medium text-[var(--ink-primary)]">
                    <span>ប្ដូរភ្លេងស្វ័យប្រវត្តិតាមឈុតរឿងនិទាន</span>
                    <input
                      type="checkbox"
                      checked={syncStoryMusic}
                      onChange={(e) => onToggleSyncStoryMusic(e.target.checked)}
                      className="h-4 w-4 accent-[var(--accent-main)]"
                    />
                  </label>
                </div>
              </div>

              {/* Sound & Motion Toggles */}
              <div className="space-y-3 border-t border-[var(--border-hairline)] pt-5">
                <h3 className="text-sm font-bold text-[var(--ink-primary)]">សំឡេង និងផ្កាភ្លើង</h3>

                {[
                  {
                    key: 'voiceEnabled' as const,
                    label: 'អានអត្ថបទជាសំឡេង (TTS)',
                  },
                  {
                    key: 'sfxEnabled' as const,
                    label: 'សំឡេងបែបផែន (ជួង · មៀវ · កង់វិល)',
                  },
                  {
                    key: 'confettiEnabled' as const,
                    label: 'បាញ់ផ្កាភ្លើងអបអរសាទរ',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-3 text-sm font-medium"
                  >
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={voiceSettings[item.key]}
                      onChange={(e) => update({ [item.key]: e.target.checked })}
                      className="h-4 w-4 accent-[var(--accent-main)]"
                    />
                  </label>
                ))}
              </div>

              {/* Voice Engine */}
              <div className="space-y-3 border-t border-[var(--border-hairline)] pt-5">
                <h3 className="text-sm font-bold text-[var(--ink-primary)]">ម៉ាស៊ីនអានសំឡេង</h3>

                <div>
                  <label className="block text-xs font-medium text-[var(--ink-secondary)]">
                    ប្រភេទសំឡេង
                  </label>
                  <select
                    value={voiceSettings.engine}
                    onChange={(e) => update({ engine: e.target.value as VoiceEngine })}
                    className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm"
                  >
                    <option value="device">សំឡេងក្នុងឧបករណ៍ (រហ័ស · មិនបាច់ Key)</option>
                    <option value="google">Google អនឡាញ (ឥតគិតថ្លៃ)</option>
                    <option value="azure">Azure Neural (សំឡេងខ្មែរច្បាស់ — ត្រូវការ Key)</option>
                  </select>
                </div>

                {voiceSettings.engine === 'device' && deviceVoices.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink-secondary)]">
                      ជ្រើសសំឡេងក្នុងឧបករណ៍
                    </label>
                    <select
                      value={voiceSettings.deviceVoiceUri}
                      onChange={(e) => update({ deviceVoiceUri: e.target.value })}
                      className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm"
                    >
                      <option value="auto">ស្វ័យប្រវត្តិ (តាមភាសា)</option>
                      {deviceVoices.slice(0, 40).map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {voiceSettings.engine === 'azure' && (
                  <div className="space-y-2.5 rounded-xl bg-[var(--surface-subtle)] p-3.5">
                    <div>
                      <label className="block text-xs font-medium text-[var(--ink-secondary)]">
                        Azure Speech Key (រក្សាទុកតែលើឧបករណ៍អ្នក)
                      </label>
                      <input
                        type="password"
                        value={voiceSettings.azureKey}
                        onChange={(e) => update({ azureKey: e.target.value })}
                        placeholder="បិទភ្ជាប់ Key នៅទីនេះ"
                        className="mt-1 min-h-[40px] w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-medium text-[var(--ink-secondary)]">
                          Region
                        </label>
                        <input
                          type="text"
                          value={voiceSettings.azureRegion}
                          onChange={(e) => update({ azureRegion: e.target.value })}
                          placeholder="southeastasia"
                          className="mt-1 min-h-[40px] w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--ink-secondary)]">
                          ភេទសំឡេង
                        </label>
                        <select
                          value={voiceSettings.azureGender}
                          onChange={(e) =>
                            update({ azureGender: e.target.value as 'female' | 'male' })
                          }
                          className="mt-1 min-h-[40px] w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 text-sm"
                        >
                          <option value="female">ស្រី (Sreymom)</option>
                          <option value="male">ប្រុស (Piseth)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="flex justify-between text-xs font-medium text-[var(--ink-secondary)]">
                    <span>ល្បឿនអាន</span>
                    <span className="font-mono-num">{voiceSettings.rate}x</span>
                  </label>
                  <input
                    type="range"
                    min={0.75}
                    max={1.35}
                    step={0.05}
                    value={voiceSettings.rate}
                    onChange={(e) => update({ rate: Number(e.target.value) })}
                    className="mt-1.5 w-full accent-[var(--accent-main)]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTestNote('');
                    speakText('សួស្តី! សូមស្វាគមន៍មកកាន់សួនកម្សាន្តខ្មែរ។', voiceSettings, {
                      lang: 'km-KH',
                      onStatus: (m) => setTestNote(m),
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-main)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
                >
                  <Volume2 className="h-4 w-4" />
                  សាកល្បងសំឡេងខ្មែរ
                </button>
                {testNote && <p className="text-xs text-amber-600">{testNote}</p>}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

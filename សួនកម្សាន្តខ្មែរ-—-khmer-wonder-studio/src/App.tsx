import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { APP_THEMES, type StageMood } from './data/themes';
import { STORIES } from './data/stories';
import {
  loadVoiceSettings,
  playSfx,
  saveVoiceSettings,
  stopSpeech,
  type VoiceSettings,
} from './utils/audio';
import { ambientMusic, moodToAmbientThemeId } from './utils/ambientMusic';
import { useAuth } from './context/AuthContext';
import {
  fetchPublishedCustomStories,
  loadOrCreateUserProfile,
  logPageVisit,
  syncUserProfile,
  type CloudCustomStory,
  type PublicVisitSection,
} from './lib/firestoreStore';
import { ConfettiCanvas } from './components/ConfettiCanvas';
import { AmbientMusicBar } from './components/AmbientMusicBar';
import { HomeHubView, type AppSection } from './components/HomeHubView';
import { StoriesView } from './components/StoriesView';
import { WordGameView } from './components/WordGameView';
import { CatView } from './components/CatView';
import { FriendsView } from './components/FriendsView';
import { MathStudioView } from './components/MathStudioView';
import { AngkorGame3D } from './components/AngkorGame3D';
import { AdminStudioView } from './components/AdminStudioView';
import { StudioSettingsDrawer } from './components/StudioSettingsDrawer';

const THEME_STORAGE = 'khmerStudioTheme_v1';
const STARS_STORAGE = 'storyStars';
const FRIENDS_STORAGE = 'friends';
const BEST_3D_STORAGE = 'khmerStudioBest3D_v1';
const MUSIC_VOL_STORAGE = 'khmerStudioMusicVol_v1';
const MUSIC_SYNC_STORY_STORAGE = 'khmerStudioMusicSyncStory_v1';

const VISIT_SESSION_STORAGE = 'khmerStudioSessionId_v1';

const NAV_ITEMS: { id: Exclude<AppSection, 'HOME' | 'ADMIN'>; label: string }[] = [
  { id: 'STORIES', label: 'រឿងគំនិតជីវិត' },
  { id: 'GAME3D', label: 'ហ្គេមរត់ប្រណាំង' },
  { id: 'WORDS', label: 'ហ្គេមពាក្យ' },
  { id: 'CAT', label: 'ឆ្មាអាចារ្យ' },
  { id: 'MATH', label: 'គណិតវិទ្យា' },
];

function getOrCreateVisitSessionId(): string {
  try {
    const existing = sessionStorage.getItem(VISIT_SESSION_STORAGE);
    if (existing && existing.length >= 6) return existing;
    const created = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(VISIT_SESSION_STORAGE, created);
    return created;
  } catch {
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export default function App() {
  const { user, authReady, isAdmin } = useAuth();
  const [section, setSection] = useState<AppSection>('HOME');
  const [customStories, setCustomStories] = useState<CloudCustomStory[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  const [themeId, setThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE) || APP_THEMES[0].id;
    } catch {
      return APP_THEMES[0].id;
    }
  });

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(loadVoiceSettings);

  const [starsMap, setStarsMap] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STARS_STORAGE) || '{}');
    } catch {
      return {};
    }
  });

  const [friends, setFriends] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FRIENDS_STORAGE) || '[]');
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch {
      // ignore
    }
    return ['ធីតា', 'សុខា', 'ដារ៉ា', 'បុប្ផា'];
  });

  const [bestGameScore, setBestGameScore] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(BEST_3D_STORAGE));
      return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    } catch {
      return 0;
    }
  });

  const hydratedUidRef = useRef<string | null>(null);

  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(MUSIC_VOL_STORAGE));
      if (!Number.isNaN(saved) && saved >= 0 && saved <= 1 && localStorage.getItem(MUSIC_VOL_STORAGE) !== null) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 0.42;
  });
  const [syncStoryMusic, setSyncStoryMusic] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(MUSIC_SYNC_STORY_STORAGE);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [storyStageMood, setStoryStageMood] = useState<StageMood | null>(null);

  const activeTheme = useMemo(
    () => APP_THEMES.find((t) => t.id === themeId) || APP_THEMES[0],
    [themeId],
  );

  const isStorySynced = section === 'STORIES' && syncStoryMusic && storyStageMood !== null;

  const effectiveSoundThemeId = useMemo(
    () => (isStorySynced && storyStageMood ? moodToAmbientThemeId(storyStageMood) : activeTheme.id),
    [isStorySynced, storyStageMood, activeTheme.id],
  );

  // Sync theme CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(activeTheme.vars)) {
      root.style.setProperty(k, v);
    }
    try {
      localStorage.setItem(THEME_STORAGE, activeTheme.id);
    } catch {
      // ignore
    }
  }, [activeTheme]);

  // Sync ambient music theme seamlessly when theme or story scene mood changes
  useEffect(() => {
    ambientMusic.setTheme(effectiveSoundThemeId);
  }, [effectiveSoundThemeId]);

  // Sync ambient music volume & persist
  useEffect(() => {
    ambientMusic.setVolume(musicVolume);
    try {
      localStorage.setItem(MUSIC_VOL_STORAGE, String(musicVolume));
    } catch {
      // ignore
    }
  }, [musicVolume]);

  // Persist story-scene music sync preference
  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_SYNC_STORY_STORAGE, String(syncStoryMusic));
    } catch {
      // ignore
    }
  }, [syncStoryMusic]);

  // Clean up ambient music engine on unmount
  useEffect(() => {
    return () => {
      ambientMusic.stop();
    };
  }, []);

  const handleToggleMusic = useCallback(() => {
    if (musicPlaying) {
      ambientMusic.stop();
      setMusicPlaying(false);
    } else {
      ambientMusic.setVolume(musicVolume);
      ambientMusic.start(effectiveSoundThemeId);
      setMusicPlaying(true);
    }
  }, [musicPlaying, musicVolume, effectiveSoundThemeId]);

  const refreshPublishedStories = useCallback(async () => {
    try {
      const list = await fetchPublishedCustomStories();
      setCustomStories(list);
    } catch {
      // Built-in stories remain available even offline
    }
  }, []);

  useEffect(() => {
    refreshPublishedStories();
  }, [refreshPublishedStories]);

  // Throttled anonymous/signed-in visitor tracking for Admin Analytics
  const lastVisitLogRef = useRef<{ key: string; ts: number }>({ key: '', ts: 0 });
  useEffect(() => {
    if (!authReady) return;
    if (section === 'ADMIN') return;
    const visitSection = section as PublicVisitSection;
    const visitorType = user ? 'user' : 'guest';
    const visitorName = user?.displayName || 'ភ្ញៀវទូទៅ';
    const dedupeKey = `${visitSection}:${visitorType}:${user?.uid || 'guest'}`;
    const now = Date.now();
    if (
      lastVisitLogRef.current.key === dedupeKey &&
      now - lastVisitLogRef.current.ts < 180_000
    ) {
      return;
    }
    lastVisitLogRef.current = { key: dedupeKey, ts: now };
    logPageVisit({
      sessionId: getOrCreateVisitSessionId(),
      section: visitSection,
      visitorType,
      visitorName,
    });
  }, [authReady, section, user]);

  const allStories = useMemo(() => [...STORIES, ...customStories], [customStories]);

  const handleUpdateVoiceSettings = useCallback((next: VoiceSettings) => {
    setVoiceSettings(next);
    saveVoiceSettings(next);
  }, []);

  // Hydrate & merge user progress from Firestore on Google Sign-In
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      hydratedUidRef.current = null;
      return;
    }
    if (hydratedUidRef.current === user.uid) return;

    let cancelled = false;
    const hydrate = async () => {
      try {
        const cloud = await loadOrCreateUserProfile(user.uid, {
          displayName: user.displayName || 'អ្នកលេងខ្មែរ',
          themeId,
          starsMap,
          friends,
          bestGameScore,
        });
        if (cancelled) return;
        hydratedUidRef.current = user.uid;

        // Merge local + cloud stars (keep highest per story)
        const mergedStars: Record<string, number> = { ...cloud.starsMap };
        let needsPush = false;
        for (const [k, v] of Object.entries(starsMap)) {
          if ((mergedStars[k] || 0) < v) {
            mergedStars[k] = v;
            needsPush = true;
          }
        }
        const mergedBest = Math.max(cloud.bestGameScore, bestGameScore);
        if (mergedBest > cloud.bestGameScore) needsPush = true;

        setStarsMap(mergedStars);
        setBestGameScore(mergedBest);
        if (cloud.friends.length > 0) setFriends(cloud.friends);
        if (cloud.themeId) setThemeId(cloud.themeId);

        try {
          localStorage.setItem(STARS_STORAGE, JSON.stringify(mergedStars));
          localStorage.setItem(BEST_3D_STORAGE, String(mergedBest));
          if (cloud.friends.length > 0) {
            localStorage.setItem(FRIENDS_STORAGE, JSON.stringify(cloud.friends));
          }
        } catch {
          // ignore
        }

        if (needsPush) {
          await syncUserProfile(user.uid, {
            starsMap: mergedStars,
            bestGameScore: mergedBest,
          });
        }
      } catch {
        // Non-fatal; local state continues working seamlessly
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdateStars = useCallback(
    (storyId: string, earned: number) => {
      setStarsMap((prev) => {
        const best = Math.max(prev[storyId] || 0, earned);
        const next = { ...prev, [storyId]: best };
        try {
          localStorage.setItem(STARS_STORAGE, JSON.stringify(next));
        } catch {
          // ignore
        }
        if (user && hydratedUidRef.current === user.uid) {
          syncUserProfile(user.uid, { starsMap: next }).catch(() => {});
        }
        return next;
      });
    },
    [user],
  );

  const handleChangeFriends = useCallback(
    (next: string[]) => {
      setFriends(next);
      try {
        localStorage.setItem(FRIENDS_STORAGE, JSON.stringify(next));
      } catch {
        // ignore
      }
      if (user && hydratedUidRef.current === user.uid) {
        syncUserProfile(user.uid, { friends: next }).catch(() => {});
      }
    },
    [user],
  );

  const handleNewBestScore = useCallback(
    (nextScore: number) => {
      setBestGameScore((prev) => {
        const best = Math.max(prev, Math.floor(nextScore));
        try {
          localStorage.setItem(BEST_3D_STORAGE, String(best));
        } catch {
          // ignore
        }
        if (user && hydratedUidRef.current === user.uid) {
          syncUserProfile(user.uid, { bestGameScore: best }).catch(() => {});
        }
        return best;
      });
    },
    [user],
  );

  const handleNavigate = useCallback(
    (next: AppSection) => {
      stopSpeech();
      if (next !== 'STORIES') {
        setStoryStageMood(null);
      }
      setSection(next);
      playSfx('click', voiceSettings.sfxEnabled);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [voiceSettings.sfxEnabled],
  );

  const handleSelectTheme = useCallback(
    (id: string) => {
      setThemeId(id);
      playSfx('click', voiceSettings.sfxEnabled);
      if (user && hydratedUidRef.current === user.uid) {
        syncUserProfile(user.uid, { themeId: id }).catch(() => {});
      }
    },
    [user, voiceSettings.sfxEnabled],
  );

  const handleCycleTheme = useCallback(() => {
    const idx = APP_THEMES.findIndex((t) => t.id === activeTheme.id);
    const next = APP_THEMES[(idx + 1) % APP_THEMES.length];
    handleSelectTheme(next.id);
  }, [activeTheme.id, handleSelectTheme]);

  const triggerBurst = useCallback(() => {
    setBurstKey((k) => k + 1);
  }, []);

  const totalStars = useMemo(
    () => allStories.reduce((sum, s) => sum + (starsMap[s.id] || 0), 0),
    [allStories, starsMap],
  );

  // Full-Viewport Dedicated 3D Game Shell (zero overlapping website header/footer/blur)
  if (section === 'GAME3D') {
    return (
      <AngkorGame3D
        bestScore={bestGameScore}
        onNewBestScore={handleNewBestScore}
        onExit={() => handleNavigate('HOME')}
        sfxEnabledDefault={voiceSettings.sfxEnabled}
      />
    );
  }

  return (
    <div className="relative min-h-screen text-[var(--ink-primary)] transition-colors duration-300">
      {/* Ambient Animated Background Image + Measured Contrast Scrim */}
      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden" aria-hidden="true">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeTheme.image}
            src={activeTheme.image}
            alt=""
            referrerPolicy="no-referrer"
            initial={{ opacity: 0.25 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.25 }}
            transition={{ duration: 0.7 }}
            className="animate-slow-pan h-full w-full object-cover"
          />
        </AnimatePresence>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 transition-colors duration-500"
        style={{
          background: `linear-gradient(180deg, var(--scrim-top) 0%, var(--scrim-bottom) 68%, var(--surface-canvas) 100%)`,
          backdropFilter: 'blur(6px)',
        }}
      />

      <ConfettiCanvas burstKey={burstKey} enabled={voiceSettings.confettiEnabled} />

      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-hairline)] bg-[var(--surface-card)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNavigate('HOME')}
            className="font-display text-lg font-bold tracking-tight text-[var(--ink-primary)] transition-colors hover:text-[var(--accent-main)] whitespace-nowrap shrink-0"
          >
            សួនកម្សាន្តខ្មែរ
          </button>

          {/* Zone 2: 5 Clean Single-Line Text Nav Links */}
          <nav
            aria-label="ម៉ឺនុយចម្បង"
            className="hidden items-center gap-6 text-sm font-medium md:flex"
          >
            {NAV_ITEMS.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`relative py-1 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'font-bold text-[var(--accent-main)]'
                      : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute right-0 -bottom-1 left-0 h-0.5 rounded-full bg-[var(--accent-main)]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Action Controls (Admin button visible only for Admin) */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNavigate('ADMIN')}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  section === 'ADMIN'
                    ? 'border-[var(--accent-main)] bg-[var(--accent-soft)] text-[var(--accent-main)]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] hover:border-[var(--accent-main)]'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent-main)]" />
                Admin
              </button>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-main)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              ផ្ទៃ និងសំឡេង
            </button>
          </div>
        </div>

        {/* Compact Mobile Navigation Row */}
        <nav
          aria-label="ម៉ឺនុយទូរស័ព្ទ"
          className="flex items-center gap-1 overflow-x-auto border-t border-[var(--border-hairline)] px-3 py-1.5 md:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-main)]'
                    : 'text-[var(--ink-secondary)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {section === 'HOME' && (
              <HomeHubView
                activeTheme={activeTheme}
                onNavigate={handleNavigate}
                onCycleTheme={handleCycleTheme}
                onOpenSettings={() => setSettingsOpen(true)}
                stories={allStories}
                totalStars={totalStars}
                starsMap={starsMap}
                friendsCount={friends.length}
                bestGameScore={bestGameScore}
                isAdmin={isAdmin}
              />
            )}
            {section === 'STORIES' && (
              <StoriesView
                stories={allStories}
                voiceSettings={voiceSettings}
                onBurst={triggerBurst}
                starsMap={starsMap}
                onUpdateStars={handleUpdateStars}
                onStoryMoodChange={setStoryStageMood}
                onOpenAdmin={isAdmin ? () => handleNavigate('ADMIN') : undefined}
              />
            )}
            {section === 'ADMIN' && (
              <AdminStudioView
                voiceSettings={voiceSettings}
                onBurst={triggerBurst}
                onStoriesChanged={refreshPublishedStories}
                onOpenStories={() => handleNavigate('STORIES')}
                onGoHome={() => handleNavigate('HOME')}
              />
            )}
            {section === 'WORDS' && (
              <WordGameView voiceSettings={voiceSettings} onBurst={triggerBurst} />
            )}
            {section === 'CAT' && (
              <CatView
                voiceSettings={voiceSettings}
                friends={friends}
                onBurst={triggerBurst}
              />
            )}
            {section === 'FRIENDS' && (
              <FriendsView
                voiceSettings={voiceSettings}
                friends={friends}
                onChangeFriends={handleChangeFriends}
                onBurst={triggerBurst}
              />
            )}
            {section === 'MATH' && (
              <MathStudioView voiceSettings={voiceSettings} onBurst={triggerBurst} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Quiet Footer */}
      <footer className="mt-12 border-t border-[var(--border-hairline)] bg-[var(--surface-card)] pt-6 pb-24 text-center text-xs text-[var(--ink-secondary)] sm:pb-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <span>សួនកម្សាន្តខ្មែរ · រឿងនិទាន ហ្គេមពាក្យស្លោក និងគណិតវិទ្យា</span>
          <button
            type="button"
            onClick={handleCycleTheme}
            className="font-medium text-[var(--accent-main)] hover:underline"
          >
            ប្ដូរផ្ទៃខាងក្រោយ ({activeTheme.nameKm})
          </button>
        </div>
      </footer>

      <AmbientMusicBar
        playing={musicPlaying}
        volume={musicVolume}
        activeSoundThemeId={effectiveSoundThemeId}
        isStorySynced={isStorySynced}
        onTogglePlay={handleToggleMusic}
        onChangeVolume={setMusicVolume}
      />

      <StudioSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeTheme={activeTheme}
        onSelectTheme={handleSelectTheme}
        onCycleTheme={handleCycleTheme}
        voiceSettings={voiceSettings}
        onUpdateVoiceSettings={handleUpdateVoiceSettings}
        musicPlaying={musicPlaying}
        musicVolume={musicVolume}
        syncStoryMusic={syncStoryMusic}
        activeSoundThemeId={effectiveSoundThemeId}
        onToggleMusic={handleToggleMusic}
        onChangeMusicVolume={setMusicVolume}
        onToggleSyncStoryMusic={setSyncStoryMusic}
        onOpenAdmin={isAdmin ? () => handleNavigate('ADMIN') : undefined}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Film,
  Lightbulb,
  Pause,
  Plus,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  STORIES,
  type CharAction,
  type SceneWeather,
  type Story,
  type StoryCategory,
  type StoryQuestion,
} from '../data/stories';
import { STAGE_BACKDROPS, type StageMood } from '../data/themes';
import { playSfx, speakText, stopSpeech, type VoiceSettings } from '../utils/audio';
import { StoryStage } from './StoryStage';
import { StorytellerCatFacts } from './StorytellerCatFacts';

interface StoriesViewProps {
  stories?: Story[];
  voiceSettings: VoiceSettings;
  onBurst: () => void;
  starsMap: Record<string, number>;
  onUpdateStars: (storyId: string, stars: number) => void;
  onStoryMoodChange?: (mood: StageMood | null) => void;
  onOpenAdmin?: () => void;
}

type PlayPhase = 'STORY' | 'QUIZ' | 'POEM' | 'DONE';
type GalleryFilter = 'ALL' | 'DEEP' | 'FOLKTALE';

function shuffleArray<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeKhmer(s: string): string {
  return s.replace(/[\s\u200b\u200c\u200d.,!?។៕៖:;"'«»()\-]/g, '').toLowerCase();
}

function renderMarkedText(text: string) {
  return text.split(/[«»]/).map((part, idx) =>
    idx % 2 === 1 ? (
      <mark
        key={idx}
        className="rounded-md bg-amber-300/85 px-1.5 py-0.5 font-semibold text-stone-950"
      >
        {part}
      </mark>
    ) : (
      <span key={idx}>{part}</span>
    ),
  );
}

function getCategoryLabel(category?: StoryCategory): string {
  if (category === 'mystery') return 'បំបែកក្ដី';
  if (category === 'wisdom') return 'គំនិតជីវិត';
  return 'រឿងព្រេង';
}

function isDeepStory(story: Story): boolean {
  return (
    story.difficulty === 'hard' ||
    story.category === 'mystery' ||
    story.category === 'wisdom'
  );
}

export function StoriesView({
  stories = STORIES,
  voiceSettings,
  onBurst,
  starsMap,
  onUpdateStars,
  onStoryMoodChange,
  onOpenAdmin,
}: StoriesViewProps) {
  const [filter, setFilter] = useState<GalleryFilter>('ALL');
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [phase, setPhase] = useState<PlayPhase>('STORY');
  const [sceneIdx, setSceneIdx] = useState(0);
  const [autoRead, setAutoRead] = useState(true);
  const [cinemaAutoPlay, setCinemaAutoPlay] = useState(false);
  const [cinemaProgress, setCinemaProgress] = useState(0);

  // Shuffled Quiz State
  const [quizList, setQuizList] = useState<(StoryQuestion & { shuffledChoices: string[] })[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'hint' | 'err'; text: string } | null>(
    null,
  );

  const deepCount = useMemo(() => stories.filter(isDeepStory).length, [stories]);
  const classicCount = useMemo(
    () => stories.filter((s) => !isDeepStory(s)).length,
    [stories],
  );

  const filteredStories = useMemo(() => {
    if (filter === 'DEEP') return stories.filter(isDeepStory);
    if (filter === 'FOLKTALE') return stories.filter((s) => !isDeepStory(s));
    return stories;
  }, [stories, filter]);

  const totalStars = useMemo(
    () => stories.reduce((sum, s) => sum + (starsMap[s.id] || 0), 0),
    [stories, starsMap],
  );

  const speak = useCallback(
    (text: string) => {
      speakText(text, voiceSettings, { lang: 'km-KH', pitch: 1.06 });
    },
    [voiceSettings],
  );

  const openStory = useCallback(
    (story: Story, startCinema = false) => {
      stopSpeech();
      setActiveStory(story);
      setPhase('STORY');
      setSceneIdx(0);
      setQuizList([]);
      setQIdx(0);
      setCorrectCount(0);
      setFeedback(null);
      setTypedAnswer('');
      setSelectedChoice(null);
      setAnswered(false);
      setTries(0);
      setCinemaAutoPlay(startCinema);
      setCinemaProgress(0);
      playSfx('click', voiceSettings.sfxEnabled);
      if (autoRead && !isDeepStory(story)) {
        speak(story.scenes[0].text);
      }
    },
    [autoRead, speak, voiceSettings.sfxEnabled],
  );

  const goToScene = useCallback(
    (nextIndex: number) => {
      if (!activeStory) return;
      stopSpeech();
      setSceneIdx(nextIndex);
      setCinemaProgress(0);
      playSfx('click', voiceSettings.sfxEnabled);
      if (autoRead && !isDeepStory(activeStory)) {
        speak(activeStory.scenes[nextIndex].text);
      }
    },
    [activeStory, autoRead, speak, voiceSettings.sfxEnabled],
  );

  const startShuffledQuiz = useCallback(() => {
    if (!activeStory) return;
    stopSpeech();
    setCinemaAutoPlay(false);
    setCinemaProgress(0);
    const picked = shuffleArray(activeStory.quizPool)
      .slice(0, 3)
      .map((item) => ({
        ...item,
        shuffledChoices: shuffleArray(item.choices),
      }));
    setQuizList(picked);
    setQIdx(0);
    setCorrectCount(0);
    setTries(0);
    setAnswered(false);
    setTypedAnswer('');
    setSelectedChoice(null);
    setFeedback(null);
    setPhase('QUIZ');
    playSfx('click', voiceSettings.sfxEnabled);
    if (autoRead && !isDeepStory(activeStory) && picked[0]) {
      speak(picked[0].q);
    }
  }, [activeStory, autoRead, speak, voiceSettings.sfxEnabled]);

  const handleNextScene = useCallback(() => {
    if (!activeStory) return;
    if (sceneIdx < activeStory.scenes.length - 1) {
      goToScene(sceneIdx + 1);
    } else {
      startShuffledQuiz();
    }
  }, [activeStory, sceneIdx, goToScene, startShuffledQuiz]);

  const handlePrevScene = useCallback(() => {
    if (sceneIdx > 0) goToScene(sceneIdx - 1);
  }, [sceneIdx, goToScene]);

  // Cinema Auto-Play Movie Timer (longer reading window for deep adult stories)
  useEffect(() => {
    if (!activeStory || phase !== 'STORY' || !cinemaAutoPlay) {
      setCinemaProgress(0);
      return;
    }
    const durationMs = isDeepStory(activeStory) ? 12000 : 5800;
    const stepMs = 100;
    let elapsed = 0;
    const interval = window.setInterval(() => {
      elapsed += stepMs;
      setCinemaProgress(Math.min(100, (elapsed / durationMs) * 100));
      if (elapsed >= durationMs) {
        window.clearInterval(interval);
        handleNextScene();
      }
    }, stepMs);

    return () => window.clearInterval(interval);
  }, [activeStory, phase, sceneIdx, cinemaAutoPlay, handleNextScene]);

  // Keyboard shortcuts during story viewing
  useEffect(() => {
    if (!activeStory || phase !== 'STORY') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCinemaAutoPlay(false);
        handleNextScene();
      }
      if (e.key === 'ArrowLeft') {
        setCinemaAutoPlay(false);
        handlePrevScene();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeStory, phase, handleNextScene, handlePrevScene]);

  const activeMood: StageMood | null = activeStory
    ? phase === 'STORY'
      ? activeStory.scenes[sceneIdx]?.mood ?? activeStory.coverMood
      : activeStory.coverMood
    : null;

  useEffect(() => {
    onStoryMoodChange?.(activeMood);
  }, [activeMood, onStoryMoodChange]);

  useEffect(() => {
    return () => {
      stopSpeech();
      onStoryMoodChange?.(null);
    };
  }, [onStoryMoodChange]);

  const currentQuestion = quizList[qIdx];
  const isHardMode = activeStory ? isDeepStory(activeStory) : false;

  const evaluateAnswer = (rawInput: string, fromChoice?: string) => {
    if (!currentQuestion || answered) return;
    const norm = normalizeKhmer(rawInput);
    if (!norm) {
      playSfx('error', voiceSettings.sfxEnabled);
      setFeedback({ kind: 'err', text: 'សូមជ្រើស ឬវាយចម្លើយជាមុនសិនណា។' });
      return;
    }

    if (fromChoice) {
      setSelectedChoice(fromChoice);
    }

    const isCorrect =
      norm === normalizeKhmer(currentQuestion.ans) ||
      (!fromChoice && currentQuestion.keys.some((k) => norm.includes(normalizeKhmer(k))));

    if (isCorrect) {
      setAnswered(true);
      setCorrectCount((c) => c + 1);
      playSfx('success', voiceSettings.sfxEnabled);
      onBurst();
      setFeedback({
        kind: 'ok',
        text: isHardMode
          ? 'វិភាគបានយ៉ាងមុតស្រួច! ចម្លើយរបស់អ្នកត្រឹមត្រូវទាំងស្រុង។'
          : `ពូកែណាស់! ចម្លើយត្រឹមត្រូវគឺ «${currentQuestion.ans}»`,
      });
      if (autoRead && !isHardMode) speak(`ត្រូវហើយ! ${currentQuestion.ans}`);
    } else {
      const maxTries = isHardMode ? 1 : 2;
      const nextTries = tries + 1;
      setTries(nextTries);
      playSfx('error', voiceSettings.sfxEnabled);
      if (nextTries >= maxTries) {
        setAnswered(true);
        setFeedback({
          kind: 'err',
          text: isHardMode
            ? `មិនទាន់ត្រូវទេ! សូមពិនិត្យចម្លើយពិត និងការវិភាគខាងក្រោម។`
            : `មិនអីទេ! ចម្លើយត្រឹមត្រូវគឺ «${currentQuestion.ans}»`,
        });
      } else {
        setFeedback({
          kind: 'err',
          text: 'ជិតត្រូវហើយ! សាកល្បងម្ដងទៀត ឬចុចមើលជំនួយណា។',
        });
      }
    }
  };

  const handleNextQuestion = () => {
    if (!activeStory) return;
    stopSpeech();
    if (qIdx < quizList.length - 1) {
      const next = qIdx + 1;
      setQIdx(next);
      setTries(0);
      setAnswered(false);
      setTypedAnswer('');
      setSelectedChoice(null);
      setFeedback(null);
      if (autoRead && !isHardMode && quizList[next]) {
        speak(quizList[next].q);
      }
    } else {
      onUpdateStars(activeStory.id, correctCount);
      setPhase('POEM');
      playSfx('victory', voiceSettings.sfxEnabled);
      onBurst();
      if (autoRead && !isHardMode) {
        speak(activeStory.poem.join(' ។ '));
      }
    }
  };

  // ===== Gallery View =====
  if (!activeStory) {
    return (
      <section className="space-y-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[var(--accent-main)]">
              រឿងគំនិតជីវិត បំបែកក្ដី និងរឿងព្រេងខ្មែរ · {stories.length} រឿង
            </p>
            <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              បណ្ណាល័យរឿងគំនិតជីវិត និងបំបែកក្ដី
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-secondary)]">
              សាច់រឿងវែងជក់ចិត្តសម្រាប់មនុស្សធំ ភ្ជាប់តម្រុយបំបែកក្ដី និងគំនិតជីវិតស៊ីជម្រៅ
              ជាមួយសំណួរវិភាគកម្រិតពិបាក (ឆ្លើយបានតែ ១ ដង) រួមជាមួយរឿងព្រេងបុរាណខ្មែរ។
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-secondary)]">
            <span className="font-mono-num text-lg font-bold text-[var(--ink-primary)]">
              ⭐ {totalStars} / {stories.length * 3}
            </span>
            <span aria-hidden="true">·</span>
            <span>ផ្កាយសរុប</span>
            {onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="ml-1 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-main)] px-3.5 py-2 text-xs font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                បន្ថែមរឿងថ្មី (Admin)
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-hairline)] pb-4">
          {(
            [
              { id: 'ALL', label: `ទាំងអស់ (${stories.length})` },
              { id: 'DEEP', label: `គំនិតជីវិត & បំបែកក្ដី · ពិបាក (${deepCount})` },
              { id: 'FOLKTALE', label: `រឿងព្រេងបុរាណ (${classicCount})` },
            ] as { id: GalleryFilter; label: string }[]
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilter(tab.id);
                  playSfx('click', voiceSettings.sfxEnabled);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[var(--accent-main)] text-[var(--accent-ink)] shadow-sm'
                    : 'border border-[var(--border-hairline)] bg-[var(--surface-elevated)] text-[var(--ink-secondary)] hover:border-[var(--accent-main)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStories.map((story, index) => {
            const earned = starsMap[story.id] || 0;
            const cover = STAGE_BACKDROPS[story.coverMood];
            const deep = isDeepStory(story);
            return (
              <motion.button
                key={story.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.035 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openStory(story)}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--surface-elevated)] text-left shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-main)] ${
                  deep
                    ? 'border-[var(--accent-main)]/40'
                    : 'border-[var(--border-hairline)]'
                }`}
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-stone-900">
                  <img
                    src={cover}
                    alt={story.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full scale-[1.08] object-cover transition-transform duration-500 group-hover:scale-[1.16]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  <div className="animate-float-gentle absolute inset-0 flex items-center justify-center gap-3 text-4xl drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]">
                    <span>{story.chars[0]}</span>
                    <span>{story.chars[1]}</span>
                  </div>
                  <div className="font-mono-num absolute bottom-2.5 left-3 text-xs font-semibold text-white/95">
                    {'★'.repeat(earned)}
                    <span className="opacity-45">{'★'.repeat(3 - earned)}</span>
                  </div>
                  <span className="absolute right-3 bottom-2.5 text-[11px] font-semibold text-amber-200">
                    {deep ? 'កម្រិតពិបាក' : 'កម្រិតស្រាល'}
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <p className="text-xs font-semibold text-[var(--accent-main)]">
                      {getCategoryLabel(story.category)} · {story.scenes.length} ឈុតឆាក
                    </p>
                    <h2 className="font-display mt-1 text-base font-bold leading-snug text-[var(--ink-primary)] group-hover:text-[var(--accent-main)]">
                      {story.title}
                    </h2>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                    {story.moral}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>
    );
  }

  // ===== Active Story Player =====
  const scene = activeStory.scenes[sceneIdx];
  const stageMood: StageMood =
    phase === 'STORY' ? scene.mood : activeStory.coverMood;
  const stageWeather: SceneWeather =
    phase === 'STORY'
      ? scene.weather || (stageMood === 'night' ? 'fireflies' : 'leaves')
      : phase === 'POEM' || phase === 'DONE'
        ? 'sparkles'
        : 'petals';

  const charAAction: CharAction =
    phase === 'STORY'
      ? scene.actionA
      : phase === 'POEM' || phase === 'DONE'
        ? 'cheer'
        : feedback?.kind === 'ok'
          ? 'cheer'
          : feedback?.kind === 'err'
            ? 'shake'
            : 'idle';

  const charBAction: CharAction =
    phase === 'STORY'
      ? scene.actionB
      : phase === 'POEM'
        ? 'jump'
        : phase === 'DONE'
          ? 'cheer'
          : feedback?.kind === 'ok'
            ? 'cheer'
            : feedback?.kind === 'err'
              ? 'shake'
              : 'idle';

  const stageProp =
    phase === 'STORY'
      ? scene.prop
      : phase === 'QUIZ'
        ? feedback?.kind === 'ok'
          ? '🎉'
          : '❓'
        : phase === 'POEM'
          ? '💡'
          : '🏆';

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            setCinemaAutoPlay(false);
            setActiveStory(null);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3.5 py-2 text-sm font-medium text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-subtle)] whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          បញ្ជីរឿងទាំងអស់
        </button>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-display font-bold text-[var(--ink-primary)]">
            {activeStory.title}
          </span>
          {phase === 'STORY' && (
            <button
              type="button"
              onClick={() => {
                setCinemaAutoPlay((on) => !on);
                playSfx('click', voiceSettings.sfxEnabled);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                cinemaAutoPlay
                  ? 'bg-[var(--accent-main)] text-[var(--accent-ink)]'
                  : 'border border-[var(--border-hairline)] bg-[var(--surface-elevated)] text-[var(--ink-primary)] hover:border-[var(--accent-main)]'
              }`}
            >
              {cinemaAutoPlay ? <Pause className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
              {cinemaAutoPlay ? 'ផ្អាកចាក់ស្វ័យប្រវត្តិ' : 'ចាក់ជារឿងស្វ័យប្រវត្តិ'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !autoRead;
              setAutoRead(next);
              if (!next) stopSpeech();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--accent-main)] whitespace-nowrap shrink-0"
          >
            {autoRead ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {autoRead ? 'សំឡេង៖ បើក' : 'សំឡេង៖ បិទ'}
          </button>
        </div>
      </div>

      {/* Living Animated Storybook Stage */}
      <StoryStage
        storyId={activeStory.id}
        title={activeStory.title}
        sceneKey={`${activeStory.id}-${phase}-${sceneIdx}`}
        mood={stageMood}
        weather={stageWeather}
        charA={activeStory.chars[0]}
        charB={activeStory.chars[1]}
        actionA={charAAction}
        actionB={charBAction}
        prop={stageProp}
        bubbleA={phase === 'STORY' ? scene.bubbleA : undefined}
        bubbleB={phase === 'STORY' ? scene.bubbleB : undefined}
        sceneIdx={phase === 'STORY' ? sceneIdx : undefined}
        totalScenes={phase === 'STORY' ? activeStory.scenes.length : undefined}
        onSelectScene={(i) => {
          setCinemaAutoPlay(false);
          goToScene(i);
        }}
        onPokeChar={() => playSfx('click', voiceSettings.sfxEnabled)}
        autoPlayProgress={cinemaAutoPlay ? cinemaProgress : 0}
      />

      {/* Phase Panels */}
      <AnimatePresence mode="wait">
        {phase === 'STORY' && (
          <motion.div
            key={`story-${sceneIdx}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm sm:p-7"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-secondary)]">
              <span className="font-semibold text-[var(--accent-main)]">
                {getCategoryLabel(activeStory.category)} · វគ្គទី {sceneIdx + 1} /{' '}
                {activeStory.scenes.length}
              </span>
              {isHardMode && (
                <span>សូមអានព័ត៌មានលម្អិតឱ្យច្បាស់ ដើម្បីត្រៀមឆ្លើយសំណួរវិភាគ</span>
              )}
            </div>

            <p
              className={`text-[var(--ink-primary)] ${
                isHardMode
                  ? 'text-[16.5px] leading-[2.05] sm:text-[18.5px]'
                  : 'text-lg leading-[1.95] sm:text-xl'
              }`}
            >
              {renderMarkedText(scene.text)}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={sceneIdx === 0}
                  onClick={() => {
                    setCinemaAutoPlay(false);
                    handlePrevScene();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-primary)] transition-colors hover:opacity-90 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  ថយក្រោយ
                </button>
                <button
                  type="button"
                  onClick={() => speak(scene.text)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-subtle)] whitespace-nowrap shrink-0"
                >
                  <Volume2 className="h-4 w-4" />
                  ស្ដាប់វគ្គនេះ
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCinemaAutoPlay(false);
                  handleNextScene();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-main)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
              >
                {sceneIdx < activeStory.scenes.length - 1
                  ? 'វគ្គបន្ទាប់'
                  : isHardMode
                    ? 'ចូលបំបែកសំណួរវិភាគ'
                    : 'ចូលឆ្លើយសំណួរឆ្លាស់'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'QUIZ' && currentQuestion && (
          <motion.div
            key={`quiz-${qIdx}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--ink-secondary)]">
              <span className="font-mono-num font-semibold text-[var(--accent-main)]">
                {isHardMode
                  ? `សំណួរវិភាគទី ${qIdx + 1} / ${quizList.length} · កម្រិតពិបាក (ឆ្លើយបានតែ ១ ដង)`
                  : `សំណួរឆ្លាស់ទី ${qIdx + 1} / ${quizList.length}`}
              </span>
              <button
                type="button"
                onClick={() => speak(currentQuestion.q)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-primary)] hover:text-[var(--accent-main)]"
              >
                <Volume2 className="h-4 w-4" />
                អានសំណួរ
              </button>
            </div>

            <h3 className="font-display mt-2.5 text-xl font-bold leading-relaxed text-[var(--ink-primary)]">
              {currentQuestion.q}
            </h3>

            <div
              className={`mt-5 grid gap-3 ${
                isHardMode ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
              }`}
            >
              {currentQuestion.shuffledChoices.map((choice, cIdx) => {
                const isRightChoice =
                  normalizeKhmer(choice) === normalizeKhmer(currentQuestion.ans);
                const isPickedWrong =
                  answered && selectedChoice === choice && !isRightChoice;
                const letters = ['ក', 'ខ', 'គ', 'ឃ'];
                return (
                  <button
                    key={choice}
                    type="button"
                    disabled={answered}
                    onClick={() => evaluateAnswer(choice, choice)}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] leading-relaxed font-medium transition-all ${
                      answered && isRightChoice
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                        : isPickedWrong
                          ? 'border-rose-500 bg-rose-50 text-rose-950'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] hover:border-[var(--accent-main)] hover:bg-[var(--accent-soft)]'
                    }`}
                  >
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-current/25 text-xs font-bold">
                      {letters[cIdx] || cIdx + 1}
                    </span>
                    <span>{choice}</span>
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (answered) handleNextQuestion();
                else evaluateAnswer(typedAnswer);
              }}
              className="mt-5 flex flex-col gap-2 sm:flex-row"
            >
              {!isHardMode && (
                <input
                  type="text"
                  disabled={answered}
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  placeholder="ឬវាយពាក្យគន្លឹះដោយខ្លួនឯងនៅទីនេះ..."
                  className="min-h-[44px] flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3.5 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
                />
              )}
              {!answered ? (
                <div className="flex flex-wrap gap-2">
                  {!isHardMode && (
                    <button
                      type="submit"
                      className="rounded-lg bg-[var(--accent-main)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
                    >
                      ផ្ទៀងផ្ទាត់
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setFeedback({ kind: 'hint', text: `តម្រុយ៖ ${currentQuestion.hint}` })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-medium text-[var(--ink-primary)] hover:opacity-90 whitespace-nowrap shrink-0"
                  >
                    <Lightbulb className="h-4 w-4 text-[var(--accent-main)]" />
                    មើលតម្រុយជំនួយ
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-main)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
                >
                  {qIdx < quizList.length - 1
                    ? 'សំណួរបន្ទាប់'
                    : isHardMode
                      ? 'អានការបំបែកគតិជីវិត'
                      : 'អានកំណាព្យបញ្ចប់'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </form>

            {feedback && (
              <p
                role="status"
                className={`mt-4 text-sm font-semibold ${
                  feedback.kind === 'ok'
                    ? 'text-emerald-600'
                    : feedback.kind === 'err'
                      ? 'text-rose-600'
                      : 'text-[var(--accent-main)]'
                }`}
              >
                {feedback.text}
              </p>
            )}

            {answered && currentQuestion.explanation && (
              <div className="mt-4 rounded-xl border border-[var(--accent-main)]/35 bg-[var(--accent-soft)] p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-main)]">
                  <BookOpen className="h-3.5 w-3.5" />
                  ការវិភាគចម្លើយ និងតម្រុយក្នុងរឿង
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-primary)]">
                  {currentQuestion.explanation}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {phase === 'POEM' && (
          <motion.div
            key="poem"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm sm:p-7"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--accent-main)]">
                {activeStory.reflection ? 'គតិជីវិត និងការបំបែកក្ដី' : 'កំណាព្យសង្ខេបរឿង'}
              </p>
              <h3 className="font-display mt-1 text-2xl font-bold text-[var(--ink-primary)]">
                {activeStory.title}
              </h3>
            </div>

            {activeStory.reflection && (
              <div className="rounded-xl border border-[var(--accent-main)]/35 bg-[var(--accent-soft)] p-5">
                <p className="text-[15.5px] leading-[1.95] text-[var(--ink-primary)]">
                  {activeStory.reflection}
                </p>
              </div>
            )}

            <div className="space-y-2.5 border-t border-[var(--border-hairline)] pt-4">
              {activeStory.poem.map((line, i) => (
                <motion.p
                  key={line}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.35, duration: 0.4 }}
                  className="text-lg font-medium text-[var(--ink-primary)]"
                >
                  ♪ {line}
                </motion.p>
              ))}
            </div>
            <p className="text-sm text-[var(--ink-secondary)]">
              តម្លៃអប់រំ៖ {activeStory.moral}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  speak(
                    activeStory.reflection
                      ? `${activeStory.reflection} ។ ${activeStory.poem.join(' ។ ')}`
                      : activeStory.poem.join(' ។ '),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-primary)] whitespace-nowrap shrink-0"
              >
                <Volume2 className="h-4 w-4" />
                ស្តាប់គតិបញ្ចប់
              </button>
              <button
                type="button"
                onClick={() => {
                  stopSpeech();
                  setPhase('DONE');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-main)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
              >
                មើលលទ្ធផលផ្កាយ
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'DONE' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-7 text-center shadow-sm"
          >
            <div className="text-4xl tracking-widest">
              {'⭐'.repeat(correctCount)}
              {'☆'.repeat(3 - correctCount)}
            </div>
            <h3 className="font-display mt-3 text-2xl font-bold text-[var(--ink-primary)]">
              {correctCount === 3
                ? isHardMode
                  ? 'ប្រាជ្ញាមុតស្រួចណាស់! បំបែកបានពេញ ៣/៣'
                  : 'អស្ចារ្យណាស់! ឆ្លើយត្រូវពេញ ៣/៣'
                : correctCount >= 1
                  ? `ល្អណាស់! អ្នកទទួលបាន ${correctCount} / ៣ ផ្កាយ`
                  : 'សំណួរនេះពិបាកគិតមែន — សាកអានម្ដងទៀតដើម្បីចាប់តម្រុយ!'}
            </h3>
            <p className="mt-2 text-sm text-[var(--ink-secondary)]">
              រាល់ពេលលេងម្ដងទៀត សំណួរវិភាគនឹងឆ្លាស់គ្នាថ្មីជានិច្ច។
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const idx = stories.findIndex((s) => s.id === activeStory.id);
                  openStory(stories[(idx + 1) % stories.length]);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-main)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
              >
                រឿងបន្ទាប់
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openStory(activeStory)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-primary)] whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-4 w-4" />
                អាន និងសាកល្បងម្ដងទៀត
              </button>
              <button
                type="button"
                onClick={() => setActiveStory(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-primary)] whitespace-nowrap shrink-0"
              >
                បញ្ជីរឿងទាំងអស់
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storyteller Cat Periodic Khmer Culture Fun-Fact Thought Bubbles */}
      <StorytellerCatFacts
        storyId={activeStory.id}
        voiceSettings={voiceSettings}
      />
    </section>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ChevronRight,
  Flame,
  Heart,
  Lightbulb,
  RotateCcw,
  Trophy,
  Volume2,
} from 'lucide-react';
import {
  KEYWORD_RIDDLE_ITEMS,
  PROVERB_FILL_ITEMS,
  PROVERB_SCRAMBLE_ITEMS,
  type KeywordRiddleItem,
  type ProverbFillItem,
  type ProverbScrambleItem,
} from '../data/wordGames';
import { playSfx, speakText, stopSpeech, type VoiceSettings } from '../utils/audio';

interface WordGameViewProps {
  voiceSettings: VoiceSettings;
  onBurst: () => void;
}

type GameMode = 'PROVERB_FILL' | 'KEYWORD_RIDDLE' | 'PROVERB_SCRAMBLE';
type GameScreen = 'MENU' | 'PLAYING' | 'RESULT';

interface HighScores {
  PROVERB_FILL: number;
  KEYWORD_RIDDLE: number;
  PROVERB_SCRAMBLE: number;
}

const SCORE_STORAGE = 'khmerWordGameHighScores_v1';

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normKm(s: string): string {
  return s.replace(/[\s\u200b\u200c\u200d.,!?។៕៖:;"'«»()\-]/g, '').toLowerCase();
}

function loadHighScores(): HighScores {
  try {
    const raw = localStorage.getItem(SCORE_STORAGE);
    if (!raw) return { PROVERB_FILL: 0, KEYWORD_RIDDLE: 0, PROVERB_SCRAMBLE: 0 };
    return { PROVERB_FILL: 0, KEYWORD_RIDDLE: 0, PROVERB_SCRAMBLE: 0, ...JSON.parse(raw) };
  } catch {
    return { PROVERB_FILL: 0, KEYWORD_RIDDLE: 0, PROVERB_SCRAMBLE: 0 };
  }
}

export function WordGameView({ voiceSettings, onBurst }: WordGameViewProps) {
  const [screen, setScreen] = useState<GameScreen>('MENU');
  const [mode, setMode] = useState<GameMode>('PROVERB_FILL');
  const [highScores, setHighScores] = useState<HighScores>(loadHighScores);

  // Active game state
  const [roundIdx, setRoundIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [solvedCount, setSolvedCount] = useState(0);
  const [roundLocked, setRoundLocked] = useState(false);
  const [roundFeedback, setRoundFeedback] = useState<{
    ok: boolean;
    title: string;
    detail: string;
  } | null>(null);

  // Mode 1: Proverb Fill deck
  const [proverbDeck, setProverbDeck] = useState<(ProverbFillItem & { choices: string[] })[]>([]);
  // Mode 2: Keyword Riddle deck
  const [riddleDeck, setRiddleDeck] = useState<(KeywordRiddleItem & { choices: string[] })[]>([]);
  const [showClue2, setShowClue2] = useState(false);
  const [riddleInput, setRiddleInput] = useState('');
  // Mode 3: Proverb Scramble deck
  const [scrambleDeck, setScrambleDeck] = useState<
    (ProverbScrambleItem & { pool: { id: number; text: string }[] })[]
  >([]);
  const [pickedTiles, setPickedTiles] = useState<{ id: number; text: string }[]>([]);

  const totalRounds =
    mode === 'PROVERB_FILL'
      ? proverbDeck.length
      : mode === 'KEYWORD_RIDDLE'
        ? riddleDeck.length
        : scrambleDeck.length;

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  const persistHighScore = useCallback(
    (m: GameMode, nextScore: number) => {
      setHighScores((prev) => {
        if (nextScore <= prev[m]) return prev;
        const updated = { ...prev, [m]: nextScore };
        try {
          localStorage.setItem(SCORE_STORAGE, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    },
    [],
  );

  const startGame = (selectedMode: GameMode) => {
    stopSpeech();
    setMode(selectedMode);
    setRoundIdx(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setLives(3);
    setSolvedCount(0);
    setRoundLocked(false);
    setRoundFeedback(null);
    setShowClue2(false);
    setRiddleInput('');
    setPickedTiles([]);

    if (selectedMode === 'PROVERB_FILL') {
      const deck = shuffle(PROVERB_FILL_ITEMS)
        .slice(0, 8)
        .map((item) => ({
          ...item,
          choices: shuffle([item.answer, ...item.distractors]),
        }));
      setProverbDeck(deck);
    } else if (selectedMode === 'KEYWORD_RIDDLE') {
      const deck = shuffle(KEYWORD_RIDDLE_ITEMS)
        .slice(0, 8)
        .map((item) => ({
          ...item,
          choices: shuffle([item.answer, ...item.distractors]),
        }));
      setRiddleDeck(deck);
    } else {
      const deck = shuffle(PROVERB_SCRAMBLE_ITEMS)
        .slice(0, 6)
        .map((item) => ({
          ...item,
          pool: shuffle(item.tiles.map((text, idx) => ({ id: idx, text }))),
        }));
      setScrambleDeck(deck);
    }

    setScreen('PLAYING');
    playSfx('click', voiceSettings.sfxEnabled);
  };

  const awardCorrect = (title: string, detail: string, speakPhrase?: string) => {
    const nextStreak = streak + 1;
    const bonus = nextStreak >= 3 ? 50 : nextStreak === 2 ? 25 : 0;
    const points = 100 + bonus;
    const nextScore = score + points;
    setScore(nextScore);
    setStreak(nextStreak);
    setBestStreak((b) => Math.max(b, nextStreak));
    setSolvedCount((c) => c + 1);
    setRoundLocked(true);
    persistHighScore(mode, nextScore);
    setRoundFeedback({
      ok: true,
      title: `${title} (+${points} ពិន្ទុ${bonus ? ` · Combo x${nextStreak}` : ''})`,
      detail,
    });
    playSfx('success', voiceSettings.sfxEnabled);
    onBurst();
    if (speakPhrase) speakText(speakPhrase, voiceSettings, { lang: 'km-KH' });
  };

  const penalizeWrong = (title: string, detail: string) => {
    const nextLives = lives - 1;
    setLives(nextLives);
    setStreak(0);
    setRoundLocked(true);
    setRoundFeedback({ ok: false, title, detail });
    playSfx('error', voiceSettings.sfxEnabled);
  };

  const advanceRound = () => {
    stopSpeech();
    if (lives <= 0 || roundIdx + 1 >= totalRounds) {
      persistHighScore(mode, score);
      setScreen('RESULT');
      if (lives > 0) {
        playSfx('victory', voiceSettings.sfxEnabled);
        onBurst();
      }
      return;
    }
    setRoundIdx((i) => i + 1);
    setRoundLocked(false);
    setRoundFeedback(null);
    setShowClue2(false);
    setRiddleInput('');
    setPickedTiles([]);
    playSfx('click', voiceSettings.sfxEnabled);
  };

  // Mode 1 Answer Handler
  const handleProverbChoice = (choice: string) => {
    const item = proverbDeck[roundIdx];
    if (!item || roundLocked) return;
    const full = `${item.before} ${item.answer}${item.after ? ` ${item.after}` : ''}`;
    if (choice === item.answer) {
      awardCorrect('ត្រឹមត្រូវ!', `${full} — ${item.meaning}`, full);
    } else {
      penalizeWrong(`ចម្លើយត្រឹមត្រូវ៖ «${item.answer}»`, `${full} — ${item.meaning}`);
    }
  };

  // Mode 2 Answer Handler
  const handleRiddleSubmit = (val: string) => {
    const item = riddleDeck[roundIdx];
    if (!item || roundLocked) return;
    const cleaned = normKm(val);
    if (!cleaned) return;
    const ok =
      cleaned === normKm(item.answer) || item.accepts.some((a) => cleaned.includes(normKm(a)));
    if (ok) {
      awardCorrect(`ពាក្យគន្លឹះត្រូវហើយ៖ «${item.answer}»`, item.clue1, item.answer);
    } else {
      penalizeWrong(`មិនទាន់ត្រូវទេ! ពាក្យគន្លឹះគឺ «${item.answer}»`, item.clue1);
    }
  };

  // Mode 3 Tile Tap Handler
  const handleScrambleTap = (tile: { id: number; text: string }) => {
    const item = scrambleDeck[roundIdx];
    if (!item || roundLocked) return;
    if (pickedTiles.some((t) => t.id === tile.id)) return;
    const next = [...pickedTiles, tile];
    setPickedTiles(next);
    playSfx('tick', voiceSettings.sfxEnabled);

    if (next.length === item.tiles.length) {
      const built = next.map((t) => t.text).join(' ');
      const target = item.tiles.join(' ');
      if (built === target) {
        awardCorrect('តម្រៀបបានយ៉ាងល្អឥតខ្ចោះ!', `${target} — ${item.meaning}`, target);
      } else {
        penalizeWrong(`លំដាប់ត្រឹមត្រូវគឺ៖ «${target}»`, item.meaning);
      }
    }
  };

  const removePickedTile = (tileId: number) => {
    if (roundLocked) return;
    setPickedTiles((prev) => prev.filter((t) => t.id !== tileId));
    playSfx('click', voiceSettings.sfxEnabled);
  };

  // ===== MENU SCREEN =====
  if (screen === 'MENU') {
    const cards: {
      mode: GameMode;
      emoji: string;
      title: string;
      subtitle: string;
      meta: string;
    }[] = [
      {
        mode: 'PROVERB_FILL',
        emoji: '📜',
        title: 'បំពេញពាក្យស្លោកខ្មែរ',
        subtitle: 'ជ្រើសពាក្យគន្លឹះបំពេញពាក្យស្លោកបុរាណខ្មែរ ព្រមទាំងស្វែងយល់អត្ថន័យអប់រំ។',
        meta: `៨ សំណួរឆ្លាស់ · កំណត់ត្រា ${highScores.PROVERB_FILL} ពិន្ទុ`,
      },
      {
        mode: 'KEYWORD_RIDDLE',
        emoji: '🔎',
        title: 'ទាយពាក្យគន្លឹះពីតម្រុយ',
        subtitle: 'មើលរូបភាព Emoji និងតម្រុយ ២ ជំហាន ដើម្បីទាយពាក្យគន្លឹះឱ្យបានលឿន។',
        meta: `៨ តម្រុយឆ្លាស់ · កំណត់ត្រា ${highScores.KEYWORD_RIDDLE} ពិន្ទុ`,
      },
      {
        mode: 'PROVERB_SCRAMBLE',
        emoji: '🧩',
        title: 'តម្រៀបប្លុកពាក្យស្លោក',
        subtitle: 'ចុចតម្រៀបពាក្យដែលច្របល់គ្នា ឱ្យក្លាយជាពាក្យស្លោកខ្មែរពេញលេញត្រឹមត្រូវ។',
        meta: `៦ ល្បែងផ្គុំ · កំណត់ត្រា ${highScores.PROVERB_SCRAMBLE} ពិន្ទុ`,
      },
    ];

    return (
      <section className="space-y-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--accent-main)]">
            ហ្គេមពាក្យគន្លឹះ និងពាក្យស្លោកខ្មែរ · ដាច់ដោយឡែកពីរឿងនិទាន
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            សង្វៀនប្រកួតពាក្យស្លោក និងពាក្យគន្លឹះ
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-secondary)]">
            ជ្រើសរបៀបលេងមួយក្នុងចំណោម ៣ របៀបខាងក្រោម ដើម្បីសាកល្បងប្រាជ្ញា រក្សា Combo Streak
            និងបំបែកកំណត់ត្រាពិន្ទុខ្ពស់បំផុត!
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {cards.map((c, idx) => (
            <motion.div
              key={c.mode}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.06 }}
              className="flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-4xl">{c.emoji}</span>
                  <span className="font-mono-num text-xs font-medium text-[var(--ink-secondary)]">
                    របៀបទី 0{idx + 1}
                  </span>
                </div>
                <h2 className="font-display mt-4 text-xl font-bold text-[var(--ink-primary)]">
                  {c.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
                  {c.subtitle}
                </p>
              </div>

              <div className="mt-6 border-t border-[var(--border-hairline)] pt-4">
                <p className="font-mono-num text-xs text-[var(--ink-secondary)]">{c.meta}</p>
                <button
                  type="button"
                  onClick={() => startGame(c.mode)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-main)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] whitespace-nowrap"
                >
                  ចាប់ផ្ដើមលេង
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  // ===== RESULT SCREEN =====
  if (screen === 'RESULT') {
    const won = lives > 0;
    return (
      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-8 text-center shadow-sm"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-3xl text-[var(--accent-main)]">
          <Trophy className="h-8 w-8" />
        </div>
        <h2 className="font-display mt-4 text-2xl font-bold text-[var(--ink-primary)]">
          {won ? 'អបអរសាទរ! អ្នកបញ្ចប់វគ្គដោយជោគជ័យ' : 'អស់បេះដូងហើយ — សាកល្បងម្ដងទៀតណា!'}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">
          ឆ្លើយត្រូវ {solvedCount} / {totalRounds} · Combo ខ្ពស់បំផុត x{bestStreak}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-[var(--surface-subtle)] p-4">
          <div>
            <p className="text-xs text-[var(--ink-secondary)]">ពិន្ទុជុំនេះ</p>
            <p className="font-mono-num mt-1 text-3xl font-bold text-[var(--accent-main)]">
              {score}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--ink-secondary)]">កំណត់ត្រាខ្ពស់បំផុត</p>
            <p className="font-mono-num mt-1 text-3xl font-bold text-[var(--ink-primary)]">
              {highScores[mode]}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => startGame(mode)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-main)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            លេងម្ដងទៀត
          </button>
          <button
            type="button"
            onClick={() => setScreen('MENU')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--ink-primary)] whitespace-nowrap shrink-0"
          >
            ប្ដូររបៀបហ្គេម
          </button>
        </div>
      </motion.section>
    );
  }

  // ===== PLAYING ARENA =====
  const currentProverb = mode === 'PROVERB_FILL' ? proverbDeck[roundIdx] : null;
  const currentRiddle = mode === 'KEYWORD_RIDDLE' ? riddleDeck[roundIdx] : null;
  const currentScramble = mode === 'PROVERB_SCRAMBLE' ? scrambleDeck[roundIdx] : null;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {/* Unobtrusive Top Game HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-4 py-3">
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            setScreen('MENU');
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          ត្រឡប់ក្រោយ
        </button>

        <div className="flex flex-wrap items-center gap-5 text-sm">
          <span className="font-mono-num font-semibold text-[var(--ink-primary)]">
            វគ្គ {roundIdx + 1} / {totalRounds}
          </span>
          <span className="inline-flex items-center gap-1 font-mono-num font-bold text-[var(--accent-main)]">
            <Trophy className="h-4 w-4" />
            {score}
          </span>
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1 font-mono-num font-bold text-amber-600">
              <Flame className="h-4 w-4" />
              x{streak}
            </span>
          )}
          <span className="inline-flex items-center gap-1" aria-label={`បេះដូងនៅសល់ ${lives}`}>
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                className={`h-4 w-4 ${
                  i < lives ? 'fill-rose-500 text-rose-500' : 'text-[var(--border-hairline)]'
                }`}
              />
            ))}
          </span>
        </div>
      </div>

      {/* Mode 1: Proverb Fill */}
      <AnimatePresence mode="wait">
        {currentProverb && (
          <motion.div
            key={currentProverb.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm sm:p-8"
          >
            <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)]">
              <span>ពាក្យស្លោកខ្មែរ · ជ្រើសពាក្យគន្លឹះបំពេញចន្លោះ</span>
              <button
                type="button"
                onClick={() =>
                  speakText(
                    `${currentProverb.before} ${roundLocked ? currentProverb.answer : ''} ${currentProverb.after}`,
                    voiceSettings,
                    { lang: 'km-KH' },
                  )
                }
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ink-primary)] hover:text-[var(--accent-main)]"
              >
                <Volume2 className="h-4 w-4" />
                ស្តាប់
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-[var(--surface-subtle)] p-6 text-center">
              <p className="font-display text-2xl leading-[1.85] font-bold text-[var(--ink-primary)] sm:text-3xl">
                « {currentProverb.before}{' '}
                <span
                  className={`mx-1 inline-block min-w-[130px] rounded-lg border-2 border-dashed px-3 py-0.5 align-middle ${
                    roundLocked
                      ? 'border-emerald-600 bg-emerald-100 text-emerald-900'
                      : 'border-[var(--accent-main)] bg-[var(--accent-soft)] text-[var(--accent-main)]'
                  }`}
                >
                  {roundLocked ? currentProverb.answer : '.......'}
                </span>{' '}
                {currentProverb.after} »
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentProverb.choices.map((choice) => {
                const isAnswer = choice === currentProverb.answer;
                return (
                  <motion.button
                    key={choice}
                    type="button"
                    disabled={roundLocked}
                    whileHover={roundLocked ? undefined : { y: -2 }}
                    whileTap={roundLocked ? undefined : { scale: 0.98 }}
                    onClick={() => handleProverbChoice(choice)}
                    className={`min-h-[52px] rounded-xl border px-4 py-3 text-base font-semibold transition-colors ${
                      roundLocked && isAnswer
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                        : 'border-[var(--border-hairline)] bg-[var(--surface-elevated)] text-[var(--ink-primary)] hover:border-[var(--accent-main)] hover:bg-[var(--accent-soft)]'
                    }`}
                  >
                    {choice}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Mode 2: Keyword Riddle */}
        {currentRiddle && (
          <motion.div
            key={currentRiddle.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm sm:p-8"
          >
            <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)]">
              <span>ទាយពាក្យគន្លឹះ · ប្រភេទ {currentRiddle.category}</span>
              <button
                type="button"
                onClick={() => speakText(currentRiddle.clue1, voiceSettings, { lang: 'km-KH' })}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ink-primary)] hover:text-[var(--accent-main)]"
              >
                <Volume2 className="h-4 w-4" />
                អានតម្រុយ
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-[var(--surface-subtle)] p-6 text-center">
              <div className="animate-float-gentle text-5xl tracking-[0.25em] sm:text-6xl">
                {currentRiddle.emojis}
              </div>
              <p className="mt-4 text-lg font-semibold text-[var(--ink-primary)]">
                {currentRiddle.clue1}
              </p>
              {showClue2 ? (
                <p className="mt-2 text-sm text-[var(--accent-main)]">
                  តម្រុយបន្ថែម៖ {currentRiddle.clue2}
                </p>
              ) : (
                !roundLocked && (
                  <button
                    type="button"
                    onClick={() => setShowClue2(true)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-main)] hover:underline"
                  >
                    <Lightbulb className="h-4 w-4" />
                    បើកតម្រុយទី ២
                  </button>
                )
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {currentRiddle.choices.map((choice) => {
                const isAnswer = choice === currentRiddle.answer;
                return (
                  <motion.button
                    key={choice}
                    type="button"
                    disabled={roundLocked}
                    whileHover={roundLocked ? undefined : { y: -2 }}
                    whileTap={roundLocked ? undefined : { scale: 0.98 }}
                    onClick={() => handleRiddleSubmit(choice)}
                    className={`min-h-[50px] rounded-xl border px-4 py-3 text-base font-semibold transition-colors ${
                      roundLocked && isAnswer
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                        : 'border-[var(--border-hairline)] bg-[var(--surface-elevated)] text-[var(--ink-primary)] hover:border-[var(--accent-main)] hover:bg-[var(--accent-soft)]'
                    }`}
                  >
                    {choice}
                  </motion.button>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRiddleSubmit(riddleInput);
              }}
              className="mt-4 flex gap-2"
            >
              <input
                type="text"
                disabled={roundLocked}
                value={riddleInput}
                onChange={(e) => setRiddleInput(e.target.value)}
                placeholder="ឬវាយពាក្យគន្លឹះនៅទីនេះ..."
                className="min-h-[44px] flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3.5 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={roundLocked}
                className="rounded-lg bg-[var(--accent-main)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                ផ្ញើចម្លើយ
              </button>
            </form>
          </motion.div>
        )}

        {/* Mode 3: Proverb Tile Scramble */}
        {currentScramble && (
          <motion.div
            key={currentScramble.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm sm:p-8"
          >
            <p className="text-xs text-[var(--ink-secondary)]">
              តម្រៀបពាក្យស្លោក · ចុចប្លុកពាក្យតាមលំដាប់ពីដើមដល់ចប់
            </p>
            <p className="mt-2 text-sm text-[var(--ink-secondary)]">
              អត្ថន័យណែនាំ៖ {currentScramble.meaning}
            </p>

            {/* Answer Tray */}
            <div className="mt-5 flex min-h-[78px] flex-wrap items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4">
              {pickedTiles.length === 0 ? (
                <span className="text-sm text-[var(--ink-secondary)]">
                  ចុចលើប្លុកពាក្យខាងក្រោមដើម្បីតម្រៀប...
                </span>
              ) : (
                pickedTiles.map((tile) => (
                  <motion.button
                    key={tile.id}
                    layout
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    type="button"
                    disabled={roundLocked}
                    onClick={() => removePickedTile(tile.id)}
                    className="rounded-xl bg-[var(--accent-main)] px-4 py-2.5 text-base font-bold text-[var(--accent-ink)] shadow-sm"
                  >
                    {tile.text}
                  </motion.button>
                ))
              )}
            </div>

            {/* Shuffled Tile Pool */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {currentScramble.pool.map((tile) => {
                const used = pickedTiles.some((t) => t.id === tile.id);
                return (
                  <motion.button
                    key={tile.id}
                    type="button"
                    disabled={used || roundLocked}
                    whileHover={used || roundLocked ? undefined : { y: -2 }}
                    whileTap={used || roundLocked ? undefined : { scale: 0.96 }}
                    onClick={() => handleScrambleTap(tile)}
                    className={`min-h-[48px] rounded-xl border px-5 py-2.5 text-base font-semibold transition-all ${
                      used
                        ? 'border-transparent bg-[var(--surface-subtle)] text-transparent'
                        : 'border-[var(--border-hairline)] bg-[var(--surface-elevated)] text-[var(--ink-primary)] shadow-sm hover:border-[var(--accent-main)]'
                    }`}
                  >
                    {tile.text}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Round Result Banner + Next Button */}
      {roundFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm sm:flex-row sm:items-center"
        >
          <div>
            <p
              className={`text-base font-bold ${
                roundFeedback.ok ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {roundFeedback.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ink-secondary)]">
              {roundFeedback.detail}
            </p>
          </div>
          <button
            type="button"
            onClick={advanceRound}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-main)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
          >
            {lives <= 0 || roundIdx + 1 >= totalRounds ? 'មើលពិន្ទុសរុប' : 'បន្តទៅវគ្គបន្ទាប់'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </section>
  );
}

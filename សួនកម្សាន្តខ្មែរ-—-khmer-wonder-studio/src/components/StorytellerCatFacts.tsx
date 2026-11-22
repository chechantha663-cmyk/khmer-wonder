import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pause, Play, RefreshCw, Volume2, X } from 'lucide-react';
import { KHMER_CULTURE_FACTS, type KhmerCultureFact } from '../data/khmerCultureFacts';
import { playSfx, speakText, type VoiceSettings } from '../utils/audio';

interface StorytellerCatFactsProps {
  storyId: string;
  voiceSettings: VoiceSettings;
}

const INITIAL_DELAY_MS = 2200;
const VISIBLE_DURATION_MS = 10500;
const REST_DURATION_MS = 4500;

export function StorytellerCatFacts({
  storyId,
  voiceSettings,
}: StorytellerCatFactsProps) {
  // Prioritize facts related to the current story, then cycle through all Khmer culture facts
  const orderedFacts = useMemo<KhmerCultureFact[]>(() => {
    const matched = KHMER_CULTURE_FACTS.filter((f) => f.storyIds?.includes(storyId));
    const others = KHMER_CULTURE_FACTS.filter((f) => !f.storyIds?.includes(storyId));
    return [...matched, ...others];
  }, [storyId]);

  const [factIdx, setFactIdx] = useState(0);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [catBounceKey, setCatBounceKey] = useState(0);
  const [cycleTick, setCycleTick] = useState(0);
  const isInitialWaitRef = useRef(true);

  const timerRef = useRef<number | null>(null);
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset fact queue when switching stories
  useEffect(() => {
    clearTimer();
    isInitialWaitRef.current = true;
    setFactIdx(0);
    setBubbleOpen(false);
    setCycleTick((t) => t + 1);
  }, [storyId, clearTimer]);

  // Single deterministic periodic lifecycle: initial delay -> visible -> brief rest -> next fact
  useEffect(() => {
    clearTimer();
    if (!autoMode) return;

    if (bubbleOpen) {
      timerRef.current = window.setTimeout(() => {
        setBubbleOpen(false);
      }, VISIBLE_DURATION_MS);
    } else if (isInitialWaitRef.current) {
      timerRef.current = window.setTimeout(() => {
        isInitialWaitRef.current = false;
        setBubbleOpen(true);
      }, INITIAL_DELAY_MS);
    } else {
      timerRef.current = window.setTimeout(() => {
        setFactIdx((prev) => (prev + 1) % orderedFacts.length);
        setBubbleOpen(true);
      }, REST_DURATION_MS);
    }

    return clearTimer;
  }, [bubbleOpen, factIdx, autoMode, cycleTick, orderedFacts.length, clearTimer]);

  const currentFact = orderedFacts[factIdx % orderedFacts.length];

  const handleNextFact = useCallback(() => {
    clearTimer();
    isInitialWaitRef.current = false;
    playSfx('click', voiceSettings.sfxEnabled);
    setCatBounceKey((k) => k + 1);
    setFactIdx((prev) => (prev + 1) % orderedFacts.length);
    setBubbleOpen(true);
    setCycleTick((t) => t + 1);
  }, [clearTimer, orderedFacts.length, voiceSettings.sfxEnabled]);

  const handleTapCat = useCallback(() => {
    clearTimer();
    isInitialWaitRef.current = false;
    playSfx('purr', voiceSettings.sfxEnabled);
    setCatBounceKey((k) => k + 1);
    if (bubbleOpen) {
      setFactIdx((prev) => (prev + 1) % orderedFacts.length);
    } else {
      setBubbleOpen(true);
    }
    setCycleTick((t) => t + 1);
  }, [bubbleOpen, clearTimer, orderedFacts.length, voiceSettings.sfxEnabled]);

  const handleReadFact = useCallback(() => {
    if (!currentFact) return;
    speakText(`${currentFact.titleKm}។ ${currentFact.factKm}`, voiceSettings, {
      lang: 'km-KH',
      pitch: 1.25,
    });
  }, [currentFact, voiceSettings]);

  const handleDismissBubble = useCallback(() => {
    clearTimer();
    setBubbleOpen(false);
  }, [clearTimer]);

  return (
    <aside
      aria-label="ឆ្មាអាចារ្យចែករំលែកចំណេះដឹងវប្បធម៌ខ្មែរ"
      className="relative flex flex-col gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-4 shadow-xs sm:flex-row sm:items-center sm:gap-5 sm:p-5"
    >
      {/* Storyteller Cat Avatar Button */}
      <div className="flex items-center justify-between gap-3 sm:block sm:shrink-0">
        <div className="flex items-center gap-3 sm:flex-col sm:gap-1.5">
          <motion.button
            key={catBounceKey}
            type="button"
            onClick={handleTapCat}
            initial={catBounceKey > 0 ? { scale: 0.9, rotate: -6 } : false}
            animate={{ scale: 1, rotate: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 360, damping: 20 }}
            aria-label="ចុចលើឆ្មាអាចារ្យដើម្បីមើលចំណេះដឹងវប្បធម៌ខ្មែរថ្មី"
            title="ចុចលើឆ្មាអាចារ្យដើម្បីបើកចំណេះដឹងថ្មី"
            className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-main)] sm:h-[72px] sm:w-[72px]"
          >
            {/* Mini Storyteller Cat (ឆ្មាអាចារ្យ) SVG matching CatView palette */}
            <motion.svg
              viewBox="0 0 120 120"
              className="h-14 w-14 drop-shadow-xs sm:h-16 sm:w-16"
              animate={{ y: [0, -2.5, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              role="img"
              aria-label="ឆ្មាអាចារ្យអ្នកនិទានរឿង"
            >
              {/* Ears */}
              <polygon points="24,48 29,14 54,34" fill="#ea7b2c" />
              <polygon points="31,42 34,23 47,35" fill="#fda4af" />
              <polygon points="96,48 91,14 66,34" fill="#ea7b2c" />
              <polygon points="89,42 86,23 73,35" fill="#fda4af" />
              {/* Head */}
              <circle cx="60" cy="64" r="37" fill="#f59e42" />
              {/* Forehead tabby stripes */}
              <path
                d="M51 31 L53 41 M60 28 L60 40 M69 31 L67 41"
                stroke="#c25e18"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              {/* Cheeks & Muzzle */}
              <ellipse cx="60" cy="77" rx="16" ry="12" fill="#ffedd5" />
              {/* Eyes + Storyteller Golden Spectacles */}
              <circle cx="46" cy="62" r="6.5" fill="#ffffff" />
              <circle cx="74" cy="62" r="6.5" fill="#ffffff" />
              <circle cx="47" cy="63" r="3.4" fill="#1e1b4b" />
              <circle cx="73" cy="63" r="3.4" fill="#1e1b4b" />
              <circle cx="48" cy="61.5" r="1.2" fill="#ffffff" />
              <circle cx="74" cy="61.5" r="1.2" fill="#ffffff" />
              {/* Tiny Storyteller Glasses */}
              <circle cx="46" cy="62" r="9" fill="none" stroke="#92400e" strokeWidth="2.1" />
              <circle cx="74" cy="62" r="9" fill="none" stroke="#92400e" strokeWidth="2.1" />
              <path d="M55 62 L65 62" stroke="#92400e" strokeWidth="2.1" />
              {/* Nose & Smile */}
              <polygon points="56,72 64,72 60,76" fill="#be123c" />
              <path
                d="M52 79 Q60 85 68 79"
                fill="none"
                stroke="#7c2d12"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {/* Whiskers */}
              <g stroke="#9a3412" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
                <line x1="20" y1="70" x2="36" y2="73" />
                <line x1="20" y1="78" x2="36" y2="78" />
                <line x1="100" y1="70" x2="84" y2="73" />
                <line x1="100" y1="78" x2="84" y2="78" />
              </g>
            </motion.svg>
          </motion.button>

          <div className="sm:text-center">
            <p className="font-display text-xs font-bold text-[var(--ink-primary)] whitespace-nowrap">
              ឆ្មាអាចារ្យ
            </p>
            <p className="text-[11px] text-[var(--ink-secondary)] whitespace-nowrap">
              អ្នកនិទានរឿង
            </p>
          </div>
        </div>

        {/* Mobile quick auto-toggle */}
        <button
          type="button"
          onClick={() => setAutoMode((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] sm:hidden whitespace-nowrap shrink-0"
        >
          {autoMode ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {autoMode ? 'ផ្អាកគិត' : 'បើកស្វ័យប្រវត្តិ'}
        </button>
      </div>

      {/* Ascending Thought-Bubble Dots + Periodic Cultural Thought Bubble */}
      <div className="relative flex min-w-0 flex-1 items-center gap-3">
        {/* Classic Thought Bubble Trail Dots (visible when bubble is open on sm+) */}
        <div
          aria-hidden="true"
          className={`hidden shrink-0 items-center gap-1.5 transition-opacity duration-300 sm:flex ${
            bubbleOpen ? 'opacity-100' : 'opacity-25'
          }`}
        >
          <span className="h-2 w-2 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)]" />
          <span className="h-3 w-3 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)]" />
        </div>

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            {bubbleOpen && currentFact ? (
              <motion.div
                key={currentFact.id}
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -4 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                role="status"
                aria-live="polite"
                className="relative rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-secondary)]">
                    <span className="font-semibold text-[var(--accent-main)]">
                      តើអ្នកដឹងទេ?
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{currentFact.categoryKm}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num tabular-nums">
                      {(factIdx % orderedFacts.length) + 1}/{orderedFacts.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleReadFact}
                      aria-label="អានចំណេះដឹងវប្បធម៌នេះឮៗ"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--ink-primary)] whitespace-nowrap shrink-0"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      អានឮៗ
                    </button>
                    <button
                      type="button"
                      onClick={handleNextFact}
                      aria-label="មើលចំណេះដឹងវប្បធម៌បន្ទាប់"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--accent-main)] transition-colors hover:bg-[var(--surface-elevated)] whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      ថ្មីទៀត
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissBubble}
                      aria-label="បិទពពុះគំនិតបណ្ដោះអាសន្ន"
                      className="rounded-lg p-1 text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--ink-primary)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-display mt-1 text-sm font-bold text-[var(--ink-primary)] sm:text-[15px]">
                  {currentFact.titleKm}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink-secondary)]">
                  {currentFact.factKm}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="resting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="flex flex-wrap items-center justify-between gap-3 py-1"
              >
                <p className="text-sm text-[var(--ink-secondary)]">
                  {autoMode
                    ? 'ឆ្មាអាចារ្យកំពុងនឹករកចំណេះដឹងវប្បធម៌ខ្មែរប្លែកៗបន្តិចទៀតនេះ...'
                    : 'ការបង្ហាញចំណេះដឹងស្វ័យប្រវត្តិត្រូវបានផ្អាក — ចុចលើឆ្មាអាចារ្យដើម្បីមើលភ្លាម។'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNextFact}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--accent-main)] whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    បង្ហាញចំណេះដឹងឥឡូវ
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoMode((v) => !v)}
                    className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] sm:inline-flex whitespace-nowrap shrink-0"
                  >
                    {autoMode ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {autoMode ? 'ផ្អាក' : 'បើកស្វ័យប្រវត្តិ'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Desktop auto-cycle toggle when bubble is open */}
      {bubbleOpen && (
        <button
          type="button"
          onClick={() => setAutoMode((v) => !v)}
          title={autoMode ? 'ផ្អាកការប្ដូរចំណេះដឹងស្វ័យប្រវត្តិ' : 'បើកការប្ដូរចំណេះដឹងស្វ័យប្រវត្តិ'}
          aria-label={autoMode ? 'ផ្អាកការប្ដូរចំណេះដឹងស្វ័យប្រវត្តិ' : 'បើកការប្ដូរចំណេះដឹងស្វ័យប្រវត្តិ'}
          className="hidden shrink-0 items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink-primary)] sm:inline-flex whitespace-nowrap"
        >
          {autoMode ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {autoMode ? 'ស្វ័យប្រវត្តិ' : 'បានផ្អាក'}
        </button>
      )}
    </aside>
  );
}

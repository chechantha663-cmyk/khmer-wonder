import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Wind } from 'lucide-react';
import type { CharAction, SceneWeather } from '../data/stories';
import { STAGE_BACKDROPS, type StageMood } from '../data/themes';

interface StoryStageProps {
  storyId: string;
  title: string;
  sceneKey: string;
  mood: StageMood;
  weather: SceneWeather;
  charA: string;
  charB: string;
  actionA: CharAction;
  actionB: CharAction;
  prop: string;
  bubbleA?: string;
  bubbleB?: string;
  sceneIdx?: number;
  totalScenes?: number;
  onSelectScene?: (idx: number) => void;
  onPokeChar?: () => void;
  autoPlayProgress?: number; // 0..100 when cinema autoplay is active
}

function getCharacterMotion(action: CharAction, side: 'left' | 'right', boosted: boolean) {
  const dir = side === 'left' ? 1 : -1;
  const amp = boosted ? 1.25 : 1;

  switch (action) {
    case 'run':
      return {
        x: [0, 115 * dir * amp, 20 * dir, 130 * dir * amp, 0],
        y: [0, -18, 0, -22, 0],
        scaleX: [1, 1.12, 0.94, 1.12, 1],
        scaleY: [1, 0.92, 1.08, 0.92, 1],
        rotate: [0, 9 * dir, -3 * dir, 10 * dir, 0],
        transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'walk':
      return {
        x: [0, 62 * dir, 90 * dir, 40 * dir, 0],
        y: [0, -7, 0, -7, 0],
        rotate: [-5, 5, -5, 5, -5],
        transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'jump':
      return {
        y: [0, 4, -52 * amp, 4, 0],
        scaleX: [1, 1.16, 0.88, 1.14, 1],
        scaleY: [1, 0.84, 1.16, 0.86, 1],
        rotate: [0, 0, -8 * dir, 0, 0],
        transition: { duration: 0.95, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'cheer':
      return {
        y: [0, -40, 0, -28, 0],
        scale: [1, 1.22, 0.96, 1.18, 1],
        rotate: [-8, 10, -8, 10, -8],
        transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'fly':
      return {
        x: [0, 75 * dir, 120 * dir, 35 * dir, -25 * dir, 0],
        y: [-64, -108, -72, -118, -80, -64],
        rotate: [-8, 10, -6, 12, -8, -8],
        scale: [1, 1.08, 1, 1.1, 1, 1],
        transition: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'sleep':
      return {
        rotate: 80 * dir,
        y: 18,
        scaleX: [1, 1.06, 1],
        scaleY: [1, 0.95, 1],
        transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'shake':
      return {
        x: [0, -10, 10, -8, 8, -4, 4, 0],
        y: [0, -6, 0, -4, 0],
        rotate: [0, -8, 8, -6, 6, 0],
        transition: { duration: 0.55, repeat: Infinity, ease: 'linear' as const },
      };
    case 'sad':
      return {
        y: [12, 17, 12],
        rotate: [-14 * dir, -18 * dir, -14 * dir],
        scaleY: [0.95, 0.9, 0.95],
        filter: 'grayscale(0.5)',
        transition: { duration: 3.0, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'grow':
      return {
        scale: [1, 1.32, 1.04, 1.28, 1],
        y: [0, -14, 0, -10, 0],
        transition: { duration: 1.9, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'idle':
    default:
      return {
        y: [0, -7, 0],
        scaleY: [1, 1.04, 1],
        scaleX: [1, 0.98, 1],
        rotate: [-2, 2, -2],
        transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' as const },
      };
  }
}

function getShadowMotion(action: CharAction, side: 'left' | 'right') {
  const dir = side === 'left' ? 1 : -1;
  if (action === 'run') {
    return {
      x: [0, 115 * dir, 20 * dir, 130 * dir, 0],
      scale: [1, 0.72, 1, 0.7, 1],
      opacity: [0.45, 0.25, 0.45, 0.22, 0.45],
      transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' as const },
    };
  }
  if (action === 'walk') {
    return {
      x: [0, 62 * dir, 90 * dir, 40 * dir, 0],
      scale: [1, 0.92, 1, 0.92, 1],
      transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const },
    };
  }
  if (action === 'fly') {
    return {
      x: [0, 75 * dir, 120 * dir, 35 * dir, -25 * dir, 0],
      scale: [0.55, 0.35, 0.5, 0.32, 0.48, 0.55],
      opacity: [0.28, 0.14, 0.24, 0.12, 0.22, 0.28],
      transition: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' as const },
    };
  }
  if (action === 'jump' || action === 'cheer') {
    return {
      scale: [1, 1.15, 0.48, 1.12, 1],
      opacity: [0.45, 0.55, 0.18, 0.52, 0.45],
      transition: { duration: action === 'jump' ? 0.95 : 0.85, repeat: Infinity, ease: 'easeInOut' as const },
    };
  }
  return {
    scale: [1, 0.94, 1],
    transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' as const },
  };
}

export function StoryStage({
  title,
  sceneKey,
  mood,
  weather,
  charA,
  charB,
  actionA,
  actionB,
  prop,
  bubbleA,
  bubbleB,
  sceneIdx,
  totalScenes,
  onSelectScene,
  onPokeChar,
  autoPlayProgress,
}: StoryStageProps) {
  const [gustCount, setGustCount] = useState(0);
  const [pokeA, setPokeA] = useState(0);
  const [pokeB, setPokeB] = useState(0);
  const [strongWind, setStrongWind] = useState(false);

  const stageImg = STAGE_BACKDROPS[mood];

  const triggerWindGust = () => {
    setGustCount((c) => c + 1);
    setStrongWind(true);
    window.setTimeout(() => setStrongWind(false), 2600);
  };

  // Precomputed deterministic particle layouts for buttery 60fps animation
  const leaves = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${(i * 11 - 12) % 92}%`,
        top: `${(i * 9) % 45}%`,
        dur: `${5.2 + (i % 5) * 1.15}s`,
        delay: `${-(i * 0.65)}s`,
        scale: 0.7 + (i % 4) * 0.2,
        color:
          weather === 'petals'
            ? i % 2 === 0
              ? '#fde68a'
              : '#fbcfe8'
            : mood === 'sunset'
              ? i % 2 === 0
                ? '#f59e0b'
                : '#fb923c'
              : i % 3 === 0
                ? '#4ade80'
                : i % 3 === 1
                  ? '#86efac'
                  : '#facc15',
      })),
    [mood, weather],
  );

  const fireflies = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${5 + ((i * 5.7) % 90)}%`,
        top: `${12 + ((i * 13.4) % 72)}%`,
        dur: `${4.2 + (i % 4) * 1.2}s`,
        delay: `${-(i * 0.45)}s`,
        size: i % 3 === 0 ? 8 : 5,
      })),
    [],
  );

  const rainDrops = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${(i * 3.8) % 104}%`,
        dur: `${0.75 + (i % 4) * 0.14}s`,
        delay: `${-(i * 0.11)}s`,
      })),
    [],
  );

  const windSpeedMult = strongWind ? 0.52 : 1;

  return (
    <div className="relative h-76 overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-stone-950 shadow-xl select-none sm:h-[395px]">
      {/* 1. CINEMATIC PANNING ILLUSTRATED BACKDROP */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${sceneKey}-${stageImg}`}
          initial={{ opacity: 0.25, scale: 1.14, x: '-2%' }}
          animate={{ opacity: 1, scale: [1.08, 1.14, 1.09], x: ['-1.5%', '1.5%', '-0.5%'] }}
          exit={{ opacity: 0.2 }}
          transition={{
            opacity: { duration: 0.65 },
            scale: { duration: 16, repeat: Infinity, ease: 'easeInOut' },
            x: { duration: 18, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="pointer-events-none absolute inset-0"
        >
          <img
            src={stageImg}
            alt={title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Atmospheric Depth & Contrast Scrim */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          mood === 'night'
            ? 'bg-gradient-to-t from-slate-950/70 via-indigo-950/15 to-slate-950/35'
            : mood === 'sunset'
              ? 'bg-gradient-to-t from-amber-950/55 via-orange-500/5 to-amber-200/10'
              : 'bg-gradient-to-t from-black/55 via-transparent to-black/15'
        }`}
      />

      {/* 2. SKY ELEMENTS: SUN / MOON, TWINKLING STARS, DRIFTING CLOUDS & BIRDS */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {mood === 'night' ? (
          <>
            {/* Glowing Moon Aura */}
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-6 right-10 h-16 w-16 rounded-full bg-amber-200/25 blur-xl"
            />
            {/* Twinkling 4-point Stars */}
            {[
              { l: '12%', t: '12%', d: '2.4s' },
              { l: '28%', t: '18%', d: '3.1s' },
              { l: '46%', t: '10%', d: '2.8s' },
              { l: '66%', t: '16%', d: '3.4s' },
              { l: '82%', t: '11%', d: '2.6s' },
              { l: '20%', t: '28%', d: '3.7s' },
            ].map((s, idx) => (
              <svg
                key={idx}
                viewBox="0 0 24 24"
                className="animate-star-twinkle absolute h-4 w-4 text-amber-200"
                style={
                  {
                    left: s.l,
                    top: s.t,
                    '--dur': s.d,
                    '--delay': `${-idx * 0.5}s`,
                  } as React.CSSProperties
                }
              >
                <path
                  fill="currentColor"
                  d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"
                />
              </svg>
            ))}
          </>
        ) : (
          <>
            {/* Warm Golden Sunbeams */}
            <div
              className="animate-sunbeam absolute -top-10 left-[12%] h-[130%] w-28 bg-gradient-to-b from-amber-100/45 via-amber-100/15 to-transparent blur-md"
              style={{ '--dur': '5.8s', '--delay': '0s' } as React.CSSProperties}
            />
            <div
              className="animate-sunbeam absolute -top-10 left-[34%] h-[130%] w-36 bg-gradient-to-b from-yellow-100/35 via-amber-100/10 to-transparent blur-md"
              style={{ '--dur': '7.2s', '--delay': '-2.2s' } as React.CSSProperties}
            />
            <div
              className="animate-sunbeam absolute -top-10 right-[18%] h-[130%] w-24 bg-gradient-to-b from-white/30 via-amber-100/10 to-transparent blur-md"
              style={{ '--dur': '6.4s', '--delay': '-4s' } as React.CSSProperties}
            />

            {/* Drifting Soft Clouds */}
            <div
              className="animate-cloud-glide absolute top-5 left-0 h-11 w-40 rounded-full bg-white/30 blur-md"
              style={{ '--dur': `${26 * windSpeedMult}s`, '--delay': '-4s' } as React.CSSProperties}
            />
            <div
              className="animate-cloud-glide absolute top-14 left-0 h-8 w-28 rounded-full bg-white/25 blur-md"
              style={{ '--dur': `${34 * windSpeedMult}s`, '--delay': '-16s' } as React.CSSProperties}
            />

            {/* Distant Soaring Birds */}
            <svg
              viewBox="0 0 36 14"
              className="animate-bird-soar absolute top-10 left-0 h-4 w-9 text-stone-900/55"
              style={{ '--dur': '14s', '--delay': '-3s' } as React.CSSProperties}
            >
              <path
                d="M2 10 Q10 2 18 9 Q26 2 34 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
            <svg
              viewBox="0 0 36 14"
              className="animate-bird-soar absolute top-16 left-0 h-3 w-7 text-stone-900/45"
              style={{ '--dur': '18s', '--delay': '-9s' } as React.CSSProperties}
            >
              <path
                d="M2 10 Q10 2 18 9 Q26 2 34 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </>
        )}

        {/* River Shimmering Ripples */}
        {mood === 'river' && (
          <div className="absolute right-0 bottom-10 left-0 h-20">
            {[
              { l: '12%', b: '45%', w: '72px', d: '3.1s' },
              { l: '38%', b: '25%', w: '96px', d: '3.8s' },
              { l: '64%', b: '55%', w: '68px', d: '2.9s' },
              { l: '78%', b: '20%', w: '84px', d: '3.5s' },
              { l: '24%', b: '14%', w: '64px', d: '4.1s' },
            ].map((r, i) => (
              <span
                key={i}
                className="animate-water-shimmer absolute h-1 rounded-full bg-cyan-100/75 blur-[1px]"
                style={
                  {
                    left: r.l,
                    bottom: r.b,
                    width: r.w,
                    '--dur': r.d,
                    '--delay': `${-i * 0.7}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. VISIBLE SWEEPING WIND GUST RIBBONS (ខ្យល់បក់រស់រវើក!) */}
      <svg
        viewBox="0 0 900 380"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path
          d="M -40 110 C 160 80, 320 145, 520 105 C 670 78, 790 120, 940 90"
          fill="none"
          stroke="rgba(255,255,255,0.58)"
          strokeWidth={strongWind ? 3.2 : 2.1}
          strokeLinecap="round"
          className="animate-wind-sweep"
          style={{ '--dur': `${4.2 * windSpeedMult}s`, '--delay': '0s' } as React.CSSProperties}
        />
        <path
          d="M -60 205 C 180 235, 340 175, 560 215 C 710 240, 820 190, 960 205"
          fill="none"
          stroke="rgba(255,255,255,0.46)"
          strokeWidth={strongWind ? 2.8 : 1.8}
          strokeLinecap="round"
          className="animate-wind-sweep"
          style={{ '--dur': `${5.1 * windSpeedMult}s`, '--delay': '-1.8s' } as React.CSSProperties}
        />
        <path
          d="M -30 280 C 200 260, 410 310, 640 272 C 770 250, 860 278, 950 265"
          fill="none"
          stroke="rgba(255,248,220,0.42)"
          strokeWidth={strongWind ? 2.6 : 1.6}
          strokeLinecap="round"
          className="animate-wind-sweep"
          style={{ '--dur': `${4.7 * windSpeedMult}s`, '--delay': '-3.1s' } as React.CSSProperties}
        />
      </svg>

      {/* 4. SWIRLING LEAVES / PETALS / FIREFLIES / RAIN */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {weather === 'rain' &&
          rainDrops.map((r) => (
            <span
              key={r.id}
              className="animate-rain absolute top-0 h-7 w-[2px] rounded-full bg-sky-200/75"
              style={
                {
                  left: r.left,
                  '--dur': r.dur,
                  '--delay': r.delay,
                } as React.CSSProperties
              }
            />
          ))}

        {(weather === 'fireflies' || mood === 'night') &&
          fireflies.map((f) => (
            <span
              key={f.id}
              className="animate-firefly absolute rounded-full bg-amber-300 shadow-[0_0_12px_3px_rgba(252,211,77,0.85)]"
              style={
                {
                  left: f.left,
                  top: f.top,
                  width: `${f.size}px`,
                  height: `${f.size}px`,
                  '--dur': f.dur,
                  '--delay': f.delay,
                } as React.CSSProperties
              }
            />
          ))}

        {weather !== 'rain' &&
          leaves.map((leaf) => (
            <svg
              key={`${leaf.id}-${gustCount}`}
              viewBox="0 0 28 20"
              className="animate-leaf-swirl absolute drop-shadow-sm"
              style={
                {
                  left: leaf.left,
                  top: leaf.top,
                  width: `${22 * leaf.scale}px`,
                  height: `${16 * leaf.scale}px`,
                  '--dur': `${parseFloat(leaf.dur) * windSpeedMult}s`,
                  '--delay': leaf.delay,
                } as React.CSSProperties
              }
            >
              {weather === 'petals' ? (
                <path
                  d="M14 2 C22 4, 26 11, 14 18 C2 11, 6 4, 14 2 Z"
                  fill={leaf.color}
                  opacity="0.92"
                />
              ) : (
                <g>
                  <path
                    d="M2 11 C8 2, 20 2, 26 9 C20 18, 9 18, 2 11 Z"
                    fill={leaf.color}
                    opacity="0.9"
                  />
                  <path
                    d="M4 11 Q14 9 24 9"
                    stroke="rgba(0,0,0,0.22)"
                    strokeWidth="1.2"
                    fill="none"
                  />
                </g>
              )}
            </svg>
          ))}

        {weather === 'sparkles' &&
          fireflies.slice(0, 12).map((s) => (
            <svg
              key={`sp-${s.id}`}
              viewBox="0 0 24 24"
              className="animate-star-twinkle absolute h-4 w-4 text-amber-200 drop-shadow"
              style={
                {
                  left: s.left,
                  top: s.top,
                  '--dur': `${1.8 + (s.id % 3) * 0.6}s`,
                  '--delay': s.delay,
                } as React.CSSProperties
              }
            >
              <path
                fill="currentColor"
                d="M12 1l2.5 8.5L23 12l-8.5 2.5L12 23l-2.5-8.5L1 12l8.5-2.5z"
              />
            </svg>
          ))}
      </div>

      {/* 5. SWAYING FOREGROUND VINES (Top Corners) */}
      <div className="pointer-events-none absolute top-0 right-0 left-0 flex justify-between" aria-hidden="true">
        <svg
          viewBox="0 0 140 120"
          className="animate-vine-sway h-24 w-28 text-emerald-950/55 sm:h-32 sm:w-36"
          style={{ '--dur': `${4.2 * windSpeedMult}s` } as React.CSSProperties}
        >
          <path d="M18 0 Q32 45 20 96" stroke="currentColor" strokeWidth="3.5" fill="none" />
          <ellipse cx="32" cy="28" rx="14" ry="7" transform="rotate(24 32 28)" fill="#15803d" opacity="0.82" />
          <ellipse cx="14" cy="54" rx="13" ry="6.5" transform="rotate(-28 14 54)" fill="#16a34a" opacity="0.82" />
          <ellipse cx="30" cy="78" rx="12" ry="6" transform="rotate(20 30 78)" fill="#22c55e" opacity="0.78" />
          <path d="M62 0 Q72 34 58 68" stroke="currentColor" strokeWidth="2.8" fill="none" />
          <ellipse cx="74" cy="24" rx="11" ry="5.5" transform="rotate(25 74 24)" fill="#166534" opacity="0.75" />
          <ellipse cx="52" cy="48" rx="11" ry="5.5" transform="rotate(-22 52 48)" fill="#15803d" opacity="0.78" />
        </svg>

        <svg
          viewBox="0 0 140 120"
          className="animate-vine-sway h-24 w-28 scale-x-[-1] text-emerald-950/55 sm:h-32 sm:w-36"
          style={{ '--dur': `${4.8 * windSpeedMult}s`, '--delay': '-1.6s' } as React.CSSProperties}
        >
          <path d="M18 0 Q32 45 20 96" stroke="currentColor" strokeWidth="3.5" fill="none" />
          <ellipse cx="32" cy="28" rx="14" ry="7" transform="rotate(24 32 28)" fill="#15803d" opacity="0.82" />
          <ellipse cx="14" cy="54" rx="13" ry="6.5" transform="rotate(-28 14 54)" fill="#16a34a" opacity="0.82" />
          <ellipse cx="30" cy="78" rx="12" ry="6" transform="rotate(20 30 78)" fill="#22c55e" opacity="0.78" />
        </svg>
      </div>

      {/* 6. FLOATING STORY PROP WITH GLOW */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${sceneKey}-${prop}`}
          initial={{ opacity: 0, scale: 0.4, y: 16 }}
          animate={{ opacity: 1, scale: [1, 1.12, 1], y: [0, -12, 0] }}
          exit={{ opacity: 0, scale: 0.4, y: -16 }}
          transition={{
            opacity: { duration: 0.35 },
            scale: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
            y: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="pointer-events-none absolute top-7 left-1/2 z-10 -translate-x-1/2 text-4xl drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)] sm:text-5xl"
        >
          {prop}
        </motion.div>
      </AnimatePresence>

      {/* 7. ANIMATED CHARACTERS WITH CONTACT SHADOWS, SWEEPING ENTRY & SPEECH BUBBLES */}
      {/* Character A (Left) */}
      <motion.div
        key={`charA-enter-${sceneKey}`}
        initial={{ opacity: 0, x: -75, scale: 0.8 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 170, damping: 16 }}
        className="absolute bottom-9 left-[10%] z-20 sm:bottom-11 sm:left-[16%]"
      >
        {/* Dynamic Ground Contact Shadow */}
        <motion.div
          aria-hidden="true"
          animate={getShadowMotion(actionA, 'left')}
          className="mx-auto -mb-3 h-4 w-16 rounded-full bg-black/50 blur-[4px] sm:w-20"
        />

        <motion.button
          type="button"
          aria-label="ចុចលើតួអង្គទី១"
          onClick={() => {
            setPokeA((n) => n + 1);
            onPokeChar?.();
          }}
          animate={getCharacterMotion(actionA, 'left', strongWind)}
          whileTap={{ scale: 1.25, rotate: -14 }}
          className="relative cursor-pointer focus:outline-none"
        >
          {/* Speech Bubble A */}
          <AnimatePresence mode="wait">
            {bubbleA && (
              <motion.div
                key={`bA-${sceneKey}-${bubbleA}`}
                initial={{ opacity: 0, scale: 0.7, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.25 }}
                className="pointer-events-none absolute -top-13 left-1/2 -translate-x-1/2 rounded-2xl rounded-bl-sm bg-white/95 px-3 py-1.5 text-xs font-bold text-stone-900 shadow-lg whitespace-nowrap sm:text-sm"
              >
                {bubbleA}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.span
            key={pokeA}
            initial={pokeA > 0 ? { scale: 1.35, rotate: 18 } : false}
            animate={{ scale: 1, rotate: 0 }}
            className="block text-6xl drop-shadow-[0_12px_20px_rgba(0,0,0,0.55)] sm:text-8xl"
          >
            {charA}
          </motion.span>

          {/* Action VFX: Dust / Zzz / Sweat / Sparkles */}
          {actionA === 'run' && (
            <motion.span
              animate={{ opacity: [0, 0.95, 0], x: [-6, -34], scale: [0.6, 1.25] }}
              transition={{ duration: 0.65, repeat: Infinity }}
              className="pointer-events-none absolute bottom-1 -left-8 text-2xl"
            >
              💨
            </motion.span>
          )}
          {actionA === 'sleep' && (
            <motion.span
              animate={{ y: [0, -28], opacity: [0, 1, 0], scale: [0.7, 1.2] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="pointer-events-none absolute -top-8 -right-4 text-2xl"
            >
              💤
            </motion.span>
          )}
          {actionA === 'cheer' && (
            <motion.span
              animate={{ scale: [0.6, 1.25, 0.6], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              className="pointer-events-none absolute -top-4 -right-5 text-2xl"
            >
              ✨
            </motion.span>
          )}
        </motion.button>
      </motion.div>

      {/* Character B (Right) */}
      <motion.div
        key={`charB-enter-${sceneKey}`}
        initial={{ opacity: 0, x: 75, scale: 0.8 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 170, damping: 16, delay: 0.1 }}
        className="absolute right-[10%] bottom-9 z-20 sm:right-[16%] sm:bottom-11"
      >
        <motion.div
          aria-hidden="true"
          animate={getShadowMotion(actionB, 'right')}
          className="mx-auto -mb-3 h-4 w-16 rounded-full bg-black/50 blur-[4px] sm:w-20"
        />

        <motion.button
          type="button"
          aria-label="ចុចលើតួអង្គទី២"
          onClick={() => {
            setPokeB((n) => n + 1);
            onPokeChar?.();
          }}
          animate={getCharacterMotion(actionB, 'right', strongWind)}
          whileTap={{ scale: 1.25, rotate: 14 }}
          className="relative cursor-pointer focus:outline-none"
        >
          <AnimatePresence mode="wait">
            {bubbleB && (
              <motion.div
                key={`bB-${sceneKey}-${bubbleB}`}
                initial={{ opacity: 0, scale: 0.7, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.45 }}
                className="pointer-events-none absolute -top-13 left-1/2 -translate-x-1/2 rounded-2xl rounded-br-sm bg-white/95 px-3 py-1.5 text-xs font-bold text-stone-900 shadow-lg whitespace-nowrap sm:text-sm"
              >
                {bubbleB}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.span
            key={pokeB}
            initial={pokeB > 0 ? { scale: 1.35, rotate: -18 } : false}
            animate={{ scale: 1, rotate: 0 }}
            className="block text-6xl drop-shadow-[0_12px_20px_rgba(0,0,0,0.55)] sm:text-8xl"
          >
            {charB}
          </motion.span>

          {actionB === 'run' && (
            <motion.span
              animate={{ opacity: [0, 0.95, 0], x: [6, 34], scale: [0.6, 1.25] }}
              transition={{ duration: 0.65, repeat: Infinity }}
              className="pointer-events-none absolute -right-8 bottom-1 text-2xl"
            >
              💨
            </motion.span>
          )}
          {actionB === 'sleep' && (
            <motion.span
              animate={{ y: [0, -28], opacity: [0, 1, 0], scale: [0.7, 1.2] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="pointer-events-none absolute -top-8 -left-4 text-2xl"
            >
              💤
            </motion.span>
          )}
          {actionB === 'cheer' && (
            <motion.span
              animate={{ scale: [0.6, 1.25, 0.6], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              className="pointer-events-none absolute -top-4 -left-5 text-2xl"
            >
              ✨
            </motion.span>
          )}
        </motion.button>
      </motion.div>

      {/* 8. FOREGROUND SWAYING GRASS & FERNS (Parallax Depth Layer!) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 -bottom-1 left-0 z-20 flex items-end justify-between px-1"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <svg
            key={i}
            viewBox="0 0 80 48"
            className="animate-foliage-sway h-10 w-16 sm:h-12 sm:w-24"
            style={
              {
                '--dur': `${(3.1 + (i % 3) * 0.7) * windSpeedMult}s`,
                '--delay': `${-i * 0.4}s`,
              } as React.CSSProperties
            }
          >
            <path
              d="M12 48 Q8 24 20 8 Q18 28 24 48 Z"
              fill={mood === 'night' ? '#0f2924' : mood === 'sunset' ? '#6b4c1e' : '#14532d'}
              opacity="0.72"
            />
            <path
              d="M34 48 Q38 18 52 4 Q45 26 46 48 Z"
              fill={mood === 'night' ? '#134e4a' : mood === 'sunset' ? '#854d0e' : '#166534'}
              opacity="0.78"
            />
            <path
              d="M54 48 Q64 26 76 14 Q67 32 64 48 Z"
              fill={mood === 'night' ? '#0f2924' : mood === 'sunset' ? '#713f12' : '#15803d'}
              opacity="0.68"
            />
          </svg>
        ))}
      </div>

      {/* 9. INTERACTIVE WIND GUST BUTTON + SCENE DOTS */}
      <div className="absolute top-3.5 right-3.5 z-30">
        <button
          type="button"
          onClick={triggerWindGust}
          className="inline-flex items-center gap-1.5 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/65 whitespace-nowrap"
        >
          <Wind className={`h-3.5 w-3.5 ${strongWind ? 'animate-spin' : ''}`} />
          បក់ខ្យល់
        </button>
      </div>

      {typeof sceneIdx === 'number' && typeof totalScenes === 'number' && (
        <div className="absolute right-4 bottom-3 left-4 z-30 flex items-center justify-between text-xs font-semibold text-white/95 drop-shadow">
          <span className="font-mono-num">
            ឈុតទី {sceneIdx + 1} / {totalScenes}
          </span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalScenes }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`ឈុតទី ${i + 1}`}
                onClick={() => onSelectScene?.(i)}
                className={`h-2 rounded-full transition-all ${
                  i === sceneIdx ? 'w-7 bg-amber-300' : 'w-2 bg-white/55 hover:bg-white/90'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cinema Autoplay Progress Bar */}
      {typeof autoPlayProgress === 'number' && autoPlayProgress > 0 && (
        <div className="absolute right-0 bottom-0 left-0 z-30 h-1 bg-white/20">
          <div
            className="h-full bg-amber-400 transition-[width] duration-150 ease-linear"
            style={{ width: `${Math.min(100, autoPlayProgress)}%` }}
          />
        </div>
      )}
    </div>
  );
}

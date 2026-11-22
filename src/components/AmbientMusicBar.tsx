import { useState } from 'react';
import { motion } from 'motion/react';
import { Music, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { AMBIENT_PROFILES } from '../utils/ambientMusic';

interface AmbientMusicBarProps {
  playing: boolean;
  volume: number;
  activeSoundThemeId: string;
  isStorySynced: boolean;
  onTogglePlay: () => void;
  onChangeVolume: (v: number) => void;
}

export function AmbientMusicBar({
  playing,
  volume,
  activeSoundThemeId,
  isStorySynced,
  onTogglePlay,
  onChangeVolume,
}: AmbientMusicBarProps) {
  const [expanded, setExpanded] = useState(false);
  const profile =
    AMBIENT_PROFILES[activeSoundThemeId] || AMBIENT_PROFILES['angkor-amber'];

  return (
    <div
      role="region"
      aria-label="ឧបករណ៍ចាក់ភ្លេងបរិយាកាស"
      className="fixed right-4 bottom-4 z-30 flex items-center gap-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)]/95 px-3 py-2 text-[var(--ink-primary)] shadow-lg backdrop-blur-md"
    >
      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={playing ? 'ផ្អាកភ្លេងបរិយាកាស' : 'ចាក់ភ្លេងបរិយាកាស'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-main)] text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>

      {/* Soundscape Info (Single-line compact) */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex min-w-0 flex-col text-left focus-visible:outline-none"
      >
        <div className="flex items-center gap-1.5">
          {playing ? (
            <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
              {[0.55, 0.9, 0.7].map((h, idx) => (
                <motion.span
                  key={idx}
                  animate={{ scaleY: [0.35, 1, 0.45] }}
                  transition={{
                    duration: 0.75 + idx * 0.18,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{ height: `${h * 12}px`, transformOrigin: 'bottom' }}
                  className="w-[2.5px] rounded-full bg-[var(--accent-main)]"
                />
              ))}
            </span>
          ) : (
            <Music className="h-3.5 w-3.5 text-[var(--ink-secondary)]" />
          )}
          <span className="max-w-[138px] truncate text-xs font-bold text-[var(--ink-primary)] sm:max-w-[170px]">
            {profile.labelKm}
          </span>
        </div>
        <span className="max-w-[155px] truncate text-[11px] text-[var(--ink-secondary)] sm:max-w-[190px]">
          {isStorySynced ? 'ភ្លេងតាមឈុតរឿង · ' : ''}
          {profile.moodLabelKm}
        </span>
      </button>

      {/* Volume Control (always visible on sm+, toggleable on mobile) */}
      <div
        className={`items-center gap-2 border-l border-[var(--border-hairline)] pl-2.5 ${
          expanded ? 'flex' : 'hidden sm:flex'
        }`}
      >
        <button
          type="button"
          aria-label={volume === 0 ? 'បើកសំឡេងភ្លេង' : 'បិទសំឡេងភ្លេង'}
          onClick={() => onChangeVolume(volume === 0 ? 0.42 : 0)}
          className="text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
        >
          {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={volume}
          aria-label="កម្រិតសំឡេងភ្លេងបរិយាកាស"
          onChange={(e) => onChangeVolume(Number(e.target.value))}
          className="w-16 accent-[var(--accent-main)] sm:w-20"
        />
      </div>
    </div>
  );
}

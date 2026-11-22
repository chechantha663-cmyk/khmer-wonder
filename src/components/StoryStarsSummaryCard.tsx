import { motion } from 'motion/react';
import { ArrowRight, Star } from 'lucide-react';
import { STORIES, type Story } from '../data/stories';

interface StoryStarsSummaryCardProps {
  stories?: Story[];
  totalStars: number;
  starsMap: Record<string, number>;
  onOpenStories: () => void;
}

export function StoryStarsSummaryCard({
  stories = STORIES,
  totalStars,
  starsMap,
  onOpenStories,
}: StoryStarsSummaryCardProps) {
  const maxStars = stories.length * 3;
  const clampedStars = Math.max(0, Math.min(maxStars, totalStars));
  const percent = maxStars > 0 ? Math.round((clampedStars / maxStars) * 100) : 0;
  const completedStories = stories.filter((s) => (starsMap[s.id] || 0) > 0).length;
  const perfectStories = stories.filter((s) => (starsMap[s.id] || 0) >= 3).length;
  const remaining = Math.max(0, maxStars - clampedStars);

  const summaryNote =
    clampedStars === 0
      ? 'ចាប់ផ្ដើមទស្សនារឿងនិទាន និងឆ្លើយសំណួរ ដើម្បីប្រមូលផ្កាយមាសដំបូងរបស់អ្នក។'
      : remaining === 0
        ? `ពូកែអស្ចារ្យ! អ្នកបានប្រមូលផ្កាយមាសពេញទាំងអស់ពីរឿងនិទានទាំង ${stories.length} ហើយ។`
        : `នៅសល់ ${remaining} ផ្កាយទៀត ដើម្បីប្រមូលផ្កាយមាសឱ្យពេញគ្រប់រឿងទាំង ${stories.length}។`;

  const ctaLabel =
    clampedStars === 0
      ? 'ចាប់ផ្ដើមប្រមូលផ្កាយ'
      : remaining === 0
        ? 'ទស្សនារឿងម្ដងទៀត'
        : 'បន្តប្រមូលផ្កាយ';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      aria-label="សេចក្ដីសង្ខេបផ្កាយសរុបពីរឿងនិទាន"
      className="relative overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm sm:p-7"
    >
      {/* Subtle Khmer lotus corner filigree */}
      <svg
        aria-hidden="true"
        viewBox="0 0 180 180"
        className="pointer-events-none absolute -top-8 -right-8 h-44 w-44 text-[var(--accent-main)] opacity-[0.07]"
        fill="none"
      >
        <path
          d="M90 14C106 46 134 74 166 90C134 106 106 134 90 166C74 134 46 106 14 90C46 74 74 46 90 14Z"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M90 36C101 59 121 79 144 90C121 101 101 121 90 144C79 121 59 101 36 90C59 79 79 59 90 36Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="90" cy="90" r="18" stroke="currentColor" strokeWidth="1.8" />
      </svg>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Khmer Lotus-Star Medallion & Editorial Copy */}
        <div className="flex items-start gap-4 sm:items-center sm:gap-5">
          <div
            aria-hidden="true"
            className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-main)] sm:h-[72px] sm:w-[72px]"
          >
            {/* Traditional Khmer 8-petal lotus ring */}
            <svg viewBox="0 0 72 72" className="absolute inset-0 h-full w-full" fill="none">
              <path
                d="M36 6L41 18L53 13L48 25L60 30L48 35L53 47L41 42L36 54L31 42L19 47L24 35L12 30L24 25L19 13L31 18L36 6Z"
                transform="translate(0 6)"
                stroke="currentColor"
                strokeOpacity="0.28"
                strokeWidth="1.4"
              />
              <circle
                cx="36"
                cy="36"
                r="26"
                stroke="currentColor"
                strokeOpacity="0.22"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            </svg>
            <Star className="relative h-8 w-8 fill-amber-400 text-amber-500 drop-shadow-xs sm:h-9 sm:w-9" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--accent-main)]">
              កំណត់ត្រាសមិទ្ធផលរឿងគំនិតជីវិត និងនិទានខ្មែរ
            </p>
            <h2 className="font-display mt-0.5 text-xl font-bold text-balance text-[var(--ink-primary)] sm:text-2xl">
              ផ្កាយសរុបដែលអ្នកប្រមូលបាន
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--ink-secondary)]">
              {summaryNote}
            </p>
          </div>
        </div>

        {/* Right: Tabular Star Readout + Action */}
        <div className="flex flex-wrap items-center justify-between gap-5 border-t border-[var(--border-hairline)] pt-4 lg:justify-end lg:border-t-0 lg:pt-0">
          <div className="text-left lg:text-right">
            <div className="flex items-baseline gap-1.5 lg:justify-end">
              <span className="font-display font-mono-num text-4xl leading-none font-bold tracking-tight text-[var(--ink-primary)] tabular-nums sm:text-5xl">
                {clampedStars}
              </span>
              <span className="font-mono-num text-base font-semibold text-[var(--ink-secondary)] tabular-nums">
                / {maxStars} ផ្កាយ
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-secondary)] lg:justify-end">
              <span className="font-mono-num tabular-nums">
                រឿងបានលេង {completedStories}/{stories.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num tabular-nums">ពេញ ៣ ផ្កាយ {perfectStories} រឿង</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num font-semibold text-[var(--accent-main)] tabular-nums">
                {percent}%
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenStories}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent-main)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] shadow-xs transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-main)] whitespace-nowrap shrink-0"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 10-Story Star Progression Track */}
      <div className="relative mt-5 border-t border-[var(--border-hairline)] pt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-[var(--ink-secondary)]">
          <span>វឌ្ឍនភាពតាមរឿងនិទានទាំង {stories.length}</span>
          <span className="font-mono-num tabular-nums">
            {clampedStars} ក្នុងចំណោម {maxStars} ផ្កាយ
          </span>
        </div>
        <div
          className="grid grid-cols-4 gap-2 sm:grid-cols-8"
          role="list"
          aria-label="វឌ្ឍនភាពផ្កាយតាមរឿងនីមួយៗ"
        >
          {stories.map((story, idx) => {
            const earned = Math.max(0, Math.min(3, starsMap[story.id] || 0));
            const ratio = earned / 3;
            return (
              <div
                key={story.id}
                role="listitem"
                title={`រឿងទី ${idx + 1}៖ ${story.title} (${earned}/3 ផ្កាយ)`}
                className="flex flex-col gap-1"
              >
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: ratio }}
                    transition={{ duration: 0.45, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: 'left' }}
                    className={`h-full w-full rounded-full ${
                      earned >= 3 ? 'bg-amber-500' : 'bg-[var(--accent-main)]'
                    }`}
                  />
                </div>
                <div className="font-mono-num flex items-center justify-between text-[10px] text-[var(--ink-secondary)] tabular-nums">
                  <span>{idx + 1}</span>
                  <span className={earned > 0 ? 'text-amber-500' : 'opacity-45'}>
                    {'★'.repeat(earned)}
                    {earned < 3 && <span className="opacity-35">{'★'.repeat(3 - earned)}</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

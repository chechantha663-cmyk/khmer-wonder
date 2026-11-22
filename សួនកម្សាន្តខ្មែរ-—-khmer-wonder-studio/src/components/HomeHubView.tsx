import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Cat,
  Disc3,
  Gamepad2,
  Palette,
  Puzzle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { STORIES, type Story } from '../data/stories';
import { STAGE_BACKDROPS, type AppTheme } from '../data/themes';
import { StoryStarsSummaryCard } from './StoryStarsSummaryCard';

export type AppSection =
  | 'HOME'
  | 'STORIES'
  | 'GAME3D'
  | 'ADMIN'
  | 'WORDS'
  | 'CAT'
  | 'FRIENDS'
  | 'MATH';

interface HomeHubViewProps {
  activeTheme: AppTheme;
  onNavigate: (section: AppSection) => void;
  onCycleTheme: () => void;
  onOpenSettings: () => void;
  stories?: Story[];
  totalStars: number;
  starsMap: Record<string, number>;
  friendsCount: number;
  bestGameScore?: number;
  isAdmin?: boolean;
}

export function HomeHubView({
  activeTheme,
  onNavigate,
  onCycleTheme,
  onOpenSettings,
  stories = STORIES,
  totalStars,
  starsMap,
  friendsCount,
  bestGameScore = 0,
  isAdmin = false,
}: HomeHubViewProps) {
  const modules: {
    id: AppSection;
    title: string;
    subtitle: string;
    meta: string;
    image: string;
    icon: typeof BookOpen;
    featured?: boolean;
  }[] = [
    {
      id: 'GAME3D',
      title: 'អង្គររត់ប្រណាំង',
      subtitle:
        'ហ្គេមរត់ប្រណាំងពេញអេក្រង់! ដឹកនាំសុភាទន្សាយមាសរត់លើស្ពានថ្មអង្គរ គេចសសរប្រាសាទ លោតរំលងនាគ និងប្រកួតតារាងពិន្ទុ។',
      meta:
        bestGameScore > 0
          ? `ហ្គេមរត់ប្រណាំង · ខ្ពស់បំផុត ${bestGameScore.toLocaleString()}`
          : 'ហ្គេមរត់ប្រណាំង · ប្រកួតតារាងពិន្ទុលើពពក',
      image: STAGE_BACKDROPS.angkor,
      icon: Gamepad2,
      featured: true,
    },
    {
      id: 'STORIES',
      title: `រឿងគំនិតជីវិត បំបែកក្ដី និងនិទាន (${stories.length} រឿង)`,
      subtitle:
        'រឿងគំនិតជីវិត និងបំបែកក្ដីកម្រិតពិបាកសម្រាប់មនុស្សធំ ជាមួយសាច់រឿងវែងជក់ចិត្ត សំណួរវិភាគ និងរឿងព្រេងបុរាណខ្មែរ។',
      meta: `${stories.length} រឿង · ផ្កាយ ${totalStars}/${stories.length * 3}`,
      image: STAGE_BACKDROPS.forest,
      icon: BookOpen,
      featured: true,
    },
    {
      id: 'WORDS',
      title: 'ហ្គេមពាក្យស្លោក និងរកពាក្យគន្លឹះ',
      subtitle:
        'បំពេញពាក្យស្លោកខ្មែរ ទាយពាក្យគន្លឹះពីតម្រុយ Emoji និងតម្រៀបប្លុកពាក្យប្រកួត Combo Streak។',
      meta: '៣ របៀបលេង · ៤០+ ពាក្យស្លោក និងតម្រុយ',
      image: STAGE_BACKDROPS.courtyard,
      icon: Puzzle,
      featured: true,
    },
    {
      id: 'MATH',
      title: 'មន្ទីរពិសោធន៍គណិតវិទ្យាគ្រប់ប្រភេទ',
      subtitle: 'បូក ដក គុណ ចែក ភាគរយ ធរណីមាត្រមានរូប សមីការដឺក្រេទី២ វិភាគលេខ និងល្បងប្រាជ្ញា ៣០វិ។',
      meta: '៤ ម៉ូឌុលគណិតវិទ្យា · មានរូបភាព SVG',
      image: STAGE_BACKDROPS.night,
      icon: Calculator,
      featured: true,
    },
    {
      id: 'CAT',
      title: 'ឆ្មាអាចារ្យ អ្នកកំប្លែង',
      subtitle: 'អង្អែលក្បាល ឱ្យត្រីញ៉ាំ និយាយឆ្លងឆ្លើយ និងត្រាប់សំឡេងជាមួយឆ្មាមានជីវិត។',
      meta: 'គាំទ្រ ៦ ភាសា · មីក្រូហ្វូន',
      image: STAGE_BACKDROPS.sunset,
      icon: Cat,
      featured: true,
    },
    {
      id: 'FRIENDS',
      title: 'លេងជាមួយមិត្ត និងកង់វិលសំណាង',
      subtitle: 'បង្វិលកង់ចាប់ឆ្នោតឈ្មោះមិត្ត សរសើរ ទស្សន៍ទាយ Dare និងប្រកាសសារផ្កាភ្លើង។',
      meta: `មិត្តភក្តិ ${friendsCount} នាក់ · កង់វិលផ្ទាល់`,
      image: STAGE_BACKDROPS.river,
      icon: Disc3,
      featured: true,
    },
  ];

  return (
    <section className="space-y-10">
      {/* Editorial Hero Split */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-7 shadow-sm sm:p-10 lg:col-span-7"
        >
          <div>
            <p className="text-sm font-semibold text-[var(--accent-main)]">
              ពិភពកម្សាន្ត និងចំណេះដឹងភាសាខ្មែរ · អានីមេសិនរស់រវើក
            </p>
            <h1 className="font-display mt-3 text-3xl leading-[1.32] font-bold tracking-tight text-balance text-[var(--ink-primary)] sm:text-5xl">
              រឿងគំនិតជីវិត ហ្គេមរត់ប្រណាំង និងល្បងប្រាជ្ញាខ្មែរ
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--ink-secondary)]">
              អានរឿងគំនិតជីវិត និងបំបែកក្ដីស៊ីជម្រៅ លេងហ្គេមរត់ប្រណាំងលើស្ពានថ្មអង្គរ
              ប្រកួតហ្គេមពាក្យស្លោក លេងជាមួយឆ្មាអាចារ្យ បង្វិលកង់មិត្តភក្តិ ឬគណនាគណិតវិទ្យាគ្រប់ប្រភេទ។
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('STORIES')}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-main)] px-6 py-3 text-sm font-semibold text-[var(--accent-ink)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] whitespace-nowrap"
            >
              <BookOpen className="h-4 w-4" />
              អានរឿងគំនិតជីវិត ({stories.length})
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('GAME3D')}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-5 py-3 text-sm font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--accent-main)] whitespace-nowrap"
            >
              <Gamepad2 className="h-4 w-4" />
              ហ្គេមរត់ប្រណាំង
            </button>
            <button
              type="button"
              onClick={onCycleTheme}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)] whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4" />
              ប្ដូររូបភាព និងពណ៌
            </button>
          </div>
        </motion.div>

        {/* Right Hero Visual Showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative min-h-[280px] overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-stone-900 shadow-md lg:col-span-5"
        >
          <img
            src={activeTheme.image}
            alt={activeTheme.nameKm}
            referrerPolicy="no-referrer"
            className="animate-slow-pan h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

          <div className="absolute right-6 bottom-6 left-6 flex items-end justify-between gap-4 text-white">
            <div>
              <p className="text-xs font-medium text-white/80">ផ្ទៃបច្ចុប្បន្ន</p>
              <p className="font-display mt-0.5 text-xl font-bold">{activeTheme.nameKm}</p>
              <p className="mt-0.5 text-xs text-white/75">{activeTheme.subtitleKm}</p>
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/95 px-3.5 py-2 text-xs font-bold text-stone-900 shadow hover:bg-white whitespace-nowrap shrink-0"
            >
              <Palette className="h-3.5 w-3.5" />
              ជ្រើស ៦ ផ្ទៃ
            </button>
          </div>
        </motion.div>
      </div>

      {/* Khmer Story Stars Summary Card */}
      <StoryStarsSummaryCard
        stories={stories}
        totalStars={totalStars}
        starsMap={starsMap}
        onOpenStories={() => onNavigate('STORIES')}
      />

      {/* Private Admin Studio Card (Visible ONLY to Admin) */}
      {isAdmin && (
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--accent-main)]/40 bg-[var(--accent-soft)] p-6 sm:flex-row sm:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-main)]">
              <ShieldCheck className="h-4 w-4" />
              ផ្ទាំងគ្រប់គ្រងម្ចាស់គេហទំព័រ (Admin Only)
            </p>
            <h2 className="font-display mt-1 text-xl font-bold text-[var(--ink-primary)]">
              Admin Studio · ស្ថិតិអ្នកចូលមើល បន្ថែមរឿងថ្មី និងស្ទូឌីយោ AI
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
              ឃើញតែគណនី Google របស់អ្នកម្នាក់គត់ — អ្នកចូលលេងធម្មតាមិនឃើញ និងមិនអាចឆែកមើល ឬកែប្រែបានទេ។
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ADMIN')}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--accent-main)] px-5 py-3 text-sm font-bold text-[var(--accent-ink)] shadow-sm hover:bg-[var(--accent-hover)] whitespace-nowrap"
          >
            បើក Admin Studio
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 6 Flagship Public Experiences Grid */}
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-[var(--ink-primary)]">
              ជ្រើសកម្មវិធីដែលអ្នកចង់លេង
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">
              ហ្គេមរត់ប្រណាំង · រឿងគំនិតជីវិត · ហ្គេមពាក្យស្លោក · គណិតវិទ្យា · ឆ្មាអាចារ្យ · កង់វិលមិត្តភក្តិ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-6">
          {modules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <motion.button
                key={mod.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onNavigate(mod.id)}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] text-left shadow-sm transition-shadow hover:shadow-lg ${
                  mod.featured ? 'md:col-span-3' : 'md:col-span-2'
                }`}
              >
                <div className="relative h-40 w-full overflow-hidden bg-stone-900">
                  <img
                    src={mod.image}
                    alt={mod.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full scale-[1.08] object-cover transition-transform duration-500 group-hover:scale-[1.15]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-medium text-white/95">
                    <Icon className="h-4 w-4" />
                    <span className="font-mono-num">{mod.meta}</span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <h3 className="font-display text-lg font-bold text-[var(--ink-primary)] group-hover:text-[var(--accent-main)]">
                      {mod.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-secondary)]">
                      {mod.subtitle}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-main)]">
                    ចូលលេងឥឡូវនេះ
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

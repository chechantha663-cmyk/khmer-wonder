import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  Film,
  Home,
  Loader2,
  Lock,
  LogIn,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type {
  CharAction,
  SceneWeather,
  StoryCategory,
  StoryDifficulty,
  StoryQuestion,
  StoryScene,
} from '../data/stories';
import type { StageMood } from '../data/themes';
import {
  createCustomStory,
  deleteCustomStory,
  fetchAdminPlayers,
  fetchAdminVisitLogs,
  fetchAllAdminStories,
  getTodayDayKey,
  updateCustomStory,
  type CloudAdminPlayer,
  type CloudCustomStory,
  type CloudVisitLog,
  type CustomStoryDraftInput,
  type PublicVisitSection,
} from '../lib/firestoreStore';
import { playSfx, type VoiceSettings } from '../utils/audio';
import { MediaStudioView } from './MediaStudioView';

interface AdminStudioViewProps {
  voiceSettings: VoiceSettings;
  onBurst: () => void;
  onStoriesChanged: () => Promise<void> | void;
  onOpenStories: () => void;
  onGoHome: () => void;
}

type AdminTab = 'analytics' | 'stories' | 'media';

const SECTION_LABELS: Record<PublicVisitSection, string> = {
  HOME: 'ទំព័រដើម',
  STORIES: 'រឿងគំនិតជីវិត & និទាន',
  GAME3D: 'ហ្គេមរត់ប្រណាំង',
  WORDS: 'ហ្គេមពាក្យស្លោក',
  MATH: 'គណិតវិទ្យា',
  CAT: 'ឆ្មាអាចារ្យ',
  FRIENDS: 'កង់វិលមិត្តភក្តិ',
};

const MOOD_OPTIONS: { value: StageMood; label: string }[] = [
  { value: 'forest', label: 'ព្រៃបុរាណបៃតង' },
  { value: 'angkor', label: 'អង្គរពន្លឺមាស' },
  { value: 'river', label: 'ដងទន្លេមេគង្គ' },
  { value: 'sunset', label: 'វាលស្រែថ្ងៃលិច' },
  { value: 'night', label: 'រាត្រីភូមិខ្មែរ' },
  { value: 'courtyard', label: 'ខ្លោងទ្វារផ្កាចំប៉ា' },
];

const WEATHER_OPTIONS: { value: SceneWeather; label: string }[] = [
  { value: 'leaves', label: 'ស្លឹកឈើហើរ' },
  { value: 'wind', label: 'ខ្យល់បក់' },
  { value: 'petals', label: 'ផ្ការោយ' },
  { value: 'fireflies', label: 'អំពិលអំពែក' },
  { value: 'rain', label: 'ភ្លៀងស្រទន់' },
  { value: 'sparkles', label: 'ពន្លឺផ្កាភ្លើង' },
];

const ACTION_OPTIONS: { value: CharAction; label: string }[] = [
  { value: 'idle', label: 'ឈរធម្មតា' },
  { value: 'walk', label: 'ដើរ' },
  { value: 'run', label: 'រត់' },
  { value: 'jump', label: 'លោត' },
  { value: 'cheer', label: 'អបអរសាទរ' },
  { value: 'fly', label: 'ហោះ' },
  { value: 'shake', label: 'ញ័រ/សើច' },
  { value: 'sleep', label: 'ដេកលក់' },
  { value: 'sad', label: 'សោកសៅ' },
  { value: 'grow', label: 'ធំឡើង' },
];

const CHAR_PRESETS = ['🕵️', '💍', '📜', '🕯️', '⚖️', '🪞', '🐇', '🐢', '🦁', '🦉', '🐉', '👑'];

function createEmptyDraft(): CustomStoryDraftInput {
  return {
    title: '',
    moral: '',
    category: 'wisdom',
    difficulty: 'hard',
    coverMood: 'angkor',
    chars: ['🕵️', '📜'],
    scenes: [
      {
        text: '',
        actionA: 'walk',
        actionB: 'idle',
        mood: 'angkor',
        prop: '🔍',
        weather: 'leaves',
        bubbleA: '',
        bubbleB: '',
      },
      {
        text: '',
        actionA: 'cheer',
        actionB: 'jump',
        mood: 'sunset',
        prop: '⚖️',
        weather: 'sparkles',
        bubbleA: '',
        bubbleB: '',
      },
    ],
    quizPool: [
      {
        q: '',
        ans: '',
        choices: ['', '', '', ''],
        keys: [],
        hint: '',
      },
    ],
    poem: ['', ''],
    published: true,
  };
}

function formatVisitTime(log: CloudVisitLog): string {
  if (!log.createdAt) return log.dayKey || 'ថ្មីៗនេះ';
  try {
    const dt = log.createdAt.toDate();
    return dt.toLocaleString('km-KH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return log.dayKey || 'ថ្មីៗនេះ';
  }
}

export function AdminStudioView({
  voiceSettings,
  onBurst,
  onStoriesChanged,
  onOpenStories,
  onGoHome,
}: AdminStudioViewProps) {
  const { user, isAdmin, signingIn, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');

  // Analytics state
  const [visitLogs, setVisitLogs] = useState<CloudVisitLog[]>([]);
  const [players, setPlayers] = useState<CloudAdminPlayer[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Story Builder state
  const [stories, setStories] = useState<CloudCustomStory[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomStoryDraftInput>(createEmptyDraft);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const [logs, userList] = await Promise.all([
        fetchAdminVisitLogs(200),
        fetchAdminPlayers(60),
      ]);
      setVisitLogs(logs);
      setPlayers(userList);
    } catch (err) {
      setAnalyticsError(
        err instanceof Error ? err.message : 'មិនអាចទាញស្ថិតិអ្នកចូលមើលបានទេ។',
      );
    } finally {
      setLoadingAnalytics(false);
    }
  }, [isAdmin]);

  const loadAdminStories = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingList(true);
    try {
      const list = await fetchAllAdminStories();
      setStories(list);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'មិនអាចទាញបញ្ជីរឿងបានទេ។');
    } finally {
      setLoadingList(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAnalytics();
    loadAdminStories();
  }, [loadAnalytics, loadAdminStories]);

  const todayKey = getTodayDayKey();

  const analyticsStats = useMemo(() => {
    const todayVisits = visitLogs.filter((v) => v.dayKey === todayKey).length;
    const uniqueSessions = new Set(visitLogs.map((v) => v.sessionId)).size;
    const sectionCounts = new Map<PublicVisitSection, number>();
    for (const log of visitLogs) {
      sectionCounts.set(log.section, (sectionCounts.get(log.section) || 0) + 1);
    }
    const sectionBreakdown = (Object.keys(SECTION_LABELS) as PublicVisitSection[])
      .map((sec) => ({
        section: sec,
        label: SECTION_LABELS[sec],
        count: sectionCounts.get(sec) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    const maxSectionCount = Math.max(1, ...sectionBreakdown.map((s) => s.count));

    return {
      totalVisits: visitLogs.length,
      todayVisits,
      uniqueSessions,
      registeredPlayers: players.length,
      sectionBreakdown,
      maxSectionCount,
    };
  }, [visitLogs, players.length, todayKey]);

  // Strict Admin Access Gate
  if (!isAdmin) {
    return (
      <section className="mx-auto max-w-lg rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-main)]">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold text-[var(--ink-primary)]">
          ផ្ទាំងគ្រប់គ្រងសម្រាប់តែ Admin ប៉ុណ្ណោះ
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
          {user
            ? 'គណនី Google បច្ចុប្បន្នរបស់អ្នកមិនមានសិទ្ធិ Admin ទេ។ មានតែម្ចាស់គេហទំព័រប៉ុណ្ណោះដែលអាចមើលស្ថិតិអ្នកចូលលេង បន្ថែមរឿងនិទាន និងប្រើឧបករណ៍ AI បាន។'
            : 'សូមចូលគណនី Google របស់ម្ចាស់គេហទំព័រ (Admin) ដើម្បីមើលស្ថិតិអ្នកចូលលេង គ្រប់គ្រងរឿង និងឧបករណ៍ AI។'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {!user && (
            <button
              type="button"
              disabled={signingIn}
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-main)] px-5 py-2.5 text-sm font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
            >
              <LogIn className="h-4 w-4" />
              {signingIn ? 'កំពុងចូលគណនី...' : 'ចូលគណនី Google Admin'}
            </button>
          )}
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--ink-primary)]"
          >
            <Home className="h-4 w-4" />
            ត្រឡប់ទៅទំព័រដើម
          </button>
        </div>
      </section>
    );
  }

  const handleStartNew = () => {
    setEditingId(null);
    setDraft(createEmptyDraft());
    setErrorMsg(null);
    setSuccessMsg(null);
    playSfx('click', voiceSettings.sfxEnabled);
  };

  const handleSelectEdit = (story: CloudCustomStory) => {
    setEditingId(story.id);
    setDraft({
      title: story.title,
      moral: story.moral,
      category: story.category || 'wisdom',
      difficulty: story.difficulty || 'hard',
      coverMood: story.coverMood,
      chars: [story.chars[0], story.chars[1]],
      scenes: story.scenes.map((s) => ({
        ...s,
        weather: s.weather || 'leaves',
        bubbleA: s.bubbleA || '',
        bubbleB: s.bubbleB || '',
      })),
      quizPool: story.quizPool.map((q) => ({
        ...q,
        choices: [
          q.choices[0] || q.ans || '',
          q.choices[1] || '',
          q.choices[2] || '',
          q.choices[3] || '',
        ],
      })),
      poem: story.poem.length > 0 ? [...story.poem] : [''],
      published: story.published,
    });
    setErrorMsg(null);
    setSuccessMsg(null);
    playSfx('click', voiceSettings.sfxEnabled);
  };

  const updateScene = (index: number, patch: Partial<StoryScene>) => {
    setDraft((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc, i) => (i === index ? { ...sc, ...patch } : sc)),
    }));
  };

  const addScene = () => {
    if (draft.scenes.length >= 12) return;
    setDraft((prev) => ({
      ...prev,
      scenes: [
        ...prev.scenes,
        {
          text: '',
          actionA: 'walk',
          actionB: 'idle',
          mood: prev.coverMood,
          prop: '✨',
          weather: 'leaves',
          bubbleA: '',
          bubbleB: '',
        },
      ],
    }));
  };

  const removeScene = (index: number) => {
    if (draft.scenes.length <= 1) return;
    setDraft((prev) => ({
      ...prev,
      scenes: prev.scenes.filter((_, i) => i !== index),
    }));
  };

  const updateQuiz = (index: number, patch: Partial<StoryQuestion>) => {
    setDraft((prev) => ({
      ...prev,
      quizPool: prev.quizPool.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  const updateQuizChoice = (qIndex: number, cIndex: number, value: string) => {
    setDraft((prev) => ({
      ...prev,
      quizPool: prev.quizPool.map((q, i) => {
        if (i !== qIndex) return q;
        const nextChoices = [...q.choices];
        while (nextChoices.length < 4) nextChoices.push('');
        nextChoices[cIndex] = value;
        return {
          ...q,
          choices: nextChoices,
          ans: cIndex === 0 ? value : q.ans,
        };
      }),
    }));
  };

  const addQuiz = () => {
    if (draft.quizPool.length >= 8) return;
    setDraft((prev) => ({
      ...prev,
      quizPool: [
        ...prev.quizPool,
        { q: '', ans: '', choices: ['', '', '', ''], keys: [], hint: '' },
      ],
    }));
  };

  const removeQuiz = (index: number) => {
    if (draft.quizPool.length <= 1) return;
    setDraft((prev) => ({
      ...prev,
      quizPool: prev.quizPool.filter((_, i) => i !== index),
    }));
  };

  const handleSaveStory = async () => {
    if (!user) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!draft.title.trim()) {
      setErrorMsg('សូមបញ្ចូលចំណងជើងរឿងជាមុនសិន។');
      return;
    }
    const validScenes = draft.scenes.filter((s) => s.text.trim().length > 0);
    if (validScenes.length === 0) {
      setErrorMsg('សូមបញ្ចូលសាច់រឿងយ៉ាងហោចណាស់ ១ វគ្គ។');
      return;
    }

    setSaving(true);
    try {
      const normalizedQuiz = draft.quizPool
        .filter((q) => q.q.trim().length > 0)
        .map((q) => {
          const correct = (q.choices[0] || q.ans || '').trim();
          const others = q.choices
            .slice(1)
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
          return {
            ...q,
            ans: correct,
            choices: [correct, ...others],
            keys: correct ? [correct] : [],
          };
        });

      const payload: CustomStoryDraftInput = {
        ...draft,
        scenes: validScenes,
        quizPool: normalizedQuiz,
      };

      if (editingId) {
        await updateCustomStory(editingId, payload);
        setSuccessMsg(`បានរក្សាទុកការកែប្រែរឿង «${draft.title.trim()}» រួចរាល់!`);
      } else {
        const created = await createCustomStory(user.uid, payload);
        setEditingId(created.id);
        setSuccessMsg(`បានបង្កើត និងផ្សាយរឿងថ្មី «${created.title}» រួចរាល់!`);
      }
      playSfx('victory', voiceSettings.sfxEnabled);
      onBurst();
      await loadAdminStories();
      await onStoriesChanged();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'មិនអាចរក្សាទុករឿងបានទេ។');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (story: CloudCustomStory) => {
    try {
      await updateCustomStory(story.id, {
        title: story.title,
        moral: story.moral,
        category: story.category || 'wisdom',
        difficulty: story.difficulty || 'hard',
        coverMood: story.coverMood,
        chars: story.chars,
        scenes: story.scenes,
        quizPool: story.quizPool,
        poem: story.poem,
        published: !story.published,
      });
      await loadAdminStories();
      await onStoriesChanged();
      playSfx('click', voiceSettings.sfxEnabled);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'មិនអាចប្ដូរស្ថានភាពផ្សាយបានទេ។');
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    setDeletingId(storyId);
    try {
      await deleteCustomStory(storyId);
      if (editingId === storyId) {
        handleStartNew();
      }
      setConfirmDeleteId(null);
      await loadAdminStories();
      await onStoriesChanged();
      playSfx('click', voiceSettings.sfxEnabled);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'មិនអាចលុបរឿងបានទេ។');
    } finally {
      setDeletingId(null);
    }
  };

  const handleUseTranscriptAsScene = (spokenText: string) => {
    setDraft((prev) => {
      const emptyIdx = prev.scenes.findIndex((s) => !s.text.trim());
      if (emptyIdx >= 0) {
        return {
          ...prev,
          scenes: prev.scenes.map((sc, i) => (i === emptyIdx ? { ...sc, text: spokenText } : sc)),
        };
      }
      if (prev.scenes.length >= 12) return prev;
      return {
        ...prev,
        scenes: [
          ...prev.scenes,
          {
            text: spokenText,
            actionA: 'walk',
            actionB: 'idle',
            mood: prev.coverMood,
            prop: '✨',
            weather: 'leaves',
            bubbleA: '',
            bubbleB: '',
          },
        ],
      };
    });
    setActiveTab('stories');
    setSuccessMsg('បានបញ្ចូលអត្ថបទពីសំឡេងទៅក្នុងវគ្គរឿងរួចហើយ!');
  };

  return (
    <section className="space-y-6">
      {/* Admin Header & Mode Switcher */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:flex-row lg:items-center sm:p-7">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-main)]">
            <ShieldCheck className="h-4 w-4" />
            Admin Studio · ចូលបានតែម្ចាស់គេហទំព័រ ({user?.email})
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold text-[var(--ink-primary)] sm:text-3xl">
            ផ្ទាំងគ្រប់គ្រងម្ចាស់គេហទំព័រ
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            ពិនិត្យស្ថិតិអ្នកចូលលេង គ្រប់គ្រងរឿងគំនិតជីវិត/បំបែកក្ដី និងប្រើស្ទូឌីយោ AI ផ្ទាល់ខ្លួន។
          </p>
        </div>

        <div className="inline-flex flex-wrap shrink-0 gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-[var(--accent-main)] text-[var(--accent-ink)] shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            ស្ថិតិអ្នកចូលមើល
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stories')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'stories'
                ? 'bg-[var(--accent-main)] text-[var(--accent-ink)] shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            បង្កើត & គ្រប់គ្រងរឿង
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'media'
                ? 'bg-[var(--accent-main)] text-[var(--accent-ink)] shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            <Film className="h-4 w-4" />
            វីដេអូ AI & សំឡេង
          </button>
        </div>
      </div>

      {/* TAB 1: ADMIN VISITOR & PLAYER ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--ink-primary)]">
                របាយការណ៍អ្នកចូលមើល និងអ្នកលេងក្នុងគេហទំព័រ
              </h2>
              <p className="text-xs text-[var(--ink-secondary)]">
                ឃើញតែម្ចាស់គេហទំព័រ (Admin) ប៉ុណ្ណោះ — អ្នកប្រើធម្មតាមិនអាចមើលទិន្នន័យនេះបានឡើយ។
              </p>
            </div>
            <button
              type="button"
              disabled={loadingAnalytics}
              onClick={loadAnalytics}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-4 py-2 text-xs font-bold text-[var(--ink-primary)] hover:border-[var(--accent-main)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
              ផ្ទុកស្ថិតិឡើងវិញ
            </button>
          </div>

          {analyticsError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{analyticsError}</span>
            </div>
          )}

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink-secondary)]">
                <span>ចូលមើលសរុប</span>
                <Activity className="h-4 w-4 text-[var(--accent-main)]" />
              </div>
              <p className="font-mono-num mt-2 text-3xl font-bold text-[var(--ink-primary)]">
                {analyticsStats.totalVisits.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-secondary)]">
                ដង (ថ្មីៗបំផុត ២០០ ដង)
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink-secondary)]">
                <span>ចូលមើលថ្ងៃនេះ</span>
                <Calendar className="h-4 w-4 text-[var(--accent-main)]" />
              </div>
              <p className="font-mono-num mt-2 text-3xl font-bold text-[var(--ink-primary)]">
                {analyticsStats.todayVisits.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-secondary)]">
                កាលបរិច្ឆេទ {todayKey}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink-secondary)]">
                <span>អ្នកទស្សនាផ្សេងគ្នា</span>
                <Users className="h-4 w-4 text-[var(--accent-main)]" />
              </div>
              <p className="font-mono-num mt-2 text-3xl font-bold text-[var(--ink-primary)]">
                {analyticsStats.uniqueSessions.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-secondary)]">
                វគ្គប្រើប្រាស់ (Sessions)
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink-secondary)]">
                <span>អ្នកលេងចូលគណនី Google</span>
                <Trophy className="h-4 w-4 text-[var(--accent-main)]" />
              </div>
              <p className="font-mono-num mt-2 text-3xl font-bold text-[var(--ink-primary)]">
                {analyticsStats.registeredPlayers.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-secondary)]">
                គណនីដែលរក្សាទុកពិន្ទុ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Section Popularity Breakdown */}
            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-5">
              <h3 className="font-display text-base font-bold text-[var(--ink-primary)]">
                ផ្នែកដែលគេចូលលេងច្រើនជាងគេ
              </h3>
              <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                បង្ហាញចំនួនដងដែលអ្នកទស្សនាបើកចូលកម្មវិធីនីមួយៗ
              </p>

              <div className="mt-5 space-y-3.5">
                {analyticsStats.sectionBreakdown.map((item) => {
                  const pct = Math.round((item.count / analyticsStats.maxSectionCount) * 100);
                  return (
                    <div key={item.section} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--ink-primary)]">
                          {item.label}
                        </span>
                        <span className="font-mono-num font-bold text-[var(--accent-main)]">
                          {item.count} ដង
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent-main)] transition-all duration-500"
                          style={{ width: `${item.count > 0 ? Math.max(6, pct) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Registered Players Progress Table */}
            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-7">
              <h3 className="font-display text-base font-bold text-[var(--ink-primary)]">
                បញ្ជីអ្នកលេងដែលបានចូលគណនី Google ({players.length} នាក់)
              </h3>
              <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                មើលឈ្មោះ ផ្កាយរឿងគំនិតជីវិត និងពិន្ទុខ្ពស់បំផុតក្នុងហ្គេមរត់ប្រណាំង
              </p>

              {loadingAnalytics && players.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-xs text-[var(--ink-secondary)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  កំពុងទាញបញ្ជីអ្នកលេង...
                </div>
              ) : players.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-5 text-xs text-[var(--ink-secondary)]">
                  មិនទាន់មានអ្នកលេងចូលគណនី Google នៅឡើយទេ។
                </div>
              ) : (
                <div className="mt-4 max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
                  {players.map((pl) => (
                    <div
                      key={pl.uid}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                          {pl.displayName}
                        </p>
                        <p className="text-[11px] text-[var(--ink-secondary)]">
                          អានចប់ {pl.storiesCompleted} រឿង
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className="font-mono-num inline-flex items-center gap-1 text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {pl.totalStars} ផ្កាយ
                        </span>
                        <span className="font-mono-num inline-flex items-center gap-1 text-[var(--accent-main)]">
                          <Trophy className="h-3.5 w-3.5" />
                          {pl.bestGameScore.toLocaleString()} ពិន្ទុ
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Visitor Activity Feed */}
          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm">
            <h3 className="font-display text-base font-bold text-[var(--ink-primary)]">
              ប្រវត្តិអ្នកចូលមើលថ្មីៗ ({Math.min(visitLogs.length, 40)} លើកចុងក្រោយ)
            </h3>
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">
              រាប់បញ្ចូលទាំងភ្ញៀវទូទៅដែលមិនបានចូលគណនី និងអ្នកលេងដែលចូលគណនី Google
            </p>

            {visitLogs.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-5 text-xs text-[var(--ink-secondary)]">
                មិនទាន់មានកំណត់ត្រាចូលមើលថ្មីនៅឡើយទេ។ ពេលមានមិត្តភក្តិ ឬអ្នកទស្សនាចុចលីងចូលលេង ប្រវត្តិនឹងបង្ហាញនៅទីនេះដោយស្វ័យប្រវត្តិ!
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[540px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] text-[var(--ink-secondary)]">
                      <th className="py-2.5 pr-4 font-semibold">អ្នកចូលមើល</th>
                      <th className="py-2.5 pr-4 font-semibold">ប្រភេទ</th>
                      <th className="py-2.5 pr-4 font-semibold">ផ្នែកដែលចូលលេង</th>
                      <th className="py-2.5 text-right font-semibold">ពេលវេលា</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {visitLogs.slice(0, 40).map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--surface-subtle)]/60">
                        <td className="py-2.5 pr-4 font-semibold text-[var(--ink-primary)]">
                          {log.visitorName}
                        </td>
                        <td className="py-2.5 pr-4 text-[var(--ink-secondary)]">
                          {log.visitorType === 'user' ? 'គណនី Google' : 'ភ្ញៀវទូទៅ'}
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-[var(--accent-main)]">
                          {SECTION_LABELS[log.section] || log.section}
                        </td>
                        <td className="font-mono-num py-2.5 text-right text-[var(--ink-secondary)]">
                          {formatVisitTime(log)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ADMIN STORY BUILDER & MANAGER */}
      {activeTab === 'stories' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Admin's Custom Stories List */}
          <aside className="space-y-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm lg:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[var(--ink-primary)]">
                រឿងដែលអ្នកបានបន្ថែម ({stories.length})
              </h2>
              <button
                type="button"
                onClick={handleStartNew}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-main)] px-3 py-1.5 text-xs font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                រឿងថ្មី
              </button>
            </div>

            {loadingList ? (
              <div className="flex items-center justify-center py-8 text-xs text-[var(--ink-secondary)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                កំពុងទាញបញ្ជីរឿង...
              </div>
            ) : stories.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
                មិនទាន់មានរឿងបន្ថែមថ្មីនៅឡើយទេ។ បំពេញទម្រង់ខាងស្ដាំ រួចចុច «រក្សាទុក និងផ្សាយរឿង» ដើម្បីបន្ថែមរឿងគំនិតជីវិត ឬបំបែកក្ដីថ្មី!
              </div>
            ) : (
              <div className="max-h-[680px] space-y-2.5 overflow-y-auto pr-1">
                {stories.map((st) => {
                  const selected = editingId === st.id;
                  return (
                    <div
                      key={st.id}
                      className={`rounded-2xl border p-3.5 transition-colors ${
                        selected
                          ? 'border-[var(--accent-main)] bg-[var(--accent-soft)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                            {st.chars[0]} {st.chars[1]} {st.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--ink-secondary)]">
                            {st.scenes.length} វគ្គ · {st.quizPool.length} សំណួរ ·{' '}
                            <span
                              className={
                                st.published
                                  ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                                  : 'font-semibold text-amber-600'
                              }
                            >
                              {st.published ? 'កំពុងផ្សាយ' : 'លាក់ទុក (Draft)'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectEdit(st)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-primary)] hover:border-[var(--accent-main)]"
                        >
                          <Pencil className="h-3 w-3" />
                          កែសម្រួល
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(st)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                        >
                          {st.published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {st.published ? 'លាក់សិន' : 'ផ្សាយ'}
                        </button>
                        {confirmDeleteId === st.id ? (
                          <button
                            type="button"
                            disabled={deletingId === st.id}
                            onClick={() => handleDeleteStory(st.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white"
                          >
                            {deletingId === st.id ? 'កំពុងលុប...' : 'បញ្ជាក់លុប'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(st.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                            លុប
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Right Column: Visual Story Builder Form */}
          <div className="space-y-6 rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-[var(--ink-primary)]">
                  {editingId ? 'កែសម្រួលរឿង' : 'បង្កើតរឿងគំនិតជីវិត / បំបែកក្ដីថ្មី'}
                </h2>
                <p className="text-xs text-[var(--ink-secondary)]">
                  រឿងថ្មីនឹងបង្ហាញលើគេហទំព័រភ្លាមៗ ជាមួយឆាកអានីមេសិន និងសំណួរវិភាគ។
                </p>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-primary)]"
                >
                  + បង្កើតរឿងថ្មីវិញ
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
                <span className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {successMsg}
                </span>
                <button
                  type="button"
                  onClick={onOpenStories}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  មើលក្នុងបញ្ជីរឿង
                </button>
              </div>
            )}

            {/* 1. Core Story Info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[var(--ink-primary)]">
                  ចំណងជើងរឿង *
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                  placeholder="ឧ. អាថ៌កំបាំងសំបុត្របាត់នៅស្ពានថ្ម"
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--ink-primary)]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[var(--ink-primary)]">
                  គតិអប់រំ / ទស្សនៈជីវិតប្រចាំរឿង *
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={draft.moral}
                  onChange={(e) => setDraft((p) => ({ ...p, moral: e.target.value }))}
                  placeholder="ឧ. ការពិតមិនដែលលាក់ខ្លួនក្នុងសំឡេងស្រែកខ្លាំងទេ តែស្ថិតក្នុងការសង្កេតហ្មត់ចត់"
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--ink-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ink-primary)]">
                  ប្រភេទរឿង
                </label>
                <select
                  value={draft.category || 'wisdom'}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, category: e.target.value as StoryCategory }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm text-[var(--ink-primary)]"
                >
                  <option value="wisdom">រឿងគំនិតជីវិត</option>
                  <option value="mystery">រឿងបំបែកក្ដី</option>
                  <option value="folktale">រឿងព្រេងបុរាណ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ink-primary)]">
                  កម្រិតសំណួរ
                </label>
                <select
                  value={draft.difficulty || 'hard'}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, difficulty: e.target.value as StoryDifficulty }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm text-[var(--ink-primary)]"
                >
                  <option value="hard">ពិបាក (មនុស្សធំ · ឆ្លើយបានតែ ១ ដង)</option>
                  <option value="easy">ស្រាល (ទូទៅ · ឆ្លើយបាន ២ ដង)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ink-primary)]">
                  ផ្ទៃឆាកគ្របដណ្ដប់
                </label>
                <select
                  value={draft.coverMood}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, coverMood: e.target.value as StageMood }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm text-[var(--ink-primary)]"
                >
                  {MOOD_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-primary)]">
                    តួអង្គទី ១ (Emoji)
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={draft.chars[0]}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, chars: [e.target.value, p.chars[1]] }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-center text-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-primary)]">
                    តួអង្គទី ២ (Emoji)
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={draft.chars[1]}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, chars: [p.chars[0], e.target.value] }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-center text-xl"
                  />
                </div>
              </div>

              {/* Quick Emoji Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-secondary)] sm:col-span-2">
                <span>រើសតួអង្គរហ័ស៖</span>
                {CHAR_PRESETS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        chars: [p.chars[1], em],
                      }))
                    }
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 py-1 text-base hover:border-[var(--accent-main)]"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Animated Story Scenes */}
            <div className="space-y-3 border-t border-[var(--border-hairline)] pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink-primary)]">
                    វគ្គសាច់រឿង ({draft.scenes.length} វគ្គ)
                  </h3>
                  <p className="text-[11px] text-[var(--ink-secondary)]">
                    សរសេរឱ្យមានព័ត៌មានលម្អិត និងតម្រុយ ៣–៤ ប្រយោគក្នុងមួយវគ្គ ដើម្បីឱ្យអ្នកអានជក់ចិត្ត។
                  </p>
                </div>
                <button
                  type="button"
                  disabled={draft.scenes.length >= 12}
                  onClick={addScene}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent-main)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-bold text-[var(--accent-main)] disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  បន្ថែមវគ្គ
                </button>
              </div>

              <div className="space-y-3">
                {draft.scenes.map((sc, idx) => (
                  <div
                    key={idx}
                    className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--accent-main)]">
                        វគ្គទី {idx + 1}
                      </span>
                      {draft.scenes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeScene(idx)}
                          className="text-xs text-rose-500 hover:underline"
                        >
                          លុបវគ្គនេះ
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={3}
                      maxLength={600}
                      value={sc.text}
                      onChange={(e) => updateScene(idx, { text: e.target.value })}
                      placeholder="សរសេរសាច់រឿងលម្អិតសម្រាប់វគ្គនេះ..."
                      className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-3 text-sm text-[var(--ink-primary)]"
                    />

                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <select
                        value={sc.mood}
                        onChange={(e) => updateScene(idx, { mood: e.target.value as StageMood })}
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs"
                      >
                        {MOOD_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            ឆាក៖ {m.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={sc.weather || 'leaves'}
                        onChange={(e) =>
                          updateScene(idx, { weather: e.target.value as SceneWeather })
                        }
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs"
                      >
                        {WEATHER_OPTIONS.map((w) => (
                          <option key={w.value} value={w.value}>
                            បរិយាកាស៖ {w.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={sc.actionA}
                        onChange={(e) =>
                          updateScene(idx, { actionA: e.target.value as CharAction })
                        }
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs"
                      >
                        {ACTION_OPTIONS.map((a) => (
                          <option key={a.value} value={a.value}>
                            {draft.chars[0]} {a.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={sc.actionB}
                        onChange={(e) =>
                          updateScene(idx, { actionB: e.target.value as CharAction })
                        }
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs"
                      >
                        {ACTION_OPTIONS.map((a) => (
                          <option key={a.value} value={a.value}>
                            {draft.chars[1]} {a.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        maxLength={80}
                        value={sc.bubbleA || ''}
                        onChange={(e) => updateScene(idx, { bubbleA: e.target.value })}
                        placeholder={`ពាក្យនិយាយរបស់ ${draft.chars[0]} (ស្រេចចិត្ត)`}
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        maxLength={80}
                        value={sc.bubbleB || ''}
                        onChange={(e) => updateScene(idx, { bubbleB: e.target.value })}
                        placeholder={`ពាក្យនិយាយរបស់ ${draft.chars[1]} (ស្រេចចិត្ត)`}
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        maxLength={8}
                        value={sc.prop}
                        onChange={(e) => updateScene(idx, { prop: e.target.value })}
                        placeholder="វត្ថុតុបតែង (ឧ. 🔍 ⚖️)"
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Interactive Quiz Questions */}
            <div className="space-y-3 border-t border-[var(--border-hairline)] pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink-primary)]">
                    សំណួរវិភាគចុងរឿង ({draft.quizPool.length} សំណួរ)
                  </h3>
                  <p className="text-[11px] text-[var(--ink-secondary)]">
                    បើទុកទទេ ប្រព័ន្ធនឹងបង្កើតសំណួរពីគតិអប់រំឱ្យដោយស្វ័យប្រវត្តិ។
                  </p>
                </div>
                <button
                  type="button"
                  disabled={draft.quizPool.length >= 8}
                  onClick={addQuiz}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent-main)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-bold text-[var(--accent-main)] disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  បន្ថែមសំណួរ
                </button>
              </div>

              <div className="space-y-3">
                {draft.quizPool.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="space-y-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--accent-main)]">
                        សំណួរទី {qIdx + 1}
                      </span>
                      {draft.quizPool.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuiz(qIdx)}
                          className="text-xs text-rose-500 hover:underline"
                        >
                          លុបសំណួរ
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      maxLength={220}
                      value={q.q}
                      onChange={(e) => updateQuiz(qIdx, { q: e.target.value })}
                      placeholder="សំណួរវិភាគ..."
                      className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-2 text-xs"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        maxLength={120}
                        value={q.choices[0] || ''}
                        onChange={(e) => updateQuizChoice(qIdx, 0, e.target.value)}
                        placeholder="ចម្លើយត្រឹមត្រូវ *"
                        className="rounded-lg border border-emerald-500/40 bg-[var(--surface-elevated)] px-3 py-2 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        maxLength={120}
                        value={q.choices[1] || ''}
                        onChange={(e) => updateQuizChoice(qIdx, 1, e.target.value)}
                        placeholder="ជម្រើសបញ្ឆោតទី ១"
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        maxLength={120}
                        value={q.choices[2] || ''}
                        onChange={(e) => updateQuizChoice(qIdx, 2, e.target.value)}
                        placeholder="ជម្រើសបញ្ឆោតទី ២"
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        maxLength={120}
                        value={q.choices[3] || ''}
                        onChange={(e) => updateQuizChoice(qIdx, 3, e.target.value)}
                        placeholder="ជម្រើសបញ្ឆោតទី ៣"
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-2 text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      maxLength={180}
                      value={q.hint}
                      onChange={(e) => updateQuiz(qIdx, { hint: e.target.value })}
                      placeholder="ជំនួយ/តម្រុយសម្រាប់អ្នកលេង (ស្រេចចិត្ត)"
                      className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Moral Poem */}
            <div className="space-y-2 border-t border-[var(--border-hairline)] pt-5">
              <label className="block text-sm font-bold text-[var(--ink-primary)]">
                កំណាព្យអប់រំចុងរឿង (១ បន្ទាត់ ១ ឃ្លា)
              </label>
              <textarea
                rows={3}
                value={draft.poem.join('\n')}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, poem: e.target.value.split('\n').slice(0, 10) }))
                }
                placeholder={'ចិត្តល្អស្មោះត្រង់ជួយអ្នកផង\nសំណាងល្អប៉ងតែងបានជួប'}
                className="w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3.5 text-sm text-[var(--ink-primary)]"
              />
            </div>

            {/* Publish Toggle & Save Action */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border-hairline)] pt-5">
              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-[var(--ink-primary)]">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) => setDraft((p) => ({ ...p, published: e.target.checked }))}
                  className="h-4 w-4 accent-[var(--accent-main)]"
                />
                ផ្សាយជាសាធារណៈក្នុងទំព័រ «រឿងគំនិតជីវិត & និទាន» ភ្លាមៗ
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveStory}
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent-main)] px-6 py-3 text-sm font-bold text-[var(--accent-ink)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    កំពុងរក្សាទុក...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingId ? 'រក្សាទុកការកែប្រែ' : 'រក្សាទុក និងផ្សាយរឿង'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRIVATE ADMIN AI VIDEO & AUDIO STUDIO */}
      {activeTab === 'media' && (
        <MediaStudioView
          voiceSettings={voiceSettings}
          onBurst={onBurst}
          onUseTranscriptAsScene={handleUseTranscriptAsScene}
        />
      )}
    </section>
  );
}

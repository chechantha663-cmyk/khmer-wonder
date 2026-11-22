import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  CharAction,
  SceneWeather,
  Story,
  StoryCategory,
  StoryDifficulty,
  StoryQuestion,
  StoryScene,
} from '../data/stories';
import type { StageMood } from '../data/themes';

const ALLOWED_THEMES = new Set([
  'angkor-amber',
  'emerald-forest',
  'mekong-azure',
  'sunset-meadow',
  'starry-night',
  'golden-courtyard',
]);

export interface CloudUserProfile {
  uid: string;
  displayName: string;
  themeId: string;
  starsMap: Record<string, number>;
  friends: string[];
  bestGameScore: number;
}

export interface CloudGameScore {
  id: string;
  uid: string;
  playerName: string;
  score: number;
  lotuses: number;
  distance: number;
  createdAt?: Timestamp;
}

export interface CloudTranscript {
  id: string;
  uid: string;
  title: string;
  transcript: string;
  language: string;
  durationSec: number;
  createdAt?: Timestamp;
}

export interface CloudVideoPrompt {
  id: string;
  uid: string;
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  duration: '5s' | '8s' | '10s';
  createdAt?: Timestamp;
}

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitizeThemeId(themeId: string): string {
  return ALLOWED_THEMES.has(themeId) ? themeId : 'angkor-amber';
}

function sanitizeFriends(friends: string[]): string[] {
  return friends
    .map((f) => f.trim().slice(0, 40))
    .filter((f) => f.length > 0)
    .slice(0, 30);
}

function sanitizeStarsMap(starsMap: Record<string, number>): Record<string, number> {
  const entries = Object.entries(starsMap).slice(0, 100);
  const clean: Record<string, number> = {};
  for (const [k, v] of entries) {
    const cleanKey = k.slice(0, 60);
    clean[cleanKey] = Math.max(0, Math.min(3, Math.floor(Number(v) || 0)));
  }
  return clean;
}

export async function loadOrCreateUserProfile(
  uid: string,
  defaults: Omit<CloudUserProfile, 'uid'>,
): Promise<CloudUserProfile> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid,
        displayName: String(data.displayName || defaults.displayName).slice(0, 80),
        themeId: sanitizeThemeId(String(data.themeId || defaults.themeId)),
        starsMap: sanitizeStarsMap((data.starsMap as Record<string, number>) || {}),
        friends: sanitizeFriends(Array.isArray(data.friends) ? data.friends : defaults.friends),
        bestGameScore: Math.max(0, Math.floor(Number(data.bestGameScore) || 0)),
      };
    }

    const payload = {
      uid,
      displayName: (defaults.displayName || 'អ្នកលេងខ្មែរ').trim().slice(0, 80) || 'អ្នកលេងខ្មែរ',
      themeId: sanitizeThemeId(defaults.themeId),
      starsMap: sanitizeStarsMap(defaults.starsMap),
      friends: sanitizeFriends(defaults.friends),
      bestGameScore: Math.max(0, Math.min(1_000_000, Math.floor(defaults.bestGameScore || 0))),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return {
      uid,
      displayName: payload.displayName,
      themeId: payload.themeId,
      starsMap: payload.starsMap,
      friends: payload.friends,
      bestGameScore: payload.bestGameScore,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncUserProfile(
  uid: string,
  patch: Partial<Omit<CloudUserProfile, 'uid'>>,
): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.displayName !== undefined) {
    updatePayload.displayName = patch.displayName.trim().slice(0, 80) || 'អ្នកលេងខ្មែរ';
  }
  if (patch.themeId !== undefined) {
    updatePayload.themeId = sanitizeThemeId(patch.themeId);
  }
  if (patch.starsMap !== undefined) {
    updatePayload.starsMap = sanitizeStarsMap(patch.starsMap);
  }
  if (patch.friends !== undefined) {
    updatePayload.friends = sanitizeFriends(patch.friends);
  }
  if (patch.bestGameScore !== undefined) {
    updatePayload.bestGameScore = Math.max(
      0,
      Math.min(1_000_000, Math.floor(patch.bestGameScore)),
    );
  }
  try {
    await updateDoc(ref, updatePayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveGameScore(
  uid: string,
  playerName: string,
  score: number,
  lotuses: number,
  distance: number,
): Promise<CloudGameScore> {
  const scoreId = makeSafeId('score');
  const path = `gameScores/${scoreId}`;
  const cleanName = playerName.trim().slice(0, 60) || 'អ្នកលេងខ្មែរ';
  const cleanScore = Math.max(0, Math.min(1_000_000, Math.floor(score)));
  const cleanLotuses = Math.max(0, Math.min(50_000, Math.floor(lotuses)));
  const cleanDistance = Math.max(0, Math.min(500_000, Math.floor(distance)));
  try {
    await setDoc(doc(db, 'gameScores', scoreId), {
      uid,
      playerName: cleanName,
      score: cleanScore,
      lotuses: cleanLotuses,
      distance: cleanDistance,
      createdAt: serverTimestamp(),
    });
    return {
      id: scoreId,
      uid,
      playerName: cleanName,
      score: cleanScore,
      lotuses: cleanLotuses,
      distance: cleanDistance,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function fetchTopGameScores(maxItems = 8): Promise<CloudGameScore[]> {
  const path = 'gameScores';
  try {
    const q = query(
      collection(db, 'gameScores'),
      where('score', '>=', 0),
      orderBy('score', 'desc'),
      limit(maxItems),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: String(data.uid || ''),
        playerName: String(data.playerName || 'អ្នកលេង'),
        score: Number(data.score || 0),
        lotuses: Number(data.lotuses || 0),
        distance: Number(data.distance || 0),
        createdAt: data.createdAt as Timestamp | undefined,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveVoiceTranscript(
  uid: string,
  input: { title: string; transcript: string; language: string; durationSec: number },
): Promise<CloudTranscript> {
  const transcriptId = makeSafeId('tr');
  const path = `users/${uid}/transcripts/${transcriptId}`;
  const cleanTitle = input.title.trim().slice(0, 120) || 'កំណត់ត្រាសំឡេង';
  const cleanTranscript = input.transcript.trim().slice(0, 8000);
  const cleanLang = input.language.trim().slice(0, 32) || 'auto';
  const cleanDuration = Math.max(0, Math.min(600, Math.floor(input.durationSec)));

  try {
    await setDoc(doc(db, 'users', uid, 'transcripts', transcriptId), {
      uid,
      title: cleanTitle,
      transcript: cleanTranscript,
      language: cleanLang,
      durationSec: cleanDuration,
      createdAt: serverTimestamp(),
    });
    return {
      id: transcriptId,
      uid,
      title: cleanTitle,
      transcript: cleanTranscript,
      language: cleanLang,
      durationSec: cleanDuration,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function fetchUserTranscripts(uid: string): Promise<CloudTranscript[]> {
  const path = `users/${uid}/transcripts`;
  try {
    const q = query(
      collection(db, 'users', uid, 'transcripts'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: String(data.uid || uid),
        title: String(data.title || 'កំណត់ត្រាសំឡេង'),
        transcript: String(data.transcript || ''),
        language: String(data.language || 'auto'),
        durationSec: Number(data.durationSec || 0),
        createdAt: data.createdAt as Timestamp | undefined,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function deleteUserTranscript(uid: string, transcriptId: string): Promise<void> {
  const path = `users/${uid}/transcripts/${transcriptId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'transcripts', transcriptId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveVideoPromptRecord(
  uid: string,
  input: { prompt: string; aspectRatio: '16:9' | '9:16'; duration: '5s' | '8s' | '10s' },
): Promise<CloudVideoPrompt> {
  const videoId = makeSafeId('vid');
  const path = `users/${uid}/videoPrompts/${videoId}`;
  const cleanPrompt = input.prompt.trim().slice(0, 1000);
  try {
    await setDoc(doc(db, 'users', uid, 'videoPrompts', videoId), {
      uid,
      prompt: cleanPrompt,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      createdAt: serverTimestamp(),
    });
    return {
      id: videoId,
      uid,
      prompt: cleanPrompt,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function fetchUserVideoPrompts(uid: string): Promise<CloudVideoPrompt[]> {
  const path = `users/${uid}/videoPrompts`;
  try {
    const q = query(
      collection(db, 'users', uid, 'videoPrompts'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(15),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: String(data.uid || uid),
        prompt: String(data.prompt || ''),
        aspectRatio: data.aspectRatio === '9:16' ? '9:16' : '16:9',
        duration:
          data.duration === '5s' || data.duration === '10s' ? data.duration : '8s',
        createdAt: data.createdAt as Timestamp | undefined,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// ===== Admin-Managed Custom Stories (/stories/{storyId}) =====
const ALLOWED_MOODS = new Set<StageMood>([
  'angkor',
  'forest',
  'river',
  'sunset',
  'night',
  'courtyard',
]);

const ALLOWED_ACTIONS = new Set<CharAction>([
  'idle',
  'jump',
  'run',
  'walk',
  'sleep',
  'shake',
  'sad',
  'cheer',
  'grow',
  'fly',
]);

const ALLOWED_WEATHERS = new Set<SceneWeather>([
  'leaves',
  'wind',
  'petals',
  'fireflies',
  'rain',
  'sparkles',
]);

const ALLOWED_CATEGORIES = new Set<StoryCategory>(['wisdom', 'mystery', 'folktale']);
const ALLOWED_DIFFICULTIES = new Set<StoryDifficulty>(['easy', 'hard']);

export interface CloudCustomStory extends Story {
  published: boolean;
  authorUid: string;
  isCustom: true;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CustomStoryDraftInput {
  title: string;
  moral: string;
  category?: StoryCategory;
  difficulty?: StoryDifficulty;
  coverMood: StageMood;
  chars: [string, string];
  scenes: StoryScene[];
  quizPool: StoryQuestion[];
  poem: string[];
  published: boolean;
}

function sanitizeMood(val: unknown): StageMood {
  return ALLOWED_MOODS.has(val as StageMood) ? (val as StageMood) : 'forest';
}

function sanitizeCategory(val: unknown): StoryCategory {
  return ALLOWED_CATEGORIES.has(val as StoryCategory) ? (val as StoryCategory) : 'wisdom';
}

function sanitizeDifficulty(val: unknown): StoryDifficulty {
  return ALLOWED_DIFFICULTIES.has(val as StoryDifficulty) ? (val as StoryDifficulty) : 'hard';
}

function sanitizeAction(val: unknown): CharAction {
  return ALLOWED_ACTIONS.has(val as CharAction) ? (val as CharAction) : 'idle';
}

function sanitizeWeather(val: unknown): SceneWeather {
  return ALLOWED_WEATHERS.has(val as SceneWeather) ? (val as SceneWeather) : 'leaves';
}

function sanitizeStoryPayload(input: CustomStoryDraftInput) {
  const coverMood = sanitizeMood(input.coverMood);
  const category = sanitizeCategory(input.category);
  const difficulty = sanitizeDifficulty(input.difficulty);
  const charA = (input.chars[0] || '🐇').trim().slice(0, 16) || '🐇';
  const charB = (input.chars[1] || '🐢').trim().slice(0, 16) || '🐢';

  const scenes: StoryScene[] = (input.scenes || [])
    .slice(0, 12)
    .map((sc) => ({
      text: (sc.text || '').trim().slice(0, 600),
      actionA: sanitizeAction(sc.actionA),
      actionB: sanitizeAction(sc.actionB),
      mood: sanitizeMood(sc.mood || coverMood),
      prop: (sc.prop || '✨').trim().slice(0, 16) || '✨',
      weather: sanitizeWeather(sc.weather),
      bubbleA: (sc.bubbleA || '').trim().slice(0, 80),
      bubbleB: (sc.bubbleB || '').trim().slice(0, 80),
    }))
    .filter((sc) => sc.text.length > 0);

  if (scenes.length === 0) {
    scenes.push({
      text: 'សាច់រឿងចាប់ផ្ដើមនៅទីនេះ។',
      actionA: 'idle',
      actionB: 'idle',
      mood: coverMood,
      prop: '✨',
      weather: 'leaves',
      bubbleA: '',
      bubbleB: '',
    });
  }

  const quizPool: StoryQuestion[] = (input.quizPool || [])
    .slice(0, 8)
    .map((q) => {
      const ans = (q.ans || '').trim().slice(0, 120);
      const cleanChoices = (q.choices || [])
        .map((c) => c.trim().slice(0, 120))
        .filter((c) => c.length > 0)
        .slice(0, 4);
      if (ans && !cleanChoices.includes(ans)) {
        cleanChoices.unshift(ans);
      }
      const cleanKeys = (q.keys && q.keys.length > 0 ? q.keys : [ans])
        .map((k) => k.trim().slice(0, 60))
        .filter((k) => k.length > 0)
        .slice(0, 6);
      return {
        q: (q.q || '').trim().slice(0, 220),
        ans: ans || cleanChoices[0] || 'ត្រឹមត្រូវ',
        choices: cleanChoices.length >= 2 ? cleanChoices.slice(0, 4) : [ans || 'ត្រឹមត្រូវ', 'ផ្សេងទៀត'],
        keys: cleanKeys.length > 0 ? cleanKeys : [ans || 'ត្រឹមត្រូវ'],
        hint: (q.hint || 'សូមអានសាច់រឿងម្ដងទៀតណា!').trim().slice(0, 180),
      };
    })
    .filter((q) => q.q.length > 0);

  if (quizPool.length === 0) {
    quizPool.push({
      q: `តើគតិអប់រំសំខាន់នៃរឿង «${input.title.trim().slice(0, 60)}» គឺជាអ្វី?`,
      ans: input.moral.trim().slice(0, 120) || 'ធ្វើអំពើល្អ និងមានប្រាជ្ញា',
      choices: [
        input.moral.trim().slice(0, 120) || 'ធ្វើអំពើល្អ និងមានប្រាជ្ញា',
        'ខ្ជិលច្រអូសមិនព្យាយាម',
        'អួតអាងមើលងាយគេ',
        'មិនស្ដាប់ដំបូន្មាន',
      ],
      keys: [input.moral.trim().slice(0, 60) || 'ល្អ'],
      hint: 'សូមគិតដល់គតិអប់រំចុងរឿង!',
    });
  }

  const poem = (input.poem || [])
    .map((line) => line.trim().slice(0, 160))
    .filter((line) => line.length > 0)
    .slice(0, 10);

  if (poem.length === 0) {
    poem.push(input.moral.trim().slice(0, 160) || 'ចេះគិតពិចារណា នាំមកនូវជោគជ័យ។');
  }

  return {
    title: input.title.trim().slice(0, 120) || 'រឿងនិទានថ្មី',
    moral: input.moral.trim().slice(0, 240) || 'ធ្វើអំពើល្អ នាំមកនូវសុភមង្គល',
    category,
    difficulty,
    coverMood,
    chars: [charA, charB] as [string, string],
    scenes,
    quizPool,
    poem,
    published: Boolean(input.published),
  };
}

function docToCustomStory(id: string, data: Record<string, unknown>): CloudCustomStory {
  const sanitized = sanitizeStoryPayload({
    title: String(data.title || 'រឿងនិទានថ្មី'),
    moral: String(data.moral || ''),
    category: data.category ? sanitizeCategory(data.category) : 'folktale',
    difficulty: data.difficulty ? sanitizeDifficulty(data.difficulty) : 'easy',
    coverMood: sanitizeMood(data.coverMood),
    chars:
      Array.isArray(data.chars) && data.chars.length >= 2
        ? [String(data.chars[0]), String(data.chars[1])]
        : ['🐇', '🐢'],
    scenes: Array.isArray(data.scenes) ? (data.scenes as StoryScene[]) : [],
    quizPool: Array.isArray(data.quizPool) ? (data.quizPool as StoryQuestion[]) : [],
    poem: Array.isArray(data.poem) ? data.poem.map(String) : [],
    published: Boolean(data.published),
  });

  return {
    id,
    ...sanitized,
    authorUid: String(data.authorUid || ''),
    isCustom: true,
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

export async function fetchPublishedCustomStories(): Promise<CloudCustomStory[]> {
  const path = 'stories';
  try {
    const q = query(collection(db, 'stories'), where('published', '==', true), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => docToCustomStory(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchAllAdminStories(): Promise<CloudCustomStory[]> {
  const path = 'stories';
  try {
    const q = query(collection(db, 'stories'), limit(80));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => docToCustomStory(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function createCustomStory(
  uid: string,
  input: CustomStoryDraftInput,
): Promise<CloudCustomStory> {
  const storyId = makeSafeId('story');
  const path = `stories/${storyId}`;
  const clean = sanitizeStoryPayload(input);
  try {
    await setDoc(doc(db, 'stories', storyId), {
      ...clean,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id: storyId,
      ...clean,
      authorUid: uid,
      isCustom: true,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateCustomStory(
  storyId: string,
  input: CustomStoryDraftInput,
): Promise<void> {
  const path = `stories/${storyId}`;
  const clean = sanitizeStoryPayload(input);
  try {
    await updateDoc(doc(db, 'stories', storyId), {
      ...clean,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCustomStory(storyId: string): Promise<void> {
  const path = `stories/${storyId}`;
  try {
    await deleteDoc(doc(db, 'stories', storyId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ===== Visitor & Player Analytics (/visitLogs & Admin /users progress) =====
export type PublicVisitSection =
  | 'HOME'
  | 'STORIES'
  | 'GAME3D'
  | 'WORDS'
  | 'CAT'
  | 'FRIENDS'
  | 'MATH';

const ALLOWED_VISIT_SECTIONS = new Set<PublicVisitSection>([
  'HOME',
  'STORIES',
  'GAME3D',
  'WORDS',
  'CAT',
  'FRIENDS',
  'MATH',
]);

export interface CloudVisitLog {
  id: string;
  sessionId: string;
  section: PublicVisitSection;
  visitorType: 'guest' | 'user';
  visitorName: string;
  dayKey: string;
  createdAt?: Timestamp;
}

export interface CloudAdminPlayer {
  uid: string;
  displayName: string;
  bestGameScore: number;
  totalStars: number;
  storiesCompleted: number;
  updatedAt?: Timestamp;
}

export function getTodayDayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function logPageVisit(input: {
  sessionId: string;
  section: PublicVisitSection;
  visitorType: 'guest' | 'user';
  visitorName: string;
}): Promise<void> {
  if (!ALLOWED_VISIT_SECTIONS.has(input.section)) return;
  const cleanSession = input.sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  if (cleanSession.length < 4) return;

  const visitId = makeSafeId('v');
  const cleanName = input.visitorName.trim().slice(0, 60) || 'ភ្ញៀវទូទៅ';
  const visitorType = input.visitorType === 'user' ? 'user' : 'guest';
  const dayKey = getTodayDayKey();

  try {
    await setDoc(doc(db, 'visitLogs', visitId), {
      sessionId: cleanSession,
      section: input.section,
      visitorType,
      visitorName: cleanName,
      dayKey,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal telemetry: never interrupt user experience
  }
}

export async function fetchAdminVisitLogs(maxItems = 200): Promise<CloudVisitLog[]> {
  const path = 'visitLogs';
  try {
    const q = query(
      collection(db, 'visitLogs'),
      where('dayKey', '>=', '2020-01-01'),
      limit(maxItems),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        const rawSection = String(data.section || 'HOME') as PublicVisitSection;
        return {
          id: d.id,
          sessionId: String(data.sessionId || ''),
          section: ALLOWED_VISIT_SECTIONS.has(rawSection) ? rawSection : 'HOME',
          visitorType: (data.visitorType === 'user' ? 'user' : 'guest') as 'guest' | 'user',
          visitorName: String(data.visitorName || 'ភ្ញៀវទូទៅ'),
          dayKey: String(data.dayKey || ''),
          createdAt: data.createdAt as Timestamp | undefined,
        };
      })
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchAdminPlayers(maxItems = 60): Promise<CloudAdminPlayer[]> {
  const path = 'users';
  try {
    const q = query(collection(db, 'users'), where('uid', '>', ''), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        const starsObj =
          data.starsMap && typeof data.starsMap === 'object'
            ? (data.starsMap as Record<string, unknown>)
            : {};
        const starValues = Object.values(starsObj).map((v) => Math.max(0, Math.min(3, Number(v) || 0)));
        const totalStars = starValues.reduce((sum, v) => sum + v, 0);
        const storiesCompleted = starValues.filter((v) => v > 0).length;
        return {
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'អ្នកលេងខ្មែរ'),
          bestGameScore: Math.max(0, Math.floor(Number(data.bestGameScore) || 0)),
          totalStars,
          storiesCompleted,
          updatedAt: data.updatedAt as Timestamp | undefined,
        };
      })
      .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}


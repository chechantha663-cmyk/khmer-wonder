import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Fish, Hand, Laugh, Mic, MicOff, Play, Send, Square } from 'lucide-react';
import { STAGE_BACKDROPS } from '../data/themes';
import { playSfx, speakText, stopSpeech, type VoiceSettings } from '../utils/audio';

interface CatViewProps {
  voiceSettings: VoiceSettings;
  friends: string[];
  onBurst: () => void;
}

interface ChatMsg {
  id: number;
  who: 'me' | 'cat';
  text: string;
}

const JOKES_KM = [
  'ហេតុអ្វីកុំព្យូទ័រមិនដែលឃ្លាន? ព្រោះវាញ៉ាំ Byte ពេញថ្ងៃ! ហាហា!',
  'ហេតុអ្វីអ្នកសរសេរកូដចូលចិត្តភាពងងឹត? ព្រោះពន្លឺទាក់ទាញ Bug!',
  'គេថាឆ្មាមាន ៩ ជីវិត។ ខ្ញុំប្រើអស់ ៨ ទៅលើការគេង ហើយនៅសល់ ១ សម្រាប់ដេញត្រី!',
  'ខ្ញុំសួរកណ្ដុរថា ហេតុអ្វីរត់? វាឆ្លើយថា ព្រោះអ្នកមើលខ្ញុំដោយភ្នែកឃ្លាន!',
  'ម៉ាស៊ីនបោកខោអាវដូចមិត្តពិត ធ្វើឱ្យអ្នកស្អាត តែតែងលេបស្រោមជើងម្ខាង!',
  'ថ្ងៃច័ន្ទជាមិត្តដែលអ្នកមិនបានអញ្ជើញ តែមកគ្រប់សប្ដាហ៍!',
  'ខ្ញុំចង់ធ្វើរបបអាហារ ប៉ុន្តែអាហារបង្កើតមកឱ្យញ៉ាំ មិនមែនឱ្យមើលទេ!',
  'គ្រូពេទ្យប្រាប់ខ្ញុំឱ្យដើរ ១០,០០០ ជំហាន។ ខ្ញុំដើរពីគ្រែទៅទូទឹកកក ៥ ដងហើយ!',
  'មនុស្សថា លុយមិនអាចទិញសុភមង្គលបាន តែទិញត្រីបាន ហើយត្រីធ្វើឱ្យខ្ញុំសប្បាយ!',
  'ខ្ញុំមិនខ្ជិលទេ ខ្ញុំគ្រាន់តែស្ថិតក្នុងរបៀបសន្សំថាមពល!',
  'ពេលអ៊ីនធឺណិតយឺត ខ្ញុំរៀនអត់ធ្មត់។ ពេលវាលឿន ខ្ញុំភ្លេចអត់ធ្មត់ភ្លាម!',
  'ការដេញកន្ទុយខ្លួនឯង គឺជាកីឡាតែមួយគត់ដែលខ្ញុំមិនដែលឈ្នះ!',
  'មនុស្សចូលចិត្តថតរូបអាហារ។ ខ្ញុំចូលចិត្តញ៉ាំអាហារ មុនពេលអ្នកថតរូបវា!',
  'សួរថា ១ បូក ១ ស្មើប៉ុន្មាន? ខ្ញុំឆ្លើយថា ២ ត្រី ព្រោះអ្វីៗគិតជាត្រីទាំងអស់!',
  'ខ្ញុំទិញវ៉ាលីមួយ ព្រោះចង់ធ្វើដំណើរ។ ឥឡូវខ្ញុំគេងក្នុងវ៉ាលីនោះ ស្រួលណាស់!',
];

const RULES_KM: { keys: string[]; replies: string[] }[] = [
  {
    keys: ['សួស្តី', 'ជម្រាបសួរ', 'hello', 'hi', 'ហេ'],
    replies: [
      'មៀវ! សួស្តី! ខ្ញុំរង់ចាំអ្នកយូរហើយ ទាល់តែឃ្លានត្រី!',
      'សួស្តី! ខ្ញុំជាឆ្មាឆ្លាតជាងគេក្នុងភូមិ ទោះបីគេមិនទាន់ដឹងក៏ដោយ!',
      'ជម្រាបសួរ! ខ្ញុំទើបភ្ញាក់ពីគេង ១៥ ម៉ោង ហត់ណាស់!',
    ],
  },
  {
    keys: ['ឈ្មោះ', 'name'],
    replies: [
      'ខ្ញុំឈ្មោះមៀវមៀវ! ចុះអ្នកវិញ ឈ្មោះអ្វី? កុំប្រាប់ថាឈ្មោះ ត្រី ណា!',
      'គេហៅខ្ញុំថា ស្តេចឆ្មាអាចារ្យ តែអ្នកហៅខ្ញុំថា ឆ្មាស្អាត ក៏បាន!',
    ],
  },
  {
    keys: ['ឃ្លាន', 'បាយ', 'ញ៉ាំ', 'ត្រី', 'ម្ហូប', 'food'],
    replies: [
      'ខ្ញុំក៏ឃ្លានដែរ! ចុចប៊ូតុង «ឱ្យត្រីញ៉ាំ» មក មៀវ!',
      'ម្ហូបឆ្ងាញ់បំផុតគឺត្រីអាំងដែលអ្នកចែកឱ្យខ្ញុំ!',
      'ខ្ញុំទើបញ៉ាំ ៥ នាទីមុន តែឥឡូវឃ្លានទៀតហើយ ចម្លែកណាស់!',
    ],
  },
  {
    keys: ['ស្រលាញ់', 'ស្រឡាញ់', 'love', 'ចូលចិត្ត'],
    replies: [
      'ខ្ញុំក៏ស្រឡាញ់អ្នកដែរ ប៉ុន្តែស្រឡាញ់ត្រីជាងបន្តិច! ហិហិ!',
      'ឯ៎ ខ្មាសអៀនហើយ មៀវ! មុខខ្ញុំក្រហមក្រោមរោមហើយ!',
    ],
  },
  {
    keys: ['គេង', 'ងងុយ', 'sleep', 'ហត់'],
    replies: [
      'ខ្ញុំគេងបាន ១៦ ម៉ោងមួយថ្ងៃ អ្នកមិនអាចយកឈ្នះខ្ញុំទេ!',
      'គេងគឺជាអាជីពរបស់ខ្ញុំ ហើយខ្ញុំជាអ្នកជំនាញកម្រិតខ្ពស់!',
    ],
  },
  {
    keys: ['កំប្លែង', 'សើច', 'joke', 'ហាហា'],
    replies: JOKES_KM,
  },
  {
    keys: ['រៀន', 'កូដ', 'code', 'គណិត', 'javascript'],
    replies: [
      'រៀនកូដមែនទេ? ពូកែណាស់! សរសេរហើយកុំភ្លេចសម្រាកញ៉ាំត្រីផង!',
      'បើចង់គិតលេខ សាកចូលមន្ទីរពិសោធន៍គណិតវិទ្យាខាងលើទៅ ខ្ញុំជួយលើកទឹកចិត្ត!',
    ],
  },
  {
    keys: ['ឆ្កែ', 'dog'],
    replies: [
      'ឆ្កែ? ខ្ញុំមិនខ្លាចទេ... តែខ្ញុំសុំឡើងគេងលើដំបូលសិន!',
      'ឆ្កែស្មោះត្រង់នឹងម្ចាស់ ខ្ញុំស្មោះត្រង់នឹងត្រីអាំង!',
    ],
  },
];

const TEASE_KM = [
  '{f}! ឮឈ្មោះនេះខ្ញុំដឹងភ្លាមថាគួរឱ្យស្រឡាញ់ តែប្រយ័ត្នគាត់ទាញកន្ទុយខ្ញុំ!',
  '{f} ឬ? ឮថាគាត់គេងយូរជាងខ្ញុំទៅទៀត ហាហា!',
  'ប្រាប់ {f} ផងថា ឆ្មាអាចារ្យនឹកគាត់ ហើយនឹកត្រីអាំងដែលគាត់មាន!',
  '{f} ជាមិត្តល្អ តែពូកែបំផុតក្នុងការមិនចែកត្រីឱ្យខ្ញុំ!',
];

const FALLBACK_KM = [
  'មៀវ? ខ្ញុំស្ដាប់មិនសូវច្បាស់ ព្រោះត្រចៀកខ្ញុំមានរោម!',
  'អូហូ! គួរឱ្យចាប់អារម្មណ៍ណាស់... ខ្ញុំមិនសូវយល់ តែខ្ញុំធ្វើពុតថាយល់!',
  'ពាក្យនេះពិបាកពេក ខ្ញុំសុំទៅគេង ៥ នាទីសិន មៀវ!',
  'អ្នកនិយាយថា «ត្រី» ម្ដងទៀតបានទេ? ពាក្យនោះខ្ញុំស្ដាប់ច្បាស់ណាស់!',
];

const LANG_PACK: Record<string, { hi: string[]; jokes: string[]; fb: string[] }> = {
  en: {
    hi: ['Meow! Hello there, human!', 'Hi! I was napping, but I woke up for snacks.'],
    jokes: [
      'Why do cats love computers? To keep an eye on the mouse!',
      "I'm not lazy, I'm in energy-saving mode.",
      'I knocked a glass off the table. Gravity works. You are welcome, science!',
    ],
    fb: ['Meow? Say that again, my ears are fluffy.', 'Is that about fish?'],
  },
  fr: {
    hi: ['Miaou ! Salut, humain !'],
    jokes: [
      "Pourquoi les chats aiment l'ordinateur ? Pour surveiller la souris !",
      'Je ne suis pas paresseux, je suis en mode économie d’énergie.',
    ],
    fb: ['Miaou ? Répète un peu !'],
  },
  th: {
    hi: ['เหมียว! สวัสดีมนุษย์!'],
    jokes: ['ทำไมแมวชอบคอมพิวเตอร์? เพราะอยากเฝ้าดูเมาส์!'],
    fb: ['เหมียว? พูดอีกทีสิ!'],
  },
  vi: {
    hi: ['Meo! Xin chào bạn!'],
    jokes: ['Sao mèo thích máy tính? Để canh chừng con chuột!'],
    fb: ['Meo? Nói lại đi!'],
  },
  ja: {
    hi: ['にゃー！こんにちは！'],
    jokes: ['なぜ猫はパソコンが好きなの？マウスを見張れるからさ！'],
    fb: ['にゃ？もう一回言って！'],
  },
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function CatView({ voiceSettings, friends, onBurst }: CatViewProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 1,
      who: 'cat',
      text: 'មៀវ! ខ្ញុំជាឆ្មាអាចារ្យ។ អង្អែលក្បាល ឱ្យត្រីញ៉ាំ ឬនិយាយអ្វីមួយមក ខ្ញុំនឹងធ្វើឱ្យអ្នកសើច!',
    },
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'chat' | 'mimic'>('chat');
  const [lang, setLang] = useState('km-KH');
  const [pitch, setPitch] = useState(1.6);
  const [talking, setTalking] = useState(false);
  const [mood, setMood] = useState<'normal' | 'happy' | 'yum'>('normal');
  const [hunger, setHunger] = useState(72);
  const [happiness, setHappiness] = useState(80);
  const [status, setStatus] = useState('ចុចលើឆ្មា ឬឱ្យត្រីញ៉ាំដើម្បីលេងជាមួយវា');
  const [autoLoop, setAutoLoop] = useState(false);
  const [listening, setListening] = useState(false);
  const [floatEmoji, setFloatEmoji] = useState<{ id: number; icon: string } | null>(null);

  const autoRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const mouthTimeoutRef = useRef<number | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    autoRef.current = autoLoop;
  }, [autoLoop]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      autoRef.current = false;
      stopSpeech();
      recRef.current?.stop();
      if (mouthTimeoutRef.current) window.clearTimeout(mouthTimeoutRef.current);
    };
  }, []);

  const triggerFloat = (icon: string) => {
    setFloatEmoji({ id: Date.now(), icon });
    window.setTimeout(() => setFloatEmoji(null), 1000);
  };

  const addMessage = (who: 'me' | 'cat', text: string) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), who, text }]);
  };

  const catSpeak = useCallback(
    (text: string, onDone?: () => void) => {
      addMessage('cat', text);
      playSfx('meow', voiceSettings.sfxEnabled);
      if (mouthTimeoutRef.current) window.clearTimeout(mouthTimeoutRef.current);

      setTalking(true);
      setStatus('ឆ្មាកំពុងនិយាយ...');

      const finish = () => {
        setTalking(false);
        setStatus('');
        onDone?.();
      };

      if (!voiceSettings.voiceEnabled) {
        mouthTimeoutRef.current = window.setTimeout(
          finish,
          Math.min(text.length * 55 + 750, 4800),
        );
        return;
      }

      let finished = false;
      const safeFinish = () => {
        if (finished) return;
        finished = true;
        finish();
      };

      window.setTimeout(() => {
        speakText(text, voiceSettings, {
          lang,
          pitch,
          onStart: () => setTalking(true),
          onEnd: safeFinish,
        });
        mouthTimeoutRef.current = window.setTimeout(
          safeFinish,
          Math.min(text.length * 85 + 2200, 8500),
        );
      }, 420);
    },
    [lang, pitch, voiceSettings],
  );

  const computeReply = (text: string): string => {
    if (mode === 'mimic') {
      return text + (lang.startsWith('km') ? pickRandom(['... មៀវ!', ' ហាហា!', ' មៀវៗ!']) : '... meow!');
    }
    if (!lang.startsWith('km')) {
      const code = lang.slice(0, 2);
      const pack = LANG_PACK[code] || LANG_PACK.en;
      if (/hello|hi|hey|bonjour|สวัสดี|xin|こん/i.test(text)) return pickRandom(pack.hi);
      return Math.random() < 0.72 ? pickRandom(pack.jokes) : pickRandom(pack.fb);
    }

    const lower = text.toLowerCase();
    for (const f of friends) {
      if (f && lower.includes(f.toLowerCase())) {
        return pickRandom(TEASE_KM).split('{f}').join(f);
      }
    }
    if (friends.length > 0 && (lower.includes('មិត្ត') || lower.includes('friend'))) {
      return pickRandom(TEASE_KM).split('{f}').join(pickRandom(friends));
    }
    for (const rule of RULES_KM) {
      if (rule.keys.some((k) => lower.includes(k))) return pickRandom(rule.replies);
    }
    return pickRandom(FALLBACK_KM);
  };

  const handleUserText = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setAutoLoop(false);
    addMessage('me', trimmed);
    setHappiness((h) => Math.min(100, h + 4));
    catSpeak(computeReply(trimmed));
  };

  const tellJokeNow = () => {
    setAutoLoop(false);
    const pack = LANG_PACK[lang.slice(0, 2)] || LANG_PACK.en;
    const joke = lang.startsWith('km') ? pickRandom(JOKES_KM) : pickRandom(pack.jokes);
    catSpeak(joke);
  };

  const runLoopJoke = useCallback(() => {
    if (!autoRef.current) return;
    const pack = LANG_PACK[lang.slice(0, 2)] || LANG_PACK.en;
    const joke = lang.startsWith('km') ? pickRandom(JOKES_KM) : pickRandom(pack.jokes);
    catSpeak(joke, () => {
      if (autoRef.current) {
        window.setTimeout(() => runLoopJoke(), 1300);
      }
    });
  }, [catSpeak, lang]);

  const toggleAuto = () => {
    if (autoLoop) {
      setAutoLoop(false);
      autoRef.current = false;
      stopSpeech();
      setTalking(false);
      setStatus('ឆ្មាឈប់និយាយហើយ');
    } else {
      setAutoLoop(true);
      autoRef.current = true;
      runLoopJoke();
    }
  };

  const stopCat = () => {
    setAutoLoop(false);
    autoRef.current = false;
    stopSpeech();
    if (mouthTimeoutRef.current) window.clearTimeout(mouthTimeoutRef.current);
    setTalking(false);
    setStatus('ឆ្មាស្ងាត់ហើយ 🤫');
  };

  const feedFish = () => {
    playSfx('crunch', voiceSettings.sfxEnabled);
    setHunger((h) => Math.min(100, h + 22));
    setHappiness((h) => Math.min(100, h + 10));
    setMood('yum');
    triggerFloat('🐟');
    onBurst();
    setStatus('ឆ្ងាញ់ណាស់! អរគុណសម្រាប់ត្រីអាំង 🐟');
    addMessage('cat', 'ញ៉ាំៗ! ត្រីអាំងឆ្ងាញ់ណាស់ អរគុណអ្នកណា មៀវ!');
    window.setTimeout(() => setMood('normal'), 1600);
  };

  const petCat = () => {
    playSfx('purr', voiceSettings.sfxEnabled);
    setHappiness((h) => Math.min(100, h + 15));
    setMood('happy');
    triggerFloat('💖');
    setStatus('ហឺរៗ... ស្រួលខ្លួនណាស់ អង្អែលទៀតមក!');
    window.setTimeout(() => setMood('normal'), 1600);
  };

  const toggleMic = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onstart: () => void;
        onresult: (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onstart: () => void;
        onresult: (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setStatus('កម្មវិធីរុករកនេះមិនគាំទ្រមីក្រូហ្វូនទេ — សូមវាយអត្ថបទជំនួស');
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.onstart = () => {
      setListening(true);
      setStatus('កំពុងស្ដាប់សំឡេងអ្នក...');
    };
    rec.onresult = (e) => {
      const heard = e.results[0]?.[0]?.transcript;
      if (heard) handleUserText(heard);
    };
    rec.onerror = () => {
      setListening(false);
      setStatus('មិនឮសំឡេង ឬមិនទាន់អនុញ្ញាតមីក្រូហ្វូន');
    };
    rec.onend = () => {
      setListening(false);
    };
    recRef.current = rec;
    rec.start();
  };

  return (
    <section className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-[var(--accent-main)]">
          មិត្តឆ្មានិយាយមានជីវិត · ស្គាល់ឈ្មោះមិត្តភក្តិរបស់អ្នក
        </p>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          ឆ្មាអាចារ្យ អ្នកកំប្លែង
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-secondary)]">
          អង្អែលក្បាល ឱ្យត្រីញ៉ាំ និយាយតាមមីក្រូហ្វូន ឬវាយអត្ថបទ — ឆ្មាអាចារ្យនឹងឆ្លើយកំប្លែង
          ឬត្រាប់តាមសំឡេងអ្នកភ្លាម!
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left: Interactive Cat Stage */}
        <div className="space-y-4 lg:col-span-5">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] shadow-sm">
            {/* Illustrated backdrop behind cat */}
            <div className="relative flex flex-col items-center justify-center px-6 pt-8 pb-6">
              <img
                src={STAGE_BACKDROPS.courtyard}
                alt="ទីធ្លាឆ្មាអាចារ្យ"
                referrerPolicy="no-referrer"
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-30"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--surface-elevated)] via-transparent to-transparent" />

              {/* Floating Reaction */}
              <AnimatePresence>
                {floatEmoji && (
                  <motion.div
                    key={floatEmoji.id}
                    initial={{ opacity: 0, y: 12, scale: 0.6 }}
                    animate={{ opacity: 1, y: -44, scale: 1.35 }}
                    exit={{ opacity: 0, y: -70 }}
                    className="pointer-events-none absolute top-14 z-20 text-4xl"
                  >
                    {floatEmoji.icon}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={petCat}
                aria-label="អង្អែលឆ្មាអាចារ្យ"
                className="relative z-10 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--accent-main)]"
              >
                <svg
                  className={`cat-svg h-56 w-56 drop-shadow-[0_14px_20px_rgba(0,0,0,0.18)] ${
                    talking ? 'talking' : ''
                  }`}
                  viewBox="0 0 220 230"
                  role="img"
                  aria-label="ឆ្មាអាចារ្យ"
                >
                  <path
                    className="cat-tail"
                    d="M165 190 C215 190 225 130 195 110 C215 150 190 170 160 168 Z"
                    fill="#ea7b2c"
                  />
                  <ellipse cx="110" cy="182" rx="52" ry="40" fill="#f59e42" />
                  <ellipse cx="110" cy="192" rx="30" ry="28" fill="#ffedd5" />
                  <g className="cat-ear">
                    <polygon points="52,70 58,18 98,48" fill="#ea7b2c" />
                    <polygon points="62,60 65,34 85,50" fill="#fda4af" />
                  </g>
                  <g className="cat-ear cat-ear-r">
                    <polygon points="168,70 162,18 122,48" fill="#ea7b2c" />
                    <polygon points="158,60 155,34 135,50" fill="#fda4af" />
                  </g>
                  <circle cx="110" cy="100" r="62" fill="#f59e42" />
                  <path
                    d="M96 44 L100 62 M110 40 L110 60 M124 44 L120 62"
                    stroke="#c25e18"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />

                  {mood === 'happy' ? (
                    <g stroke="#2a1d4a" strokeWidth="4.2" fill="none" strokeLinecap="round">
                      <path d="M72 98 Q84 84 96 98" />
                      <path d="M124 98 Q136 84 148 98" />
                    </g>
                  ) : (
                    <>
                      <ellipse className="cat-eye" cx="84" cy="95" rx="11" ry="14" fill="#fff" />
                      <ellipse className="cat-eye" cx="136" cy="95" rx="11" ry="14" fill="#fff" />
                      <circle className="cat-eye" cx="86" cy="98" r="6" fill="#1e1b4b" />
                      <circle className="cat-eye" cx="134" cy="98" r="6" fill="#1e1b4b" />
                      <circle cx="88" cy="95" r="2.3" fill="#fff" />
                      <circle cx="136" cy="95" r="2.3" fill="#fff" />
                    </>
                  )}

                  <ellipse cx="66" cy="120" rx="11" ry="7" fill="#fb7185" opacity=".55" />
                  <ellipse cx="154" cy="120" rx="11" ry="7" fill="#fb7185" opacity=".55" />
                  <polygon points="102,114 118,114 110,124" fill="#e11d48" />
                  <ellipse className="cat-mouth" cx="110" cy="134" rx="13" ry="12" fill="#881337" />
                  <ellipse className="cat-mouth" cx="110" cy="141" rx="7" ry="4" fill="#fb7185" />
                  <g stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".9">
                    <path d="M60 118 L22 108" />
                    <path d="M60 126 L20 130" />
                    <path d="M60 134 L26 148" />
                    <path d="M160 118 L198 108" />
                    <path d="M160 126 L200 130" />
                    <path d="M160 134 L194 148" />
                  </g>
                  <ellipse cx="82" cy="218" rx="20" ry="9" fill="#ffedd5" />
                  <ellipse cx="138" cy="218" rx="20" ry="9" fill="#ffedd5" />
                </svg>
              </button>

              <p
                className="relative z-10 mt-2 min-h-[24px] text-center text-sm font-medium text-[var(--ink-secondary)]"
                aria-live="polite"
              >
                {status}
              </p>
            </div>

            {/* Care Meters */}
            <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-5 py-3.5 text-xs">
              <div>
                <div className="flex justify-between font-medium text-[var(--ink-secondary)]">
                  <span>ភាពឆ្អែត (ត្រី)</span>
                  <span className="font-mono-num">{hunger}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${hunger}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-medium text-[var(--ink-secondary)]">
                  <span>ភាពសប្បាយ</span>
                  <span className="font-mono-num">{happiness}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${happiness}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Care & Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={feedFish}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-main)] px-3 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap"
            >
              <Fish className="h-4 w-4" />
              ឱ្យត្រីញ៉ាំ
            </button>
            <button
              type="button"
              onClick={petCat}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-subtle)] whitespace-nowrap"
            >
              <Hand className="h-4 w-4" />
              អង្អែលក្បាល
            </button>
            <button
              type="button"
              onClick={tellJokeNow}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-subtle)] whitespace-nowrap"
            >
              <Laugh className="h-4 w-4" />
              រឿងកំប្លែង
            </button>
            <button
              type="button"
              onClick={toggleMic}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
                listening
                  ? 'bg-rose-600 text-white'
                  : 'border border-[var(--border-hairline)] bg-[var(--surface-elevated)] text-[var(--ink-primary)] hover:bg-[var(--surface-subtle)]'
              }`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? 'ឈប់ស្ដាប់' : 'និយាយ'}
            </button>
            <button
              type="button"
              onClick={toggleAuto}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-subtle)] whitespace-nowrap"
            >
              <Play className="h-4 w-4" />
              {autoLoop ? 'ឈប់រហូត' : 'កំប្លែងរហូត'}
            </button>
            <button
              type="button"
              onClick={stopCat}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm font-semibold text-[var(--ink-primary)] whitespace-nowrap"
            >
              <Square className="h-4 w-4" />
              ឱ្យស្ងាត់
            </button>
          </div>
        </div>

        {/* Right: Chat + Controls */}
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm lg:col-span-7">
          {/* Mode Segmented Control & Language */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
            <div className="inline-flex rounded-lg bg-[var(--surface-subtle)] p-1">
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'chat'
                    ? 'bg-[var(--surface-elevated)] text-[var(--ink-primary)] shadow-sm'
                    : 'text-[var(--ink-secondary)]'
                }`}
              >
                ឆ្លើយកំប្លែង
              </button>
              <button
                type="button"
                onClick={() => setMode('mimic')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'mimic'
                    ? 'bg-[var(--surface-elevated)] text-[var(--ink-primary)] shadow-sm'
                    : 'text-[var(--ink-secondary)]'
                }`}
              >
                ត្រាប់តាមខ្ញុំ
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-2 text-[var(--ink-secondary)]">
                ភាសា
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink-primary)]"
                >
                  <option value="km-KH">ខ្មែរ</option>
                  <option value="en-US">English</option>
                  <option value="fr-FR">Français</option>
                  <option value="th-TH">ไทย</option>
                  <option value="vi-VN">Tiếng Việt</option>
                  <option value="ja-JP">日本語</option>
                </select>
              </label>

              <label className="hidden items-center gap-2 text-[var(--ink-secondary)] sm:flex">
                សំឡេងខ្ពស់
                <input
                  type="range"
                  min={0.8}
                  max={2}
                  step={0.1}
                  value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))}
                  className="w-20 accent-[var(--accent-main)]"
                />
              </label>
            </div>
          </div>

          {/* Chat Log */}
          <div
            ref={logRef}
            aria-live="polite"
            className="mt-4 flex h-72 flex-col gap-2.5 overflow-y-auto rounded-xl bg-[var(--surface-subtle)] p-4"
          >
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-[84%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.who === 'me'
                    ? 'self-end rounded-br-sm bg-[var(--accent-main)] text-[var(--accent-ink)]'
                    : 'self-start rounded-bl-sm border border-[var(--border-hairline)] bg-[var(--surface-elevated)] text-[var(--ink-primary)]'
                }`}
              >
                {m.who === 'cat' ? `🐱 ${m.text}` : m.text}
              </motion.div>
            ))}
          </div>

          {/* Input Row */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUserText(input);
              setInput('');
            }}
            className="mt-4 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="សរសេរអ្វីមួយប្រាប់ឆ្មាអាចារ្យ..."
              className="min-h-[44px] flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-4 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-main)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
            >
              <Send className="h-4 w-4" />
              ផ្ញើ
            </button>
          </form>

          {friends.length > 0 && (
            <p className="mt-3 text-xs text-[var(--ink-secondary)]">
              គន្លឹះ៖ សាកវាយឈ្មោះមិត្តភក្តិអ្នក ({friends.slice(0, 4).join(', ')})
              ឆ្មានឹងលេងសើចអំពីពួកគេ!
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

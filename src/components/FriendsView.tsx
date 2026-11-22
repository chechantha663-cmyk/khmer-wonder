import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Disc3, Megaphone, Plus, Sparkles, X } from 'lucide-react';
import { getFirstGrapheme, playSfx, speakText, type VoiceSettings } from '../utils/audio';

interface FriendsViewProps {
  voiceSettings: VoiceSettings;
  friends: string[];
  onChangeFriends: (next: string[]) => void;
  onBurst: () => void;
}

const MESSAGES: Record<string, string[]> = {
  greet: [
    'សួស្តី {n}! ថ្ងៃនេះសប្បាយចិត្តទេ?',
    'ជម្រាបសួរ {n}! រីករាយណាស់ដែលបានជួបអ្នក!',
    'ហេ {n}! មុខអ្នកភ្លឺថ្ងៃនេះ ឬជាពន្លឺព្រះអាទិត្យ?',
    '{n} មកហើយ! សូមបាត់ពាក្យ «ហត់» ពីថ្ងៃនេះ ហើយញញឹមបន្ត!',
  ],
  compliment: [
    '{n} ជាមនុស្សដែលមានទឹកចិត្តល្អណាស់!',
    'ស្នាមញញឹមរបស់ {n} ធ្វើឱ្យថ្ងៃគ្រប់គ្នាភ្លឺស្វាង!',
    '{n} ពូកែណាស់ កុំឈប់ព្យាយាមណា!',
    'មានមិត្តដូច {n} គឺជាសំណាងដ៏ធំមួយ!',
    '{n} ឆ្លាតដល់ម្ល៉េះ សូម្បីតែ Wi-Fi ក៏ចង់តភ្ជាប់ដោយសារអ្នក!',
  ],
  fortune: [
    'ថ្ងៃនេះ {n} នឹងមានដំណឹងល្អមួយមកដល់!',
    'សប្ដាហ៍នេះ {n} នឹងបានជួបរឿងសប្បាយមិននឹកស្មានដល់!',
    'ផ្កាយប្រាប់ខ្ញុំថា {n} នឹងញ៉ាំអាហារឆ្ងាញ់ ហើយមានអ្នកប៉ាវទៀត!',
    'ពិភពលោកកំពុងរៀបចំរឿងល្អមួយសម្រាប់ {n} សូមរង់ចាំ!',
  ],
  birthday: [
    'សូមជូនពរ {n}! សូមឱ្យមានសុខភាពល្អ និងសប្បាយរីករាយគ្រប់ថ្ងៃ!',
    'រីករាយថ្ងៃកំណើត {n}! សូមឱ្យនំខេកធំ និងសំណាងល្អតាមជាប់ជានិច្ច!',
    '{n} អាយុកាន់តែច្រើន តែកាន់តែសង្ហា និងស្អាតជាងមុន!',
  ],
  dare: [
    '{n} ត្រូវរាំ ១០ វិនាទីឥឡូវនេះឱ្យមិត្តភក្តិមើល!',
    '{n} ត្រូវប្រាប់រឿងកំប្លែងមួយដោយមិនសើចខ្លួនឯង!',
    '{n} ត្រូវហៅឈ្មោះខ្លួនឯងដោយសំឡេងឆ្មា «មៀវ» ៣ ដង!',
    '{n} ត្រូវធ្វើសំឡេងសត្វ ៣ ប្រភេទឱ្យគ្រប់គ្នាទាយ!',
    '{n} ត្រូវច្រៀងមួយឃ្លាឥឡូវនេះ!',
  ],
  joke: [
    '{n} ដឹងទេ? ហេតុអ្វីកុំព្យូទ័រមិនដែលឃ្លាន? ព្រោះវាញ៉ាំ Byte ពេញថ្ងៃ! ហាហា!',
    '{n}! ម៉ាស៊ីនបោកខោអាវចូលចិត្តលេបស្រោមជើងម្ខាងរបស់អ្នកជានិច្ច!',
    '{n} ដឹងទេ? ខ្ញុំមិនខ្ជិលទេ ខ្ញុំគ្រាន់តែស្ថិតក្នុងរបៀបសន្សំថាមពល!',
  ],
};

const NICKNAMES = [
  'ស្ដេចញញឹម',
  'ម្ចាស់ចិត្តល្អ',
  'អ្នកប្រាជ្ញតូច',
  'ហ្វូងសំណាង',
  'តារាភ្លឺ',
  'ព្រះអាទិត្យតូច',
  'ស្ដេចគេង',
  'ម្ចាស់ពាក្យកំប្លែង',
];

const FACES: Record<string, string> = {
  greet: '👋',
  compliment: '🥰',
  fortune: '🔮',
  nickname: '😎',
  birthday: '🎂',
  dare: '🤪',
  joke: '😂',
  custom: '📣',
};

const WHEEL_COLORS = ['#ea580c', '#047857', '#0284c7', '#d97706', '#be123c', '#7c3aed', '#0d9488', '#b45309'];

function colorOf(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + (ch.codePointAt(0) || 0)) % 360;
  return `hsl(${h}, 60%, 44%)`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function FriendsView({
  voiceSettings,
  friends,
  onChangeFriends,
  onBurst,
}: FriendsViewProps) {
  const [nameInput, setNameInput] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [customTemplate, setCustomTemplate] = useState(
    '{name} ជាមិត្តដ៏ល្អរបស់ខ្ញុំ! សូមជូនពរ {name} សប្បាយរីករាយជានិច្ច!',
  );
  const [stageEmoji, setStageEmoji] = useState('🎉');
  const [stageMessage, setStageMessage] = useState(
    'បង្វិលកង់ចាប់ឆ្នោត ឬជ្រើសឈ្មោះមិត្ត ហើយចុចប៊ូតុងសកម្មភាពខាងក្រោម!',
  );
  const [msgKey, setMsgKey] = useState(0);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const safeSelectedIdx = friends.length === 0 ? -1 : Math.min(selectedIdx, friends.length - 1);
  const selectedFriend = safeSelectedIdx >= 0 ? friends[safeSelectedIdx] : null;

  const addFriend = () => {
    const clean = nameInput.trim();
    if (!clean) {
      playSfx('error', voiceSettings.sfxEnabled);
      return;
    }
    if (!friends.includes(clean)) {
      const next = [...friends, clean];
      onChangeFriends(next);
      setSelectedIdx(next.length - 1);
    } else {
      setSelectedIdx(friends.indexOf(clean));
    }
    setNameInput('');
    playSfx('success', voiceSettings.sfxEnabled);
  };

  const removeFriend = (idx: number) => {
    const next = friends.filter((_, i) => i !== idx);
    onChangeFriends(next);
    setSelectedIdx((cur) => (next.length === 0 ? 0 : Math.min(cur, next.length - 1)));
    playSfx('click', voiceSettings.sfxEnabled);
  };

  const announce = (text: string, emoji: string) => {
    setStageEmoji(emoji);
    setStageMessage(text);
    setMsgKey((k) => k + 1);
    playSfx('success', voiceSettings.sfxEnabled);
    onBurst();
    speakText(text, voiceSettings, { lang: 'km-KH' });
  };

  const runAction = (type: string, targetOverride?: string) => {
    const target = targetOverride || selectedFriend;
    if (!target) {
      playSfx('error', voiceSettings.sfxEnabled);
      setStageMessage('សូមបន្ថែមឈ្មោះមិត្តភក្តិយ៉ាងតិច ១ នាក់ជាមុនសិន!');
      return;
    }
    const kinds = ['greet', 'compliment', 'fortune', 'nickname', 'birthday', 'dare', 'joke'];
    const real = type === 'random' ? pick(kinds) : type;
    if (real === 'nickname') {
      announce(`ឈ្មោះក្រៅរបស់ ${target} គឺ «${target} ${pick(NICKNAMES)}»!`, FACES.nickname);
      return;
    }
    const tpl = pick(MESSAGES[real]);
    announce(tpl.split('{n}').join(target), FACES[real]);
  };

  const runCustom = (toAll: boolean) => {
    const clean = customTemplate.trim();
    if (!clean || friends.length === 0) {
      playSfx('error', voiceSettings.sfxEnabled);
      return;
    }
    if (toAll) {
      const lines = friends.map((f) => clean.split('{name}').join(f).split('{n}').join(f));
      announce(lines.join('\n'), FACES.custom);
    } else if (selectedFriend) {
      announce(
        clean.split('{name}').join(selectedFriend).split('{n}').join(selectedFriend),
        FACES.custom,
      );
    }
  };

  // Interactive Spin-the-Wheel
  const spinWheel = () => {
    if (spinning || friends.length === 0) {
      if (friends.length === 0) playSfx('error', voiceSettings.sfxEnabled);
      return;
    }
    setSpinning(true);
    const sliceDeg = 360 / friends.length;
    const winnerIndex = Math.floor(Math.random() * friends.length);
    // Pointer is at top (270deg in SVG coordinates, or 0deg offset from top).
    // Segment i spans [i * sliceDeg, (i+1) * sliceDeg] clockwise from top.
    const centerOfWinner = winnerIndex * sliceDeg + sliceDeg / 2;
    const extraSpins = 5 * 360;
    const currentMod = ((wheelAngle % 360) + 360) % 360;
    const targetMod = (360 - centerOfWinner) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const nextAngle = wheelAngle + extraSpins + delta;

    setWheelAngle(nextAngle);
    for (let t = 0; t < 12; t++) {
      window.setTimeout(() => playSfx('tick', voiceSettings.sfxEnabled), t * 240);
    }

    window.setTimeout(() => {
      setSpinning(false);
      setSelectedIdx(winnerIndex);
      runAction('random', friends[winnerIndex]);
    }, 3400);
  };

  const wheelSlices = useMemo(() => {
    if (friends.length === 0) return [];
    const n = friends.length;
    const r = 110;
    const cx = 120;
    const cy = 120;
    return friends.map((name, i) => {
      const startDeg = (i * 360) / n - 90;
      const endDeg = ((i + 1) * 360) / n - 90;
      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const largeArc = endDeg - startDeg > 180 ? 1 : 0;
      const path =
        n === 1
          ? `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx - 0.01},${cy - r} Z`
          : `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
      const midDeg = (startDeg + endDeg) / 2;
      const midRad = (midDeg * Math.PI) / 180;
      const tx = cx + r * 0.62 * Math.cos(midRad);
      const ty = cy + r * 0.62 * Math.sin(midRad);
      return {
        name,
        path,
        tx,
        ty,
        midDeg,
        color: WHEEL_COLORS[i % WHEEL_COLORS.length],
      };
    });
  }, [friends]);

  return (
    <section className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-[var(--accent-main)]">
          ល្បែងជួបជុំមិត្តភក្តិ · កង់វិលចាប់ឆ្នោត
        </p>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          លេងជាមួយមិត្តភក្តិ និងកង់វិលសំណាង
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-secondary)]">
          បន្ថែមឈ្មោះមិត្តភក្តិរបស់អ្នក បង្វិលកង់ចាប់ឆ្នោត ឬចុចប៊ូតុងសរសើរ ទស្សន៍ទាយ ប្រថុយ (Dare)
          និងប្រកាសសារផ្ទាល់ខ្លួនជាមួយផ្កាភ្លើង!
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Friends List + Spin Wheel */}
        <div className="space-y-5 lg:col-span-5">
          {/* Add Friend Panel */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm">
            <label htmlFor="friend-name" className="block text-sm font-semibold text-[var(--ink-primary)]">
              បញ្ជីឈ្មោះមិត្តភក្តិ ({friends.length} នាក់)
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addFriend();
              }}
              className="mt-2.5 flex gap-2"
            >
              <input
                id="friend-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="ឧ. ធីតា, សុខា, ដារ៉ា..."
                className="min-h-[44px] flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3.5 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-main)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                បន្ថែម
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {friends.map((name, i) => (
                <div
                  key={name}
                  className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    i === safeSelectedIdx
                      ? 'border-[var(--accent-main)] bg-[var(--accent-soft)] text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedIdx(i)}
                    className="inline-flex items-center gap-2"
                  >
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white"
                      style={{ background: colorOf(name) }}
                    >
                      {getFirstGrapheme(name)}
                    </span>
                    <span>{name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`លុប ${name}`}
                    onClick={() => removeFriend(i)}
                    className="rounded-full p-0.5 text-[var(--ink-secondary)] hover:bg-black/10 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Spin the Wheel Card */}
          <div className="flex flex-col items-center rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm">
            <div className="relative flex items-center justify-center">
              {/* Top Pointer */}
              <div
                aria-hidden="true"
                className="absolute -top-2.5 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-r-[10px] border-t-[18px] border-l-[10px] border-r-transparent border-t-[var(--accent-main)] border-l-transparent drop-shadow"
              />
              <motion.svg
                viewBox="0 0 240 240"
                className="h-60 w-60 drop-shadow-md"
                animate={{ rotate: wheelAngle }}
                transition={{ duration: 3.3, ease: [0.18, 0.88, 0.22, 1] }}
              >
                {wheelSlices.length === 0 ? (
                  <circle cx="120" cy="120" r="110" fill="#e5e7eb" />
                ) : (
                  wheelSlices.map((s) => (
                    <g key={s.name}>
                      <path d={s.path} fill={s.color} stroke="#ffffff" strokeWidth="2" />
                      <text
                        x={s.tx}
                        y={s.ty}
                        fill="#ffffff"
                        fontSize="12"
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${s.midDeg}, ${s.tx}, ${s.ty})`}
                      >
                        {s.name.length > 8 ? `${s.name.slice(0, 7)}…` : s.name}
                      </text>
                    </g>
                  ))
                )}
                <circle cx="120" cy="120" r="22" fill="#ffffff" stroke="#e7e5e4" strokeWidth="3" />
                <text x="120" y="125" textAnchor="middle" fontSize="16">
                  🎯
                </text>
              </motion.svg>
            </div>

            <button
              type="button"
              disabled={spinning || friends.length === 0}
              onClick={spinWheel}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-main)] px-6 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50 whitespace-nowrap"
            >
              <Disc3 className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
              {spinning ? 'កំពុងវិលចាប់ឆ្នោត...' : 'បង្វិលកង់ចាប់ឆ្នោតមិត្ត'}
            </button>
          </div>
        </div>

        {/* Right Column: Live Stage + Action Buttons + Custom Announcer */}
        <div className="space-y-5 lg:col-span-7">
          {/* Announcement Stage */}
          <div className="flex min-h-[210px] flex-col items-center justify-center rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-7 text-center shadow-sm">
            <motion.div
              key={`emoji-${msgKey}`}
              initial={{ scale: 0.5, rotate: -14 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              className="text-5xl"
            >
              {stageEmoji}
            </motion.div>
            <motion.p
              key={`msg-${msgKey}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display mt-4 whitespace-pre-line text-xl leading-relaxed font-bold text-[var(--ink-primary)] sm:text-2xl"
              aria-live="polite"
            >
              {stageMessage}
            </motion.p>
            {selectedFriend && (
              <p className="mt-2 text-xs text-[var(--ink-secondary)]">
                មិត្តដែលកំពុងជ្រើស៖ {selectedFriend}
              </p>
            )}
          </div>

          {/* 8 Action Grid */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { id: 'greet', label: '👋 ស្វាគមន៍' },
              { id: 'compliment', label: '💖 សរសើរ' },
              { id: 'fortune', label: '🔮 ទស្សន៍ទាយ' },
              { id: 'nickname', label: '🏷️ ឈ្មោះក្រៅ' },
              { id: 'birthday', label: '🎂 ជូនពរ' },
              { id: 'dare', label: '🎲 ប្រថុយ Dare' },
              { id: 'joke', label: '😂 កំប្លែង' },
              { id: 'random', label: '✨ ចៃដន្យ' },
            ].map((act) => (
              <motion.button
                key={act.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => runAction(act.id)}
                className="min-h-[46px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--ink-primary)] shadow-sm transition-colors hover:border-[var(--accent-main)] hover:bg-[var(--accent-soft)] whitespace-nowrap"
              >
                {act.label}
              </motion.button>
            ))}
          </div>

          {/* Custom Announcer */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-5 shadow-sm">
            <label htmlFor="custom-announce" className="block text-sm font-semibold text-[var(--ink-primary)]">
              សរសេរសារប្រកាសផ្ទាល់ខ្លួន (ប្រើ {'{name}'} ជំនួសឈ្មោះមិត្ត)
            </label>
            <textarea
              id="custom-announce"
              rows={2}
              value={customTemplate}
              onChange={(e) => setCustomTemplate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => runCustom(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-main)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                និយាយឱ្យ {selectedFriend || 'មិត្តដែលជ្រើស'}
              </button>
              <button
                type="button"
                onClick={() => runCustom(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-semibold text-[var(--ink-primary)] whitespace-nowrap"
              >
                <Megaphone className="h-4 w-4" />
                ប្រកាសដល់មិត្តទាំងអស់
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

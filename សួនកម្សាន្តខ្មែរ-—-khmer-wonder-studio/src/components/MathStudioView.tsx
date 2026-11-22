import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Calculator, Play, RotateCcw, Shapes, Sigma, Timer, Volume2, Zap } from 'lucide-react';
import { playSfx, speakText, type VoiceSettings } from '../utils/audio';

interface MathStudioViewProps {
  voiceSettings: VoiceSettings;
  onBurst: () => void;
}

type MathTab = 'ARITHMETIC' | 'GEOMETRY' | 'ALGEBRA' | 'BLITZ';
type BasicOp = 'add' | 'sub' | 'mul' | 'div' | 'mod' | 'pow' | 'pct' | 'discount' | 'sqrt';
type ShapeKind = 'rect' | 'triangle' | 'circle' | 'trapezoid' | 'cylinder';

// ===== Safe Recursive-Descent Math Expression Parser (No eval!) =====
function safeEvalExpression(raw: string): number {
  const expr = raw
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();
  if (!expr) throw new Error('សូមវាយកន្សោមគណិតវិទ្យា');

  let pos = 0;

  function peek(): string {
    return expr[pos] || '';
  }

  function parseExpression(): number {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = expr[pos++];
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }

  function parseTerm(): number {
    let val = parsePower();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = expr[pos++];
      const rhs = parsePower();
      if (op === '*') val *= rhs;
      else if (op === '/') {
        if (rhs === 0) throw new Error('មិនអាចចែកនឹង 0 បានទេ');
        val /= rhs;
      } else {
        if (rhs === 0) throw new Error('មិនអាចរកសំណល់នឹង 0 បានទេ');
        val %= rhs;
      }
    }
    return val;
  }

  function parsePower(): number {
    let base = parseUnary();
    if (peek() === '^') {
      pos++;
      const exp = parsePower();
      base = Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    if (peek() === '+') {
      pos++;
      return parseUnary();
    }
    if (peek() === '-') {
      pos++;
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (peek() === '(') {
      pos++;
      const val = parseExpression();
      if (peek() !== ')') throw new Error('ខ្វះវង់ក្រចកបិទ )');
      pos++;
      return val;
    }

    // Named constants & functions
    const fnMatch = expr.slice(pos).match(/^(sqrt|sin|cos|tan|abs|log|ln|pi|e)/);
    if (fnMatch) {
      const token = fnMatch[1];
      pos += token.length;
      if (token === 'pi') return Math.PI;
      if (token === 'e') return Math.E;
      if (peek() !== '(') throw new Error(`ត្រូវការវង់ក្រចកក្រោយ ${token}`);
      pos++;
      const arg = parseExpression();
      if (peek() !== ')') throw new Error('ខ្វះវង់ក្រចកបិទ )');
      pos++;
      if (token === 'sqrt') {
        if (arg < 0) throw new Error('មិនអាចរកឫសការ៉េនៃចំនួនអវិជ្ជមាន');
        return Math.sqrt(arg);
      }
      if (token === 'sin') return Math.sin((arg * Math.PI) / 180);
      if (token === 'cos') return Math.cos((arg * Math.PI) / 180);
      if (token === 'tan') return Math.tan((arg * Math.PI) / 180);
      if (token === 'abs') return Math.abs(arg);
      if (token === 'log') return Math.log10(arg);
      if (token === 'ln') return Math.log(arg);
    }

    const numMatch = expr.slice(pos).match(/^\d+(\.\d+)?/);
    if (numMatch) {
      pos += numMatch[0].length;
      return Number(numMatch[0]);
    }

    throw new Error('កន្សោមគណិតវិទ្យាមិនត្រឹមត្រូវ');
  }

  const result = parseExpression();
  if (pos < expr.length) throw new Error('មានតួអក្សរលើសក្នុងកន្សោម');
  if (!Number.isFinite(result)) throw new Error('លទ្ធផលមិនអាចកំណត់បាន');
  return result;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? n.toLocaleString('en-US') : Number(n.toFixed(4)).toString();
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function primeFactors(n: number): number[] {
  let num = Math.abs(Math.trunc(n));
  if (num < 2) return [];
  const factors: number[] = [];
  let d = 2;
  while (d * d <= num) {
    while (num % d === 0) {
      factors.push(d);
      num /= d;
    }
    d += d === 2 ? 1 : 2;
  }
  if (num > 1) factors.push(num);
  return factors;
}

function getDivisors(n: number): number[] {
  const num = Math.abs(Math.trunc(n));
  if (num < 1 || num > 100000) return [];
  const small: number[] = [];
  const large: number[] = [];
  for (let i = 1; i * i <= num; i++) {
    if (num % i === 0) {
      small.push(i);
      if (i !== num / i) large.unshift(num / i);
    }
  }
  return [...small, ...large];
}

// ===== Math Blitz Question Generator =====
type BlitzOpFilter = 'mixed' | 'add' | 'sub' | 'mul' | 'div';
interface BlitzQ {
  prompt: string;
  answer: number;
  choices: number[];
}

function generateBlitzQ(filter: BlitzOpFilter): BlitzQ {
  const ops: ('add' | 'sub' | 'mul' | 'div')[] =
    filter === 'mixed' ? ['add', 'sub', 'mul', 'div'] : [filter];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a = 0;
  let b = 0;
  let answer = 0;
  let prompt = '';

  if (op === 'add') {
    a = Math.floor(Math.random() * 45) + 5;
    b = Math.floor(Math.random() * 45) + 5;
    answer = a + b;
    prompt = `${a} + ${b}`;
  } else if (op === 'sub') {
    a = Math.floor(Math.random() * 55) + 20;
    b = Math.floor(Math.random() * (a - 3)) + 3;
    answer = a - b;
    prompt = `${a} − ${b}`;
  } else if (op === 'mul') {
    a = Math.floor(Math.random() * 11) + 2;
    b = Math.floor(Math.random() * 11) + 2;
    answer = a * b;
    prompt = `${a} × ${b}`;
  } else {
    b = Math.floor(Math.random() * 10) + 2;
    answer = Math.floor(Math.random() * 11) + 2;
    a = b * answer;
    prompt = `${a} ÷ ${b}`;
  }

  const set = new Set<number>([answer]);
  while (set.size < 4) {
    const offset = (Math.floor(Math.random() * 9) + 1) * (Math.random() < 0.5 ? 1 : -1);
    const cand = Math.max(0, answer + offset);
    if (cand !== answer) set.add(cand);
  }
  const choices = Array.from(set).sort(() => Math.random() - 0.5);
  return { prompt, answer, choices };
}

export function MathStudioView({ voiceSettings, onBurst }: MathStudioViewProps) {
  const [tab, setTab] = useState<MathTab>('ARITHMETIC');

  // Tab 1: Arithmetic & Expression
  const [op, setOp] = useState<BasicOp>('add');
  const [numA, setNumA] = useState('24');
  const [numB, setNumB] = useState('6');
  const [exprInput, setExprInput] = useState('(15 + 25) * 3 - sqrt(81)');

  // Tab 2: Geometry
  const [shape, setShape] = useState<ShapeKind>('rect');
  const [gA, setGA] = useState('12');
  const [gB, setGB] = useState('8');
  const [gC, setGC] = useState('6');

  // Tab 3: Algebra & Number Explorer
  const [qa, setQa] = useState('1');
  const [qb, setQb] = useState('-5');
  const [qc, setQc] = useState('6');
  const [analyzeN, setAnalyzeN] = useState('36');
  const [pairA, setPairA] = useState('24');
  const [pairB, setPairB] = useState('36');

  // Tab 4: Math Blitz Mini-Game
  const [blitzOp, setBlitzOp] = useState<BlitzOpFilter>('mixed');
  const [blitzRunning, setBlitzRunning] = useState(false);
  const [blitzTime, setBlitzTime] = useState(30);
  const [blitzScore, setBlitzScore] = useState(0);
  const [blitzStreak, setBlitzStreak] = useState(0);
  const [blitzQ, setBlitzQ] = useState<BlitzQ>(() => generateBlitzQ('mixed'));
  const [blitzHigh, setBlitzHigh] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('khmerMathBlitzHigh_v1') || '0');
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (!blitzRunning) return;
    if (blitzTime <= 0) {
      setBlitzRunning(false);
      playSfx('victory', voiceSettings.sfxEnabled);
      onBurst();
      return;
    }
    const t = window.setTimeout(() => setBlitzTime((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [blitzRunning, blitzTime, onBurst, voiceSettings.sfxEnabled]);

  // Basic Arithmetic Calculation
  const basicCalc = useMemo(() => {
    const a = Number(numA);
    const b = Number(numB);
    if (Number.isNaN(a) || (op !== 'sqrt' && Number.isNaN(b))) {
      return { value: '—', steps: 'សូមបញ្ចូលលេខឱ្យត្រឹមត្រូវ', speakKm: '' };
    }
    switch (op) {
      case 'add':
        return {
          value: fmt(a + b),
          steps: `${a} + ${b} = ${fmt(a + b)}`,
          speakKm: `${a} បូក ${b} ស្មើ ${fmt(a + b)}`,
        };
      case 'sub':
        return {
          value: fmt(a - b),
          steps: `${a} − ${b} = ${fmt(a - b)}`,
          speakKm: `${a} ដក ${b} ស្មើ ${fmt(a - b)}`,
        };
      case 'mul':
        return {
          value: fmt(a * b),
          steps: `${a} × ${b} = ${fmt(a * b)}`,
          speakKm: `${a} គុណ ${b} ស្មើ ${fmt(a * b)}`,
        };
      case 'div':
        if (b === 0) return { value: 'មិនអាចចែក 0', steps: 'តួចែកមិនអាចស្មើ 0 បានទេ', speakKm: '' };
        return {
          value: fmt(a / b),
          steps: `${a} ÷ ${b} = ${fmt(a / b)}${
            Number.isInteger(a) && Number.isInteger(b)
              ? ` (ផលចែកគត់ ${Math.trunc(a / b)} · សំណល់ ${a % b})`
              : ''
          }`,
          speakKm: `${a} ចែក ${b} ស្មើ ${fmt(a / b)}`,
        };
      case 'mod':
        if (b === 0) return { value: 'មិនអាចចែក 0', steps: 'តួចែកមិនអាចស្មើ 0 បានទេ', speakKm: '' };
        return {
          value: fmt(a % b),
          steps: `សំណល់នៃ ${a} ÷ ${b} គឺ ${fmt(a % b)}`,
          speakKm: `សំណល់នៃ ${a} ចែក ${b} ស្មើ ${fmt(a % b)}`,
        };
      case 'pow':
        return {
          value: fmt(Math.pow(a, b)),
          steps: `${a}^${b} = ${fmt(Math.pow(a, b))}`,
          speakKm: `${a} ស្វ័យគុណ ${b} ស្មើ ${fmt(Math.pow(a, b))}`,
        };
      case 'sqrt':
        if (a < 0) return { value: 'មិនមានឫសពិត', steps: 'សូមបញ្ចូលលេខធំជាង ឬស្មើ 0', speakKm: '' };
        return {
          value: fmt(Math.sqrt(a)),
          steps: `√${a} = ${fmt(Math.sqrt(a))}`,
          speakKm: `ឫសការ៉េនៃ ${a} ស្មើ ${fmt(Math.sqrt(a))}`,
        };
      case 'pct':
        return {
          value: fmt((a / 100) * b),
          steps: `${a}% នៃ ${b} = (${a} ÷ 100) × ${b} = ${fmt((a / 100) * b)}`,
          speakKm: `${a} ភាគរយនៃ ${b} ស្មើ ${fmt((a / 100) * b)}`,
        };
      case 'discount': {
        const off = (a * b) / 100;
        const finalPrice = a - off;
        return {
          value: fmt(finalPrice),
          steps: `តម្លៃដើម ${a} បញ្ចុះ ${b}% (ចុះ ${fmt(off)}) → នៅសល់ ${fmt(finalPrice)}`,
          speakKm: `បញ្ចុះតម្លៃ ${b} ភាគរយ នៅសល់ ${fmt(finalPrice)}`,
        };
      }
    }
  }, [op, numA, numB]);

  // Compound Expression Evaluator
  const exprResult = useMemo(() => {
    try {
      const val = safeEvalExpression(exprInput);
      return { ok: true, text: fmt(val) };
    } catch (err) {
      return { ok: false, text: err instanceof Error ? err.message : 'កន្សោមមិនត្រឹមត្រូវ' };
    }
  }, [exprInput]);

  // Geometry Calculations
  const geoCalc = useMemo(() => {
    const a = Number(gA);
    const b = Number(gB);
    const c = Number(gC);
    if (Number.isNaN(a) || a <= 0) {
      return { primaryLabel: 'លទ្ធផល', primary: '—', secondaryLabel: '', secondary: '', formula: 'សូមបញ្ចូលតម្លៃវិជ្ជមាន' };
    }
    if (shape === 'rect') {
      const area = a * b;
      const perim = 2 * (a + b);
      return {
        primaryLabel: 'ផ្ទៃក្រឡា (Area)',
        primary: fmt(area),
        secondaryLabel: 'បរិមាត្រ (Perimeter)',
        secondary: fmt(perim),
        formula: `S = ${a} × ${b} = ${fmt(area)} · P = 2 × (${a} + ${b}) = ${fmt(perim)}`,
      };
    }
    if (shape === 'triangle') {
      const area = (a * b) / 2;
      return {
        primaryLabel: 'ផ្ទៃក្រឡាត្រីកោណ',
        primary: fmt(area),
        secondaryLabel: 'រូបមន្ត',
        secondary: '½ × បាត × កម្ពស់',
        formula: `S = (${a} × ${b}) ÷ 2 = ${fmt(area)}`,
      };
    }
    if (shape === 'circle') {
      const area = Math.PI * a * a;
      const circ = 2 * Math.PI * a;
      return {
        primaryLabel: 'ផ្ទៃក្រឡារង្វង់ (πr²)',
        primary: fmt(area),
        secondaryLabel: 'បរិមាត្រ (2πr)',
        secondary: fmt(circ),
        formula: `កាំ r = ${a} · អង្កត់ផ្ចិត d = ${fmt(a * 2)}`,
      };
    }
    if (shape === 'trapezoid') {
      const area = ((a + b) * c) / 2;
      return {
        primaryLabel: 'ផ្ទៃក្រឡាចតុកោណព្នាយ',
        primary: fmt(area),
        secondaryLabel: 'រូបមន្ត',
        secondary: '½ × (បាតធំ + បាតតូច) × កម្ពស់',
        formula: `S = ((${a} + ${b}) × ${c}) ÷ 2 = ${fmt(area)}`,
      };
    }
    const vol = Math.PI * a * a * b;
    const surf = 2 * Math.PI * a * (a + b);
    return {
      primaryLabel: 'មាឌស៊ីឡាំង (πr²h)',
      primary: fmt(vol),
      secondaryLabel: 'ផ្ទៃក្រឡាសរុប',
      secondary: fmt(surf),
      formula: `កាំ r = ${a} · កម្ពស់ h = ${b}`,
    };
  }, [shape, gA, gB, gC]);

  // Quadratic Solver
  const quadCalc = useMemo(() => {
    const a = Number(qa);
    const b = Number(qb);
    const c = Number(qc);
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) {
      return { summary: 'សូមបញ្ចូលមេគុណ a, b, c', steps: [] as string[] };
    }
    if (a === 0) {
      if (b === 0) return { summary: 'មិនមែនជាសមីការទេ (a = 0, b = 0)', steps: [] };
      const x = -c / b;
      return {
        summary: `សមីការដឺក្រេទី១៖ x = ${fmt(x)}`,
        steps: [`${b}x + ${c} = 0`, `x = ${fmt(-c)} ÷ ${b} = ${fmt(x)}`],
      };
    }
    const delta = b * b - 4 * a * c;
    const steps = [`Δ = b² − 4ac = (${b})² − 4(${a})(${c}) = ${fmt(delta)}`];
    if (delta > 0) {
      const x1 = (-b + Math.sqrt(delta)) / (2 * a);
      const x2 = (-b - Math.sqrt(delta)) / (2 * a);
      steps.push(`Δ > 0 → មានឫសពិត ២ ផ្សេងគ្នា`);
      steps.push(`x₁ = (${-b} + √${fmt(delta)}) ÷ ${2 * a} = ${fmt(x1)}`);
      steps.push(`x₂ = (${-b} − √${fmt(delta)}) ÷ ${2 * a} = ${fmt(x2)}`);
      return { summary: `x₁ = ${fmt(x1)}  ·  x₂ = ${fmt(x2)}`, steps };
    }
    if (delta === 0) {
      const x = -b / (2 * a);
      steps.push(`Δ = 0 → មានឫសឌុបតែមួយ`);
      steps.push(`x = ${-b} ÷ ${2 * a} = ${fmt(x)}`);
      return { summary: `x₁ = x₂ = ${fmt(x)}`, steps };
    }
    const real = -b / (2 * a);
    const imag = Math.sqrt(-delta) / (2 * a);
    steps.push(`Δ < 0 → គ្មានឫសពិត (មានឫសកុំផ្លិច)`);
    return { summary: `x = ${fmt(real)} ± ${fmt(Math.abs(imag))}i`, steps };
  }, [qa, qb, qc]);

  // Number Analyzer
  const numAnalysis = useMemo(() => {
    const n = Math.trunc(Number(analyzeN));
    if (Number.isNaN(n) || n < 1 || n > 100000) {
      return null;
    }
    const factors = primeFactors(n);
    const isPrime = factors.length === 1 && factors[0] === n;
    const divisors = getDivisors(n);
    let factText = 'ធំពេក (> 20!)';
    if (n <= 20) {
      let f = 1;
      for (let i = 2; i <= n; i++) f *= i;
      factText = f.toLocaleString('en-US');
    }
    return { n, isPrime, factors, divisors, factText };
  }, [analyzeN]);

  const gcdLcm = useMemo(() => {
    const x = Math.abs(Math.trunc(Number(pairA)));
    const y = Math.abs(Math.trunc(Number(pairB)));
    if (!x || !y) return null;
    const g = gcd(x, y);
    const l = (x * y) / g;
    return { g, l };
  }, [pairA, pairB]);

  // Blitz Controls
  const startBlitz = () => {
    setBlitzScore(0);
    setBlitzStreak(0);
    setBlitzTime(30);
    setBlitzQ(generateBlitzQ(blitzOp));
    setBlitzRunning(true);
    playSfx('click', voiceSettings.sfxEnabled);
  };

  const answerBlitz = (choice: number) => {
    if (!blitzRunning) return;
    if (choice === blitzQ.answer) {
      const nextStreak = blitzStreak + 1;
      const pts = 10 + (nextStreak >= 3 ? 5 : 0);
      const nextScore = blitzScore + pts;
      setBlitzStreak(nextStreak);
      setBlitzScore(nextScore);
      if (nextScore > blitzHigh) {
        setBlitzHigh(nextScore);
        try {
          localStorage.setItem('khmerMathBlitzHigh_v1', String(nextScore));
        } catch {
          // ignore
        }
      }
      playSfx('success', voiceSettings.sfxEnabled);
    } else {
      setBlitzStreak(0);
      playSfx('error', voiceSettings.sfxEnabled);
    }
    setBlitzQ(generateBlitzQ(blitzOp));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--accent-main)]">
            មន្ទីរពិសោធន៍គណិតវិទ្យាគ្រប់ប្រភេទ · មានជំហានពន្យល់ និងសំឡេងអាន
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            គណនាគណិតវិទ្យា និងល្បងប្រាជ្ញាលេខ
          </h1>
        </div>

        {/* Segmented Category Switcher */}
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-[var(--surface-subtle)] p-1">
          {[
            { id: 'ARITHMETIC' as const, label: 'បូក ដក គុណ ចែក', icon: Calculator },
            { id: 'GEOMETRY' as const, label: 'ធរណីមាត្រ', icon: Shapes },
            { id: 'ALGEBRA' as const, label: 'សមីការ & វិភាគលេខ', icon: Sigma },
            { id: 'BLITZ' as const, label: 'ល្បងប្រាជ្ញា ៣០វិ', icon: Zap },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  playSfx('click', voiceSettings.sfxEnabled);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  tab === t.id
                    ? 'bg-[var(--surface-elevated)] text-[var(--ink-primary)] shadow-sm'
                    : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: ARITHMETIC & EXPRESSION */}
      {tab === 'ARITHMETIC' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-7">
            <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
              ជ្រើសប្រមាណវិធីគណិតវិទ្យា
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { id: 'add' as const, label: '+ បូក' },
                { id: 'sub' as const, label: '− ដក' },
                { id: 'mul' as const, label: '× គុណ' },
                { id: 'div' as const, label: '÷ ចែក' },
                { id: 'mod' as const, label: '% សំណល់' },
                { id: 'pow' as const, label: 'aᵇ ស្វ័យគុណ' },
                { id: 'sqrt' as const, label: '√ ឫសការ៉េ' },
                { id: 'pct' as const, label: 'ភាគរយ (%)' },
                { id: 'discount' as const, label: 'បញ្ចុះតម្លៃ (%)' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setOp(item.id);
                    playSfx('click', voiceSettings.sfxEnabled);
                  }}
                  className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                    op === item.id
                      ? 'border-[var(--accent-main)] bg-[var(--accent-main)] text-[var(--accent-ink)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] hover:border-[var(--accent-main)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)]">
                  {op === 'pct'
                    ? 'ភាគរយ (%)'
                    : op === 'discount'
                      ? 'តម្លៃដើម'
                      : op === 'sqrt'
                        ? 'ចំនួនត្រូវរកឫស'
                        : 'លេខទីមួយ (a)'}
                </label>
                <input
                  type="number"
                  value={numA}
                  onChange={(e) => setNumA(e.target.value)}
                  className="font-mono-num mt-1.5 min-h-[46px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-4 text-lg font-semibold text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
                />
              </div>

              {op !== 'sqrt' && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-secondary)]">
                    {op === 'pct'
                      ? 'នៃចំនួនសរុប'
                      : op === 'discount'
                        ? 'បញ្ចុះប៉ុន្មាន (%)'
                        : op === 'pow'
                          ? 'និទស្សន្ត (b)'
                          : 'លេខទីពីរ (b)'}
                  </label>
                  <input
                    type="number"
                    value={numB}
                    onChange={(e) => setNumB(e.target.value)}
                    className="font-mono-num mt-1.5 min-h-[46px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-4 text-lg font-semibold text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[var(--surface-subtle)] p-5">
              <div>
                <p className="text-xs font-medium text-[var(--ink-secondary)]">លទ្ធផល</p>
                <p className="font-mono-num mt-1 text-3xl font-bold text-[var(--accent-main)]">
                  {basicCalc.value}
                </p>
                <p className="font-mono-num mt-1 text-xs text-[var(--ink-secondary)]">
                  {basicCalc.steps}
                </p>
              </div>
              {basicCalc.speakKm && (
                <button
                  type="button"
                  onClick={() => speakText(basicCalc.speakKm, voiceSettings, { lang: 'km-KH' })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[var(--ink-primary)] whitespace-nowrap shrink-0"
                >
                  <Volume2 className="h-4 w-4" />
                  អានលទ្ធផល
                </button>
              )}
            </div>
          </div>

          {/* Compound Expression Calculator */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-5">
            <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
              គណនាកន្សោមគណិតវិទ្យាទំនើប
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
              គាំទ្រ <code className="font-mono-num">+ - * / ^ ( ) sqrt() sin() cos() tan() log() pi</code>
            </p>
            <input
              type="text"
              value={exprInput}
              onChange={(e) => setExprInput(e.target.value)}
              placeholder="(12 + 8) * 5 / 2"
              className="font-mono-num mt-3 min-h-[48px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 text-base font-semibold text-[var(--ink-primary)] focus:border-[var(--accent-main)] focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                '(25 + 15) * 4',
                'sqrt(144) + 2^5',
                'sin(30) + cos(60)',
                'pi * 10^2',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setExprInput(sample)}
                  className="font-mono-num rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs text-[var(--ink-secondary)] hover:border-[var(--accent-main)] hover:text-[var(--ink-primary)]"
                >
                  {sample}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-xl bg-[var(--surface-subtle)] p-4">
              <p className="text-xs text-[var(--ink-secondary)]">តម្លៃកន្សោម</p>
              <p
                className={`font-mono-num mt-1 text-2xl font-bold ${
                  exprResult.ok ? 'text-[var(--ink-primary)]' : 'text-rose-600 text-sm'
                }`}
              >
                {exprResult.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VISUAL GEOMETRY */}
      {tab === 'GEOMETRY' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-7">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'rect' as const, label: 'ចតុកោណកែង' },
                { id: 'triangle' as const, label: 'ត្រីកោណ' },
                { id: 'circle' as const, label: 'រង្វង់' },
                { id: 'trapezoid' as const, label: 'ចតុកោណព្នាយ' },
                { id: 'cylinder' as const, label: 'ស៊ីឡាំង (មាឌ)' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShape(s.id)}
                  className={`rounded-lg border px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${
                    shape === s.id
                      ? 'border-[var(--accent-main)] bg-[var(--accent-main)] text-[var(--accent-ink)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)]">
                  {shape === 'circle' || shape === 'cylinder'
                    ? 'កាំ (r)'
                    : shape === 'triangle'
                      ? 'បាត (b)'
                      : shape === 'trapezoid'
                        ? 'បាតធំ (a)'
                        : 'បណ្ដោយ (L)'}
                </label>
                <input
                  type="number"
                  min={0.1}
                  value={gA}
                  onChange={(e) => setGA(e.target.value)}
                  className="font-mono-num mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3.5 text-base font-semibold"
                />
              </div>

              {shape !== 'circle' && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-secondary)]">
                    {shape === 'triangle' || shape === 'cylinder'
                      ? 'កម្ពស់ (h)'
                      : shape === 'trapezoid'
                        ? 'បាតតូច (b)'
                        : 'ទទឹង (W)'}
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    value={gB}
                    onChange={(e) => setGB(e.target.value)}
                    className="font-mono-num mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3.5 text-base font-semibold"
                  />
                </div>
              )}

              {shape === 'trapezoid' && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-secondary)]">
                    កម្ពស់ (h)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    value={gC}
                    onChange={(e) => setGC(e.target.value)}
                    className="font-mono-num mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3.5 text-base font-semibold"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 rounded-xl bg-[var(--surface-subtle)] p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--ink-secondary)]">{geoCalc.primaryLabel}</p>
                <p className="font-mono-num mt-1 text-3xl font-bold text-[var(--accent-main)]">
                  {geoCalc.primary}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--ink-secondary)]">{geoCalc.secondaryLabel}</p>
                <p className="font-mono-num mt-1 text-xl font-bold text-[var(--ink-primary)]">
                  {geoCalc.secondary}
                </p>
              </div>
              <p className="font-mono-num text-xs text-[var(--ink-secondary)] sm:col-span-2">
                {geoCalc.formula}
              </p>
            </div>
          </div>

          {/* Live Dynamic SVG Shape Blueprint */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-5">
            <svg viewBox="0 0 260 190" className="h-48 w-full max-w-[280px]">
              {shape === 'rect' && (
                <g>
                  <rect
                    x="40"
                    y="35"
                    width="180"
                    height="110"
                    rx="6"
                    fill="var(--accent-soft)"
                    stroke="var(--accent-main)"
                    strokeWidth="2.5"
                  />
                  <text x="130" y="25" textAnchor="middle" fill="var(--ink-primary)" fontSize="13" fontWeight="700">
                    L = {gA}
                  </text>
                  <text x="235" y="94" textAnchor="middle" fill="var(--ink-primary)" fontSize="13" fontWeight="700">
                    W = {gB}
                  </text>
                </g>
              )}
              {shape === 'triangle' && (
                <g>
                  <polygon
                    points="40,155 220,155 130,35"
                    fill="var(--accent-soft)"
                    stroke="var(--accent-main)"
                    strokeWidth="2.5"
                  />
                  <line x1="130" y1="35" x2="130" y2="155" stroke="var(--accent-main)" strokeDasharray="4 4" />
                  <text x="130" y="176" textAnchor="middle" fill="var(--ink-primary)" fontSize="13" fontWeight="700">
                    b = {gA}
                  </text>
                  <text x="150" y="102" fill="var(--ink-primary)" fontSize="13" fontWeight="700">
                    h = {gB}
                  </text>
                </g>
              )}
              {shape === 'circle' && (
                <g>
                  <circle
                    cx="130"
                    cy="95"
                    r="66"
                    fill="var(--accent-soft)"
                    stroke="var(--accent-main)"
                    strokeWidth="2.5"
                  />
                  <line x1="130" y1="95" x2="196" y2="95" stroke="var(--accent-main)" strokeWidth="2" />
                  <circle cx="130" cy="95" r="3.5" fill="var(--accent-main)" />
                  <text x="163" y="85" textAnchor="middle" fill="var(--ink-primary)" fontSize="13" fontWeight="700">
                    r = {gA}
                  </text>
                </g>
              )}
              {shape === 'trapezoid' && (
                <g>
                  <polygon
                    points="35,150 225,150 185,45 75,45"
                    fill="var(--accent-soft)"
                    stroke="var(--accent-main)"
                    strokeWidth="2.5"
                  />
                  <line x1="100" y1="45" x2="100" y2="150" stroke="var(--accent-main)" strokeDasharray="4 4" />
                  <text x="130" y="34" textAnchor="middle" fill="var(--ink-primary)" fontSize="12" fontWeight="700">
                    b = {gB}
                  </text>
                  <text x="130" y="172" textAnchor="middle" fill="var(--ink-primary)" fontSize="12" fontWeight="700">
                    a = {gA}
                  </text>
                  <text x="120" y="104" fill="var(--ink-primary)" fontSize="12" fontWeight="700">
                    h = {gC}
                  </text>
                </g>
              )}
              {shape === 'cylinder' && (
                <g>
                  <ellipse cx="130" cy="44" rx="58" ry="18" fill="var(--accent-soft)" stroke="var(--accent-main)" strokeWidth="2.5" />
                  <path
                    d="M72 44 L72 142 A58 18 0 0 0 188 142 L188 44"
                    fill="var(--accent-soft)"
                    stroke="var(--accent-main)"
                    strokeWidth="2.5"
                  />
                  <line x1="130" y1="44" x2="188" y2="44" stroke="var(--accent-main)" strokeWidth="2" />
                  <text x="158" y="38" textAnchor="middle" fill="var(--ink-primary)" fontSize="12" fontWeight="700">
                    r = {gA}
                  </text>
                  <text x="212" y="98" textAnchor="middle" fill="var(--ink-primary)" fontSize="12" fontWeight="700">
                    h = {gB}
                  </text>
                </g>
              )}
            </svg>
            <p className="mt-2 text-xs text-[var(--ink-secondary)]">រូបភាពធរណីមាត្របង្ហាញវិមាត្រផ្ទាល់</p>
          </div>
        </div>
      )}

      {/* TAB 3: ALGEBRA & NUMBER EXPLORER */}
      {tab === 'ALGEBRA' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Quadratic Equation Solver */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-6">
            <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
              ដោះស្រាយសមីការដឺក្រេទី២ (ax² + bx + c = 0)
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'a', val: qa, set: setQa },
                { label: 'b', val: qb, set: setQb },
                { label: 'c', val: qc, set: setQc },
              ].map((f) => (
                <div key={f.label}>
                  <label className="font-mono-num block text-xs font-semibold text-[var(--ink-secondary)]">
                    មេគុណ {f.label}
                  </label>
                  <input
                    type="number"
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    className="font-mono-num mt-1 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 text-base font-semibold"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-[var(--surface-subtle)] p-4">
              <p className="font-mono-num text-lg font-bold text-[var(--accent-main)]">
                {quadCalc.summary}
              </p>
              <div className="mt-2 space-y-1">
                {quadCalc.steps.map((s) => (
                  <p key={s} className="font-mono-num text-xs text-[var(--ink-secondary)]">
                    {s}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Number Theory Explorer */}
          <div className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm lg:col-span-6">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
                វិភាគចំនួនគត់ (បឋម · កត្តាបឋម · ហ្វាក់តូរីយ៉ែល)
              </h2>
              <input
                type="number"
                min={1}
                max={100000}
                value={analyzeN}
                onChange={(e) => setAnalyzeN(e.target.value)}
                className="font-mono-num mt-2 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3.5 text-base font-semibold"
              />
              {numAnalysis && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-[var(--surface-subtle)] p-4 text-xs">
                  <p className="font-semibold text-[var(--ink-primary)]">
                    ប្រភេទ៖{' '}
                    <span className="text-[var(--accent-main)]">
                      {numAnalysis.n === 1
                        ? 'លេខ ១ (ឯកតា)'
                        : numAnalysis.isPrime
                          ? 'ចំនួនបឋម (Prime)'
                          : 'ចំនួនផ្សំ (Composite)'}
                    </span>
                  </p>
                  <p className="font-mono-num text-[var(--ink-secondary)]">
                    កត្តាបឋម៖ {numAnalysis.factors.length ? numAnalysis.factors.join(' × ') : '—'}
                  </p>
                  <p className="font-mono-num text-[var(--ink-secondary)]">
                    តួចែក ({numAnalysis.divisors.length})៖{' '}
                    {numAnalysis.divisors.slice(0, 14).join(', ')}
                    {numAnalysis.divisors.length > 14 ? ' ...' : ''}
                  </p>
                  <p className="font-mono-num text-[var(--ink-secondary)]">
                    ហ្វាក់តូរីយ៉ែល ({numAnalysis.n}!)៖ {numAnalysis.factText}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-[var(--border-hairline)] pt-4">
              <p className="text-sm font-bold text-[var(--ink-primary)]">
                រក តួចែករួមធំបំផុត (GCD) និង ពហុគុណរួមតូចបំផុត (LCM)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={1}
                  value={pairA}
                  onChange={(e) => setPairA(e.target.value)}
                  className="font-mono-num min-h-[42px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 text-sm font-semibold"
                />
                <input
                  type="number"
                  min={1}
                  value={pairB}
                  onChange={(e) => setPairB(e.target.value)}
                  className="font-mono-num min-h-[42px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] px-3 text-sm font-semibold"
                />
              </div>
              {gcdLcm && (
                <p className="font-mono-num mt-2 text-xs font-semibold text-[var(--ink-secondary)]">
                  GCD = <span className="text-[var(--accent-main)]">{gcdLcm.g}</span> · LCM ={' '}
                  <span className="text-[var(--ink-primary)]">{gcdLcm.l}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MATH BLITZ MINI-GAME */}
      {tab === 'BLITZ' && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'mixed' as const, label: 'ចម្រុះ' },
                { id: 'add' as const, label: '+' },
                { id: 'sub' as const, label: '−' },
                { id: 'mul' as const, label: '×' },
                { id: 'div' as const, label: '÷' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={blitzRunning}
                  onClick={() => {
                    setBlitzOp(m.id);
                    setBlitzQ(generateBlitzQ(m.id));
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    blitzOp === m.id
                      ? 'border-[var(--accent-main)] bg-[var(--accent-main)] text-[var(--accent-ink)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="font-mono-num flex items-center gap-4 text-sm font-bold">
              <span className="inline-flex items-center gap-1 text-[var(--accent-main)]">
                <Timer className="h-4 w-4" />
                {blitzTime}s
              </span>
              <span>ពិន្ទុ {blitzScore}</span>
              <span className="text-xs font-medium text-[var(--ink-secondary)]">
                កំណត់ត្រា {blitzHigh}
              </span>
            </div>
          </div>

          {!blitzRunning ? (
            <div className="py-10 text-center">
              <p className="font-display text-2xl font-bold text-[var(--ink-primary)]">
                {blitzTime === 0
                  ? `អស់ពេលហើយ! អ្នករកបាន ${blitzScore} ពិន្ទុ`
                  : 'ប្រកួតគិតលេខលឿនក្នុង ៣០ វិនាទី'}
              </p>
              <p className="mt-2 text-sm text-[var(--ink-secondary)]">
                ឆ្លើយត្រូវជាប់ៗគ្នា ៣ ដង ទទួលបានពិន្ទុបន្ថែម Combo!
              </p>
              <button
                type="button"
                onClick={startBlitz}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-main)] px-6 py-3 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
              >
                {blitzTime === 0 ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {blitzTime === 0 ? 'លេងម្ដងទៀត' : 'ចាប់ផ្ដើមប្រកួត'}
              </button>
            </div>
          ) : (
            <div className="pt-6 text-center">
              <motion.p
                key={blitzQ.prompt}
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-mono-num text-5xl font-bold text-[var(--ink-primary)]"
              >
                {blitzQ.prompt} = ?
              </motion.p>
              {blitzStreak >= 2 && (
                <p className="mt-2 text-xs font-semibold text-amber-600">
                  Combo ជាប់គ្នា x{blitzStreak} 🔥
                </p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                {blitzQ.choices.map((c) => (
                  <motion.button
                    key={c}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => answerBlitz(c)}
                    className="font-mono-num min-h-[58px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-2xl font-bold text-[var(--ink-primary)] hover:border-[var(--accent-main)] hover:bg-[var(--accent-soft)]"
                  >
                    {c}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

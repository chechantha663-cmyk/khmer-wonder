import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vrot: number;
  color: string;
  life: number;
}

const COLORS = ['#ea580c', '#f59e0b', '#059669', '#0284c7', '#e11d48', '#7c3aed', '#fbbf24'];

export function ConfettiCanvas({ burstKey, enabled }: { burstKey: number; enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!burstKey || !enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.36;
    for (let i = 0; i < 85; i++) {
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 240,
        y: cy + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 13 - 4,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.35,
        color: COLORS[i % COLORS.length],
        life: 0,
      });
    }

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const list = particlesRef.current;
      for (const p of list) {
        p.vy += 0.34;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.life++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - p.life / 105);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      particlesRef.current = list.filter((p) => p.life < 105 && p.y < canvas.height + 24);
      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [burstKey, enabled]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type Props = { value: number; durationMs?: number; className?: string };

export function AnimatedNumber({ value, durationMs = 450, className }: Props) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const startRef = useRef<{ from: number; to: number; t0: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const from = display;
    if (from === value) return;
    startRef.current = { from, to: value, t0: performance.now() };
    const tick = (now: number) => {
      const s = startRef.current;
      if (!s) return;
      const t = Math.min(1, (now - s.t0) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(s.from + (s.to - s.from) * eased);
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, reduce]);

  return (
    <motion.span
      key={value === 0 ? 'zero' : 'live'}
      className={className}
      animate={reduce ? undefined : value > 0 ? { scale: [1, 1.18, 1], color: ['#ffffff', '#9bbcff', '#ffffff'] } : undefined}
      transition={{ duration: 0.35 }}
    >
      {display.toLocaleString()}
    </motion.span>
  );
}

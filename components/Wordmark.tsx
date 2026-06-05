'use client';

import { motion, useReducedMotion } from 'motion/react';

export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const reduce = useReducedMotion();
  const cls =
    size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  return (
    <h1 className={`relative inline-flex select-none items-baseline font-bold tracking-tight ${cls}`}>
      <span className="text-white drop-shadow-[0_0_18px_rgba(0,82,255,0.45)]">Base</span>
      <span className="relative ml-[1px] inline-block overflow-hidden text-[#0052FF]">
        <span className="relative z-10">shooter</span>
        {!reduce ? (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              background:
                'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.85) 50%, transparent 65%)',
              mixBlendMode: 'screen',
            }}
            initial={{ x: '-120%' }}
            animate={{ x: '130%' }}
            transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
          />
        ) : null}
      </span>
    </h1>
  );
}

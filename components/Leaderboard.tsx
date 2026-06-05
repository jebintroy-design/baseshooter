'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAccount } from 'wagmi';

type Row = { address: string; score: number };
type Board = { 1: Row[]; 2: Row[]; 3: Row[]; error?: string };
type Mode = 1 | 2 | 3;

const MODE_LABELS: Record<Mode, string> = {
  1: 'Mode 1 · Easy',
  2: 'Mode 2 · Medium',
  3: 'Mode 3 · Hard',
};

const PAGE_SIZE = 10;

// TODO: resolve 0x addresses to Basenames here once a resolver hook is wired in.
function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const MEDAL: Record<number, { ring: string; bg: string; label: string }> = {
  0: { ring: 'ring-[#FFD15C]/70', bg: 'bg-[#FFD15C]/10', label: 'text-[#FFD15C]' },
  1: { ring: 'ring-[#D8DCE6]/60', bg: 'bg-[#D8DCE6]/10', label: 'text-[#D8DCE6]' },
  2: { ring: 'ring-[#E89557]/60', bg: 'bg-[#E89557]/10', label: 'text-[#E89557]' },
};

export function Leaderboard() {
  const { address } = useAccount();
  const reduce = useReducedMotion();
  const [board, setBoard] = useState<Board | null>(null);
  const [mode, setMode] = useState<Mode>(1);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data: Board) => {
        if (cancelled) return;
        if (data.error) setError('Could not load latest scores.');
        setBoard(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load latest scores.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset to first page whenever the tab changes.
  useEffect(() => {
    setPage(0);
  }, [mode]);

  const allRows = board?.[mode] ?? [];
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const startIdx = safePage * PAGE_SIZE;
  const visibleRows = useMemo(
    () => allRows.slice(startIdx, startIdx + PAGE_SIZE),
    [allRows, startIdx],
  );
  const me = address?.toLowerCase();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-white drop-shadow-[0_0_18px_rgba(0,82,255,0.45)]">
          Leaderboard
        </h2>
        <span className="text-xs text-zinc-500">top {allRows.length} on Base</span>
      </div>

      <div className="relative inline-flex w-fit gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-sm">
        {([1, 2, 3] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`relative z-10 rounded-full px-3 py-1.5 transition ${
              m === mode ? 'text-white' : 'text-zinc-300 hover:text-white'
            }`}
          >
            {m === mode ? (
              <motion.span
                layoutId="lb-tab-pill"
                className="absolute inset-0 -z-10 rounded-full bg-[#0052FF] shadow-[0_0_22px_-6px_#0052FF]"
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            ) : null}
            <span className="relative">{MODE_LABELS[m]}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md">
        <div className="grid grid-cols-[60px_1fr_120px] gap-2 border-b border-white/5 bg-white/5 px-4 py-2 text-xs uppercase tracking-wider text-zinc-400">
          <div>Rank</div>
          <div>Player</div>
          <div className="text-right">Score</div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`lb-${mode}-${safePage}-${loading ? 'l' : 'r'}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {loading ? (
              <div className="px-4 py-8 text-center text-zinc-400">Loading...</div>
            ) : visibleRows.length === 0 ? (
              <div className="px-4 py-8 text-center text-zinc-400">
                No scores yet for {MODE_LABELS[mode]}.
              </div>
            ) : (
              <motion.ul
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: reduce ? 0 : 0.025 } },
                }}
              >
                {visibleRows.map((row, i) => {
                  const rank = startIdx + i;
                  const mine = !!me && row.address.toLowerCase() === me;
                  const medal = MEDAL[rank];
                  return (
                    <motion.li
                      key={row.address}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        show: {
                          opacity: 1,
                          y: 0,
                          transition: { type: 'spring', stiffness: 360, damping: 26 },
                        },
                      }}
                      className={`relative grid grid-cols-[60px_1fr_120px] items-center gap-2 px-4 py-2 text-sm ${
                        i % 2 ? 'bg-white/[0.02]' : ''
                      }`}
                    >
                      {mine && !reduce ? (
                        <motion.span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-md"
                          style={{
                            background:
                              'linear-gradient(90deg, rgba(0,82,255,0) 0%, rgba(0,82,255,0.18) 50%, rgba(0,82,255,0) 100%)',
                          }}
                          animate={{ opacity: [0.4, 0.9, 0.4] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      ) : null}
                      <div className="relative flex items-center">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs ${
                            medal
                              ? `${medal.bg} ${medal.label} ring-1 ${medal.ring}`
                              : 'bg-white/5 text-zinc-400'
                          }`}
                        >
                          {rank + 1}
                        </span>
                      </div>
                      <div className="relative font-mono text-zinc-200">
                        {truncate(row.address)}
                        {mine ? (
                          <span className="ml-2 rounded-full bg-[#0052FF]/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#9bbcff]">
                            you
                          </span>
                        ) : null}
                      </div>
                      <div className="relative text-right font-mono font-semibold text-white">
                        {row.score.toLocaleString()}
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </motion.div>
        </AnimatePresence>

        {!loading && allRows.length > 0 ? (
          <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
            <motion.button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              whileHover={reduce || safePage === 0 ? undefined : { scale: 1.03, y: -1 }}
              whileTap={reduce || safePage === 0 ? undefined : { scale: 0.96 }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </motion.button>
            <span className="font-mono text-zinc-400">
              Page {safePage + 1} of {totalPages}
            </span>
            <motion.button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              whileHover={
                reduce || safePage >= totalPages - 1 ? undefined : { scale: 1.03, y: -1 }
              }
              whileTap={reduce || safePage >= totalPages - 1 ? undefined : { scale: 0.96 }}
              className="rounded-full border border-[#0052FF]/40 bg-[#0052FF]/15 px-3 py-1.5 font-semibold text-[#9bbcff] transition hover:bg-[#0052FF]/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </motion.button>
          </div>
        ) : null}
      </div>

      {error ? <div className="text-xs text-zinc-400">{error}</div> : null}
    </section>
  );
}

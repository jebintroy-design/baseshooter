'use client';

import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

function truncate(address: string, short = false) {
  return short
    ? `${address.slice(0, 4)}...${address.slice(-3)}`
    : `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectWallet() {
  const { address, isConnected, isReconnecting } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const reduce = useReducedMotion();

  if (isReconnecting) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#9bbcff]" />
        Reconnecting...
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <motion.div
        whileHover={reduce ? undefined : { y: -1, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="inline-flex max-w-full shrink items-center gap-1.5 rounded-full border border-[#0052FF]/40 bg-[#0052FF]/10 px-2.5 py-1 text-xs shadow-[0_4px_18px_-8px_rgba(0,82,255,0.6)] sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
      >
        <span className="relative inline-flex h-2 w-2 shrink-0">
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#3effa2]"
            animate={reduce ? undefined : { scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="relative inline-block h-2 w-2 rounded-full bg-[#3effa2]" />
        </span>
        <span className="hidden font-mono text-[#cbd9ff] sm:inline">{truncate(address)}</span>
        <span className="font-mono text-[#cbd9ff] sm:hidden">{truncate(address, true)}</span>
        <button
          onClick={() => disconnect()}
          aria-label="Disconnect"
          className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white transition hover:bg-white/20 active:scale-95 sm:px-3 sm:text-xs"
        >
          <span className="hidden sm:inline">Disconnect</span>
          <span aria-hidden className="sm:hidden">×</span>
        </button>
      </motion.div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <motion.button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending || !connectors[0]}
        whileHover={reduce ? undefined : { y: -1, scale: 1.03 }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className="relative overflow-hidden rounded-full bg-[#0052FF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_-6px_#0052FF] transition disabled:opacity-60"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isPending ? 'p' : 'r'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="inline-block"
          >
            {isPending ? 'Connecting...' : 'Sign in with Base'}
          </motion.span>
        </AnimatePresence>
        {!reduce ? (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
            }}
            initial={{ x: '-120%' }}
            animate={{ x: '120%' }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          />
        ) : null}
      </motion.button>
      {error ? (
        <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
          Could not connect. Try again.
        </span>
      ) : null}
    </div>
  );
}

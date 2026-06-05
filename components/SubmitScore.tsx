'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LEADERBOARD_ADDRESS, LEADERBOARD_CHAIN_ID, leaderboardAbi } from '@/config/contract';
import { ConnectWallet } from './ConnectWallet';

type Props = {
  mode: number;
  score: number;
  knivesLanded: number;
  won: boolean;
};

function isUserRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: unknown; cause?: { name?: string; code?: unknown } };
  if (typeof e.name === 'string' && e.name.includes('UserRejected')) return true;
  if (e.code === 4001) return true;
  if (e.cause && typeof e.cause === 'object') {
    if (typeof e.cause.name === 'string' && e.cause.name.includes('UserRejected')) return true;
    if (e.cause.code === 4001) return true;
  }
  return false;
}

export function SubmitScore({ mode, score, knivesLanded, won }: Props) {
  const reduce = useReducedMotion();
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    reset();
    setShowDetails(false);
  }, [mode, score, knivesLanded, won, reset]);

  const cleanError = useMemo(() => {
    const err = writeError ?? receiptError;
    if (!err) return null;
    if (isUserRejection(err)) {
      return { kind: 'user' as const, msg: 'Submission cancelled. Hit submit when you are ready.' };
    }
    return {
      kind: 'other' as const,
      msg: 'Something went wrong. Try again.',
      detail: err instanceof Error ? err.message : String(err),
    };
  }, [writeError, receiptError]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-5 text-center">
        <p className="text-sm text-zinc-300">Connect your Base Account to record this score onchain.</p>
        <ConnectWallet />
      </div>
    );
  }

  const submit = () => {
    writeContract({
      address: LEADERBOARD_ADDRESS,
      abi: leaderboardAbi,
      functionName: 'submitScore',
      args: [mode, score, knivesLanded, won],
      chainId: LEADERBOARD_CHAIN_ID,
    });
  };

  const status: 'idle' | 'pending' | 'confirming' | 'confirmed' = isConfirmed
    ? 'confirmed'
    : isConfirming
      ? 'confirming'
      : isPending
        ? 'pending'
        : 'idle';

  return (
    <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-white/10 bg-black/40 p-5">
      {!hash ? (
        <motion.button
          onClick={submit}
          disabled={isPending}
          whileHover={reduce || isPending ? undefined : { y: -1, scale: 1.02 }}
          whileTap={reduce || isPending ? undefined : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className="relative overflow-hidden rounded-full bg-[#0052FF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_-6px_#0052FF] transition disabled:opacity-70"
        >
          <span className="relative z-10 inline-flex items-center justify-center gap-2">
            {isPending ? (
              <>
                <InlineSpinner />
                Confirm in wallet...
              </>
            ) : (
              <>Submit score onchain ({score.toLocaleString()})</>
            )}
          </span>
          {!reduce ? (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
              }}
              initial={{ x: '-120%' }}
              animate={{ x: isPending ? '120%' : '-120%' }}
              transition={{
                duration: isPending ? 1.4 : 2.6,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ) : null}
        </motion.button>
      ) : (
        <motion.div
          layout
          className="relative flex flex-col gap-2 overflow-hidden rounded-xl p-1 text-sm"
        >
          <AnimatePresence>
            {status === 'confirmed' && !reduce ? (
              <motion.div
                key="success-glow"
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                  background:
                    'radial-gradient(60% 60% at 50% 50%, rgba(62,255,162,0.18), rgba(62,255,162,0) 70%)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            ) : null}
          </AnimatePresence>

          <div className="relative flex items-center gap-2">
            <StatusIndicator status={status} reduce={!!reduce} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className={
                  status === 'confirmed'
                    ? 'font-semibold text-[#3effa2]'
                    : 'font-medium text-[#9bbcff]'
                }
              >
                {statusLabel(status)}
              </motion.span>
            </AnimatePresence>
          </div>
          <a
            href={`https://basescan.org/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            className="relative break-all text-xs text-zinc-300 underline decoration-dotted underline-offset-2 hover:text-white"
          >
            tx: {hash}
          </a>
        </motion.div>
      )}

      <AnimatePresence>
        {cleanError ? (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
          >
            <span>{cleanError.msg}</span>
            {cleanError.kind === 'other' && cleanError.detail ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="self-start text-xs text-zinc-400 underline decoration-dotted underline-offset-2 hover:text-zinc-200"
                >
                  {showDetails ? 'hide details' : 'details'}
                </button>
                <AnimatePresence initial={false}>
                  {showDetails ? (
                    <motion.pre
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 text-[11px] text-zinc-400"
                    >
                      {cleanError.detail}
                    </motion.pre>
                  ) : null}
                </AnimatePresence>
              </>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function statusLabel(s: 'idle' | 'pending' | 'confirming' | 'confirmed') {
  if (s === 'pending') return 'Confirm in wallet...';
  if (s === 'confirming') return 'Confirming...';
  if (s === 'confirmed') return 'Recorded onchain';
  return '';
}

function InlineSpinner() {
  return (
    <motion.span
      aria-hidden
      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
    />
  );
}

function StatusIndicator({
  status,
  reduce,
}: {
  status: 'idle' | 'pending' | 'confirming' | 'confirmed';
  reduce: boolean;
}) {
  if (status === 'confirmed') {
    return (
      <motion.span
        initial={reduce ? undefined : { scale: 0.4, opacity: 0 }}
        animate={reduce ? undefined : { scale: [0.4, 1.2, 1], opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3effa2]/20 text-[#3effa2]"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="5 12 10 17 19 7" />
        </svg>
      </motion.span>
    );
  }
  if (status === 'pending' || status === 'confirming') {
    return <InlineSpinner />;
  }
  return null;
}

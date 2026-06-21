'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAccount, useConnect, useDisconnect, type Connector } from 'wagmi';

function truncate(address: string, short = false) {
  return short
    ? `${address.slice(0, 4)}...${address.slice(-3)}`
    : `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// A connector qualifies as a "browser extension wallet" if it's an injected/EIP-6963
// provider — i.e. MetaMask, Rabby, Coinbase Wallet extension, etc.
function isExtensionConnector(c: Connector): boolean {
  return c.type === 'injected';
}

function prettyName(c: Connector): string {
  // EIP-6963 connectors carry the wallet's announced name. The generic injected fallback
  // resolves to "Injected" — relabel it for users so they know what to expect.
  if (c.id === 'injected' && c.name === 'Injected') return 'Browser wallet';
  return c.name;
}

export function ConnectWallet() {
  const { address, isConnected, isReconnecting } = useAccount();
  const { connect, connectors, isPending, error, variables } = useConnect();
  const { disconnect } = useDisconnect();
  const reduce = useReducedMotion();

  const baseAccountConnector = useMemo(
    () => connectors.find((c) => c.type === 'baseAccount'),
    [connectors],
  );

  // Show every browser-extension wallet; dedupe by id (mipd + generic `injected()` can overlap).
  const extensionConnectors = useMemo(() => {
    const seen = new Set<string>();
    const out: Connector[] = [];
    for (const c of connectors) {
      if (!isExtensionConnector(c)) continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
    return out;
  }, [connectors]);

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

  // `variables.connector` is either a Connector (has `uid`) or a CreateConnectorFn (doesn't).
  // We only ever pass Connector instances to connect(), so narrow with an `in` check.
  const pendingConnector = isPending ? variables?.connector : undefined;
  const pendingConnectorId =
    pendingConnector && 'uid' in pendingConnector ? pendingConnector.uid : undefined;

  return (
    <div className="inline-flex flex-col items-center gap-3">
      {baseAccountConnector ? (
        <motion.button
          onClick={() => connect({ connector: baseAccountConnector })}
          disabled={isPending}
          whileHover={reduce ? undefined : { y: -1, scale: 1.03 }}
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="relative overflow-hidden rounded-full bg-[#0052FF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_-6px_#0052FF] transition disabled:opacity-60"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={pendingConnectorId === baseAccountConnector.uid ? 'p' : 'r'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="inline-block"
            >
              {pendingConnectorId === baseAccountConnector.uid ? 'Connecting...' : 'Sign in with Base'}
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
      ) : null}

      {extensionConnectors.length > 0 ? (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">or use extension</span>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {extensionConnectors.map((c) => {
              const pending = pendingConnectorId === c.uid;
              return (
                <motion.button
                  key={c.uid}
                  onClick={() => connect({ connector: c })}
                  disabled={isPending}
                  whileHover={reduce ? undefined : { y: -1, scale: 1.04 }}
                  whileTap={reduce ? undefined : { scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
                  aria-label={`Connect ${prettyName(c)}`}
                >
                  {c.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.icon} alt="" className="h-4 w-4 rounded-sm" />
                  ) : (
                    <span aria-hidden className="inline-block h-4 w-4 rounded-sm bg-white/10" />
                  )}
                  <span>{pending ? 'Connecting...' : prettyName(c)}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
          Could not connect. Try again.
        </span>
      ) : null}
    </div>
  );
}

import { ConnectWallet } from '@/components/ConnectWallet';
import { BaseshooterGame } from '@/components/BaseshooterGame';
import { Wordmark } from '@/components/Wordmark';
import { Leaderboard } from '@/components/Leaderboard';

export default function Home() {
  return (
    <main className="relative mx-auto flex w-full max-w-[460px] flex-col gap-6 px-4 pb-16 pt-6">
      <header className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0 shrink">
          <Wordmark />
        </div>
        <div className="shrink-0">
          <ConnectWallet />
        </div>
      </header>

      <BaseshooterGame />

      <Leaderboard />

      <div className="flex justify-end text-xs text-zinc-500">
        on Base · chainId 8453
      </div>
    </main>
  );
}

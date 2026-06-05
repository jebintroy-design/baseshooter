import Link from 'next/link';
import { Leaderboard } from '@/components/Leaderboard';

export default function LeaderboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-[0_0_18px_rgba(0,82,255,0.5)]">
          Leaderboard
        </h1>
        <Link
          href="/"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-[#9bbcff] transition hover:bg-white/10"
        >
          ← Back to game
        </Link>
      </div>
      <Leaderboard />
    </main>
  );
}

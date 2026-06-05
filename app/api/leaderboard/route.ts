import { NextResponse } from 'next/server';
import { createPublicClient, http, getAddress, type Log } from 'viem';
import { base } from 'viem/chains';
import {
  LEADERBOARD_ADDRESS,
  LEADERBOARD_DEPLOY_BLOCK,
  leaderboardAbi,
} from '@/config/contract';

export const revalidate = 30;

const CHUNK = 9000n;

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const scoreSubmittedEvent = leaderboardAbi.find(
  (item) => item.type === 'event' && item.name === 'ScoreSubmitted',
) as Extract<(typeof leaderboardAbi)[number], { type: 'event'; name: 'ScoreSubmitted' }>;

type Row = { address: string; score: number };
type Decoded = {
  args: {
    player: `0x${string}`;
    mode: number;
    score: number;
    knivesLanded: number;
    won: boolean;
    playedAt: bigint;
  };
};

export async function GET() {
  try {
    const latest = await publicClient.getBlockNumber();
    const best: Record<1 | 2 | 3, Map<string, number>> = {
      1: new Map(),
      2: new Map(),
      3: new Map(),
    };

    for (let from = LEADERBOARD_DEPLOY_BLOCK; from <= latest; from += CHUNK) {
      const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
      const logs = (await publicClient.getLogs({
        address: LEADERBOARD_ADDRESS,
        event: scoreSubmittedEvent,
        fromBlock: from,
        toBlock: to,
      })) as unknown as (Log & Decoded)[];

      for (const log of logs) {
        const mode = log.args.mode as 1 | 2 | 3;
        if (mode !== 1 && mode !== 2 && mode !== 3) continue;
        const player = getAddress(log.args.player);
        const score = Number(log.args.score);
        const prev = best[mode].get(player) ?? 0;
        if (score > prev) best[mode].set(player, score);
      }
    }

    const toSorted = (m: Map<string, number>): Row[] =>
      Array.from(m, ([address, score]) => ({ address, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

    return NextResponse.json({
      1: toSorted(best[1]),
      2: toSorted(best[2]),
      3: toSorted(best[3]),
      latestBlock: latest.toString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'leaderboard fetch failed';
    return NextResponse.json({ error: msg, 1: [], 2: [], 3: [] }, { status: 500 });
  }
}

# Baseshooter

One miss and you're out.

Baseshooter is a precision knife-throw arcade game on Base. Pick a mode, time your throws at the spinning apple wheel, and land every blade without a single miss. Clear a run to lock your score onto the onchain leaderboard. Three modes, three, five, and ten knives, each faster than the last.

## How it works
- Tap or press Space to throw a knife at the spinning wheel of apples.
- Land every knife in an apple. Hit the bare wheel and the run is over.
- Starting a round and submitting a score are onchain actions on Base.
- Cleared and submitted runs appear on the onchain leaderboard.

## Stack
- Next.js (App Router), TypeScript, Tailwind
- wagmi, viem, Base Account
- Canvas 2D game, framer-motion UI
- Base mainnet (chainId 8453)

## Onchain
- Leaderboard contract: 0xa3cd7518a1b9dafc3fc044bda57b7e735bf75770 (Base mainnet)
- Scores are recorded via the ScoreSubmitted event and ranked per mode.

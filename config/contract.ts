export const LEADERBOARD_ADDRESS = '0xa3cd7518a1b9dafc3fc044bda57b7e735bf75770' as const;
export const LEADERBOARD_CHAIN_ID = 8453 as const;
export const LEADERBOARD_DEPLOY_BLOCK = 46924916n;

export const leaderboardAbi = [
  {
    type: 'function',
    name: 'startGame',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'mode', type: 'uint8' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'submitScore',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'mode', type: 'uint8' },
      { name: 'score', type: 'uint32' },
      { name: 'knivesLanded', type: 'uint16' },
      { name: 'won', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getBest',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'mode1', type: 'uint32' },
      { name: 'mode2', type: 'uint32' },
      { name: 'mode3', type: 'uint32' },
    ],
  },
  {
    type: 'event',
    name: 'GameStarted',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'mode', type: 'uint8', indexed: true },
      { name: 'startedAt', type: 'uint64', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ScoreSubmitted',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'mode', type: 'uint8', indexed: true },
      { name: 'score', type: 'uint32', indexed: false },
      { name: 'knivesLanded', type: 'uint16', indexed: false },
      { name: 'won', type: 'bool', indexed: false },
      { name: 'playedAt', type: 'uint64', indexed: false },
    ],
    anonymous: false,
  },
] as const;

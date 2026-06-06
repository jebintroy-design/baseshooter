'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import confetti from 'canvas-confetti';
import { BUILDER_CODE_SUFFIX, LEADERBOARD_ADDRESS, LEADERBOARD_CHAIN_ID, leaderboardAbi } from '@/config/contract';
import { ConnectWallet } from './ConnectWallet';
import { SubmitScore } from './SubmitScore';
import { AnimatedNumber } from './AnimatedNumber';
import { usePlayState } from './PlayStateProvider';

type GameState = 'mode-select' | 'starting' | 'playing' | 'win' | 'game-over';
type Mode = 1 | 2 | 3;

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

type ModeConfig = { knives: number; spinSpeed: number; label: string };

const MODES: Record<Mode, ModeConfig> = {
  1: { knives: 3, spinSpeed: 0.7, label: 'Easy' },
  2: { knives: 5, spinSpeed: 1.4, label: 'Medium' },
  3: { knives: 10, spinSpeed: 2.2, label: 'Hard' },
};

const VIEW_W = 400;
const VIEW_H = 700;
const WHEEL_CX = VIEW_W / 2;
const WHEEL_CY = 270;
const WHEEL_R = 130;
const APPLE_COUNT = 12;
const APPLE_R = 22;
const HITBOX_RAD = (12 * Math.PI) / 180; // ±12°
const KNIFE_LEN = 60;
const KNIFE_W = 8;
const KNIFE_SPEED = 1100; // px/sec
const KNIFE_REST_Y = VIEW_H - 90;
const COLLISION_Y = WHEEL_CY + WHEEL_R; // bottom of rim

const BLUE = '#0052FF';
const RED = '#FF4D4D';

type Apple = { baseAngle: number; alive: boolean; color: 'blue' | 'red' };
type Knife = { state: 'ready' | 'flying' | 'done'; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
type FloatText = { x: number; y: number; vy: number; life: number; max: number; text: string };

type EngineState = {
  rotation: number;
  spinDir: 1 | -1;
  apples: Apple[];
  knife: Knife;
  knivesRemaining: number;
  knivesLanded: number;
  score: number;
  combo: number;
  shake: number;
  flash: number;
  freeze: number;
  particles: Particle[];
  floats: FloatText[];
  spinSpeed: number;
  lastTs: number;
  ended: boolean;
};

function makeApples(): Apple[] {
  return Array.from({ length: APPLE_COUNT }, (_, i) => ({
    baseAngle: (i / APPLE_COUNT) * Math.PI * 2,
    alive: true,
    color: i % 2 === 0 ? 'blue' : 'red',
  }));
}

function makeEngine(mode: Mode): EngineState {
  const cfg = MODES[mode];
  return {
    rotation: 0,
    spinDir: 1,
    apples: makeApples(),
    knife: { state: 'ready', y: KNIFE_REST_Y },
    knivesRemaining: cfg.knives,
    knivesLanded: 0,
    score: 0,
    combo: 0,
    shake: 0,
    flash: 0,
    freeze: 0,
    particles: [],
    floats: [],
    spinSpeed: cfg.spinSpeed,
    lastTs: 0,
    ended: false,
  };
}

// --- audio ---
type Sfx = {
  ctx: AudioContext | null;
  enabled: boolean;
};

function playTone(sfx: Sfx, freq: number, dur: number, type: OscillatorType, gain = 0.2) {
  if (!sfx.enabled) return;
  if (!sfx.ctx) {
    try {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      sfx.ctx = new Ctor();
    } catch {
      return;
    }
  }
  const ctx = sfx.ctx;
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.5), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export function BaseshooterGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineState | null>(null);
  const sfxRef = useRef<Sfx>({ ctx: null, enabled: false });

  const [state, setState] = useState<GameState>('mode-select');
  const [mode, setMode] = useState<Mode>(1);
  const [muted, setMuted] = useState(true);
  // Mirrored for HUD
  const [hudScore, setHudScore] = useState(0);
  const [hudCombo, setHudCombo] = useState(0);
  const [hudKnives, setHudKnives] = useState(MODES[1].knives);
  const [hudHits, setHudHits] = useState(0);

  // Mode-select onchain start state
  const { isConnected } = useAccount();
  const { writeContract: writeStartGame, reset: resetStartGame } = useWriteContract();
  const [startMsg, setStartMsg] = useState<string | null>(null);
  const [startDetail, setStartDetail] = useState<string | null>(null);
  const [showStartDetail, setShowStartDetail] = useState(false);

  const reduce = useReducedMotion();
  const { setPlaying } = usePlayState();

  useEffect(() => {
    sfxRef.current.enabled = !muted;
  }, [muted]);

  // Tell the global background to simplify itself while a round is live.
  useEffect(() => {
    setPlaying(state === 'playing');
    return () => setPlaying(false);
  }, [state, setPlaying]);

  // Confetti on win.
  useEffect(() => {
    if (state !== 'win' || reduce) return;
    const colors = ['#0052FF', '#1a66ff', '#FF4D4D', '#ffffff'];
    confetti({
      particleCount: 90,
      spread: 75,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.55 },
      colors,
      zIndex: 70,
    });
    const t1 = setTimeout(() => {
      confetti({ particleCount: 50, spread: 120, startVelocity: 35, origin: { x: 0.2, y: 0.6 }, colors, zIndex: 70 });
      confetti({ particleCount: 50, spread: 120, startVelocity: 35, origin: { x: 0.8, y: 0.6 }, colors, zIndex: 70 });
    }, 200);
    return () => clearTimeout(t1);
  }, [state, reduce]);

  const beginRound = useCallback((m: Mode) => {
    engineRef.current = makeEngine(m);
    setHudScore(0);
    setHudCombo(0);
    setHudHits(0);
    setHudKnives(MODES[m].knives);
    setState('playing');
  }, []);

  const startGame = useCallback(
    (m: Mode) => {
      setMode(m);
      setStartMsg(null);
      setStartDetail(null);
      setShowStartDetail(false);
      resetStartGame();
      setState('starting');
      writeStartGame(
        {
          address: LEADERBOARD_ADDRESS,
          abi: leaderboardAbi,
          functionName: 'startGame',
          args: [m],
          chainId: LEADERBOARD_CHAIN_ID,
          dataSuffix: BUILDER_CODE_SUFFIX,
        },
        {
          onSuccess: () => {
            // Start play immediately after signature, do not wait for confirmation.
            beginRound(m);
          },
          onError: (err) => {
            if (isUserRejection(err)) {
              setStartMsg('Game start cancelled. Tap a mode to try again.');
            } else {
              setStartMsg('Something went wrong. Try again.');
              setStartDetail(err instanceof Error ? err.message : String(err));
            }
            setState('mode-select');
          },
        },
      );
    },
    [writeStartGame, resetStartGame, beginRound],
  );

  const backToMenu = useCallback(() => {
    engineRef.current = null;
    setStartMsg(null);
    setStartDetail(null);
    setShowStartDetail(false);
    setState('mode-select');
  }, []);

  const throwKnife = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.ended || eng.freeze > 0) return;
    if (eng.knife.state !== 'ready') return;
    if (eng.knivesRemaining <= 0) return;
    eng.knife.state = 'flying';
    playTone(sfxRef.current, 700, 0.06, 'square', 0.08);
  }, []);

  // input handlers
  useEffect(() => {
    if (state !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        throwKnife();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, throwKnife]);

  // main loop
  useEffect(() => {
    if (state !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const eng = engineRef.current!;
    eng.lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - eng.lastTs) / 1000);
      eng.lastTs = now;
      update(dt);
      render(ctx);
      raf = requestAnimationFrame(tick);
    };

    const onHit = (apple: Apple) => {
      apple.alive = false;
      eng.combo += 1;
      eng.knivesLanded += 1;
      const mult = 1 + (eng.combo - 1) * 0.5;
      const speedBonus = Math.round(eng.spinSpeed * 15);
      const gained = Math.round((100 + speedBonus) * mult);
      eng.score += gained;
      eng.shake = 7;
      // particles
      const baseColor = apple.color === 'blue' ? BLUE : RED;
      const ax = WHEEL_CX;
      const ay = COLLISION_Y;
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 220;
        eng.particles.push({
          x: ax,
          y: ay,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 80,
          life: 0.6,
          max: 0.6,
          color: baseColor,
        });
      }
      eng.floats.push({
        x: ax,
        y: ay - 20,
        vy: -50,
        life: 1.0,
        max: 1.0,
        text: `+${gained}  x${mult.toFixed(1)}`,
      });
      eng.knivesRemaining -= 1;
      eng.knife = { state: 'ready', y: KNIFE_REST_Y };
      playTone(sfxRef.current, 880, 0.08, 'triangle', 0.18);

      // sync HUD
      setHudScore(eng.score);
      setHudCombo(eng.combo);
      setHudKnives(eng.knivesRemaining);
      setHudHits(eng.knivesLanded);

      if (eng.knivesRemaining === 0) {
        eng.ended = true;
        setTimeout(() => setState('win'), 350);
      }
    };

    const onMiss = () => {
      eng.combo = 0;
      eng.flash = 0.6;
      eng.shake = 12;
      eng.freeze = 0.45;
      eng.knife = { state: 'done', y: -200 };
      playTone(sfxRef.current, 140, 0.4, 'sawtooth', 0.25);
      eng.ended = true;
      setHudCombo(0);
      setTimeout(() => setState('game-over'), 650);
    };

    const update = (dt: number) => {
      if (eng.ended) {
        // still let particles & shake decay
      }
      // freeze: skip wheel + knife motion during miss freeze
      const frozen = eng.freeze > 0;
      if (frozen) eng.freeze -= dt;

      if (!frozen && !eng.ended) {
        eng.rotation += eng.spinSpeed * eng.spinDir * dt;
      }

      // knife motion
      if (eng.knife.state === 'flying' && !frozen) {
        eng.knife.y -= KNIFE_SPEED * dt;
        if (eng.knife.y <= COLLISION_Y) {
          // collision moment. Find apple closest to bottom (angle pi/2 in canvas coords).
          let hitApple: Apple | null = null;
          let bestDelta = Infinity;
          for (const a of eng.apples) {
            if (!a.alive) continue;
            const ang = a.baseAngle + eng.rotation;
            // canvas-space angle: 0 right, π/2 down
            let delta = Math.abs(angleDiff(ang, Math.PI / 2));
            if (delta < bestDelta) {
              bestDelta = delta;
              hitApple = a;
            }
          }
          if (hitApple && bestDelta <= HITBOX_RAD) {
            onHit(hitApple);
          } else {
            onMiss();
          }
        }
      }

      // particles
      for (const p of eng.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 600 * dt;
        p.life -= dt;
      }
      eng.particles = eng.particles.filter((p) => p.life > 0);

      // floats
      for (const f of eng.floats) {
        f.y += f.vy * dt;
        f.vy += 30 * dt; // ease out
        f.life -= dt;
      }
      eng.floats = eng.floats.filter((f) => f.life > 0);

      // shake / flash decay
      eng.shake = Math.max(0, eng.shake - dt * 28);
      eng.flash = Math.max(0, eng.flash - dt * 1.6);
    };

    const render = (g: CanvasRenderingContext2D) => {
      const W = canvas.width;
      const H = canvas.height;
      const sx = (Math.random() - 0.5) * eng.shake;
      const sy = (Math.random() - 0.5) * eng.shake;

      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);

      // background
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#06122e');
      grad.addColorStop(1, '#01030b');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);

      // subtle grid
      g.strokeStyle = 'rgba(0,82,255,0.06)';
      g.lineWidth = 1;
      for (let i = 0; i < W; i += 40) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, H);
        g.stroke();
      }
      for (let i = 0; i < H; i += 40) {
        g.beginPath();
        g.moveTo(0, i);
        g.lineTo(W, i);
        g.stroke();
      }

      // camera shake
      g.translate(sx, sy);

      drawWheel(g, eng);
      drawKnife(g, eng);

      // particles
      for (const p of eng.particles) {
        const a = Math.max(0, p.life / p.max);
        g.fillStyle = withAlpha(p.color, a);
        g.beginPath();
        g.arc(p.x, p.y, 3 * a + 1, 0, Math.PI * 2);
        g.fill();
      }

      // floating texts
      g.textAlign = 'center';
      g.font = 'bold 18px ui-sans-serif, system-ui, sans-serif';
      for (const f of eng.floats) {
        const a = Math.max(0, f.life / f.max);
        g.fillStyle = `rgba(255,255,255,${a})`;
        g.fillText(f.text, f.x, f.y);
      }

      // miss flash overlay (above shake)
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (eng.flash > 0) {
        g.fillStyle = `rgba(255,77,77,${eng.flash * 0.5})`;
        g.fillRect(0, 0, W, H);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  // Pointer / touch on canvas
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      throwKnife();
    },
    [throwKnife],
  );

  const combo = hudCombo > 1 ? 1 + (hudCombo - 1) * 0.5 : 1;

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2 text-xs text-zinc-200 sm:gap-3 sm:text-sm">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="shrink-0 rounded-full border border-[#0052FF]/30 bg-[#0052FF]/15 px-2 py-0.5 text-[10px] font-semibold text-[#9bbcff] shadow-[0_0_18px_-8px_rgba(0,82,255,0.7)] sm:px-2.5 sm:py-1 sm:text-xs">
            <span className="sm:hidden">M{mode}</span>
            <span className="hidden sm:inline">Mode {mode} · {MODES[mode].label}</span>
          </span>
          <KnifeRow total={MODES[mode].knives} remaining={hudKnives} reduce={!!reduce} />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <span className="hidden text-xs uppercase tracking-wider text-zinc-400 sm:inline">
              Score
            </span>
            <AnimatedNumber
              value={hudScore}
              className="font-mono text-sm font-semibold text-white sm:text-base"
            />
          </div>
          <MuteButton muted={muted} onToggle={() => setMuted((m) => !m)} reduce={!!reduce} />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-[#0052FF]/30 bg-black shadow-[0_30px_80px_-30px_rgba(0,82,255,0.6)]">
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          onPointerDown={onPointerDown}
          className="block w-full touch-none select-none"
          style={{ aspectRatio: `${VIEW_W}/${VIEW_H}` }}
        />

        <AnimatePresence>
          {state === 'playing' && hudCombo > 1 ? (
            <motion.div
              key={`combo-${hudCombo}`}
              initial={{ scale: 0.6, opacity: 0, y: -4 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16 }}
              className="pointer-events-none absolute right-3 top-3 rounded-full border border-[#0052FF]/40 bg-[#0052FF]/25 px-3 py-1 text-xs font-bold text-white shadow-[0_0_22px_-6px_rgba(0,82,255,0.9)]"
              style={{ fontSize: 12 + Math.min(8, hudCombo) }}
            >
              x{combo.toFixed(1)} combo
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {state === 'mode-select' ? (
            <ScreenOverlay key="mode-select" reduce={!!reduce}>
              <h2 className="text-center text-2xl font-bold tracking-tight text-white drop-shadow-[0_0_18px_rgba(0,82,255,0.5)]">
                Baseshooter
              </h2>
              <p className="mt-1 text-center text-sm text-zinc-300">
                Land every knife in an apple. Hit the bare wheel and you&apos;re out.
              </p>
              {isConnected ? (
                <>
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: {},
                      show: { transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: 0.05 } },
                    }}
                    className="mt-6 flex flex-col gap-2"
                  >
                    {([1, 2, 3] as Mode[]).map((m) => (
                      <ModeButton key={m} mode={m} onPick={() => startGame(m)} reduce={!!reduce} />
                    ))}
                  </motion.div>
                  <p className="mt-4 text-center text-xs text-zinc-400">Tap or press Space to throw.</p>
                  <FriendlyError
                    msg={startMsg}
                    detail={startDetail}
                    show={showStartDetail}
                    onToggle={() => setShowStartDetail((v) => !v)}
                  />
                </>
              ) : (
                <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-center">
                  <p className="text-sm text-zinc-300">
                    Connect your Base Account to start a game. Each round opens with an onchain start.
                  </p>
                  <ConnectWallet />
                </div>
              )}
            </ScreenOverlay>
          ) : null}

          {state === 'starting' ? (
            <ScreenOverlay key="starting" reduce={!!reduce}>
              <div className="flex flex-col items-center gap-3">
                <Spinner />
                <h2 className="text-center text-xl font-bold tracking-tight text-white">
                  Confirm in wallet to start...
                </h2>
                <p className="text-center text-sm text-zinc-300">
                  Mode {mode} · {MODES[mode].label} · {MODES[mode].knives} knives
                </p>
                <p className="text-center text-xs text-zinc-400">
                  A Base wallet popup is opening. Approve the start tx to begin the round.
                </p>
              </div>
            </ScreenOverlay>
          ) : null}

          {state === 'win' ? (
            <ScreenOverlay key="win" reduce={!!reduce} variant="win">
              <div className="relative">
                {!reduce ? (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -inset-6 rounded-full"
                    style={{
                      background:
                        'conic-gradient(from 0deg, rgba(0,82,255,0.0), rgba(0,82,255,0.55), rgba(255,77,77,0.4), rgba(0,82,255,0.0))',
                      filter: 'blur(18px)',
                      opacity: 0.7,
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                  />
                ) : null}
                <motion.h2
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.05 }}
                  className="relative text-center text-2xl font-bold text-white drop-shadow-[0_0_22px_rgba(0,82,255,0.7)]"
                >
                  Mode {mode} cleared
                </motion.h2>
              </div>
              <p className="mt-2 text-center text-sm text-zinc-300">
                Score:{' '}
                <span className="font-mono text-white">{hudScore.toLocaleString()}</span> · Knives landed:{' '}
                <span className="font-mono text-white">
                  {hudHits}/{MODES[mode].knives}
                </span>
              </p>
              <div className="mt-4">
                <SubmitScore mode={mode} score={hudScore} knivesLanded={hudHits} won={true} />
              </div>
              <div className="mt-4 flex gap-2">
                <PillButton onClick={() => startGame(mode)} reduce={!!reduce} variant="soft">
                  Play again
                </PillButton>
                <PillButton onClick={backToMenu} reduce={!!reduce} variant="soft">
                  Modes
                </PillButton>
              </div>
            </ScreenOverlay>
          ) : null}

          {state === 'game-over' ? (
            <ScreenOverlay key="game-over" reduce={!!reduce} variant="gameover">
              <motion.h2
                initial={reduce ? undefined : { x: -8, opacity: 0 }}
                animate={
                  reduce ? undefined : { x: [-8, 8, -5, 5, -2, 0], opacity: 1 }
                }
                transition={{ duration: 0.5 }}
                className="text-center text-2xl font-bold text-white"
              >
                Missed.
              </motion.h2>
              <p className="mt-1 text-center text-sm text-zinc-300">
                Score:{' '}
                <span className="font-mono text-white">{hudScore.toLocaleString()}</span> · Knives landed:{' '}
                <span className="font-mono text-white">
                  {hudHits}/{MODES[mode].knives}
                </span>
              </p>
              <div className="mt-4">
                <SubmitScore mode={mode} score={hudScore} knivesLanded={hudHits} won={false} />
              </div>
              <div className="mt-4 flex gap-2">
                <PillButton onClick={() => startGame(mode)} reduce={!!reduce} variant="primary">
                  Try again
                </PillButton>
                <PillButton onClick={backToMenu} reduce={!!reduce} variant="soft">
                  Modes
                </PillButton>
              </div>
            </ScreenOverlay>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ScreenOverlay({
  children,
  reduce,
  variant,
}: {
  children: React.ReactNode;
  reduce: boolean;
  variant?: 'win' | 'gameover';
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.05 : 0.2 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md"
    >
      {variant === 'gameover' && !reduce ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[#FF4D4D]/30"
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      ) : null}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
        transition={
          reduce
            ? { duration: 0.05 }
            : { type: 'spring', stiffness: 320, damping: 22 }
        }
        className={`relative w-full max-w-[340px] rounded-2xl border p-5 shadow-[0_30px_80px_-30px_rgba(0,82,255,0.5)] ${
          variant === 'win'
            ? 'border-[#0052FF]/40 bg-zinc-950/90'
            : variant === 'gameover'
              ? 'border-[#FF4D4D]/30 bg-zinc-950/90'
              : 'border-white/10 bg-zinc-950/90'
        }`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function ModeButton({ mode, onPick, reduce }: { mode: Mode; onPick: () => void; reduce: boolean }) {
  // Difficulty color: calm blue → hot red-tint at hardest.
  const tints: Record<Mode, { from: string; to: string; glow: string }> = {
    1: { from: '#1a66ff', to: '#0052FF', glow: 'rgba(0,82,255,0.55)' },
    2: { from: '#3d7bff', to: '#0052FF', glow: 'rgba(0,82,255,0.65)' },
    3: { from: '#FF4D4D', to: '#0052FF', glow: 'rgba(255,77,77,0.55)' },
  };
  const t = tints[mode];
  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 360, damping: 24 } },
      }}
      whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      onClick={onPick}
      className="group relative overflow-hidden rounded-2xl px-5 py-3 text-left text-sm font-semibold text-white"
      style={{
        background: `linear-gradient(120deg, ${t.from}, ${t.to})`,
        boxShadow: `0 0 30px -10px ${t.glow}`,
      }}
    >
      <span className="relative z-10 flex items-center justify-between gap-3">
        <span>
          Mode {mode} · {MODES[mode].label}
        </span>
        <span className="rounded-full bg-black/25 px-2 py-0.5 font-mono text-xs">
          {MODES[mode].knives} knives
        </span>
      </span>
      {!reduce ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%)',
          }}
          initial={{ x: '-120%' }}
          whileHover={{ x: '120%' }}
          transition={{ duration: 0.9 }}
        />
      ) : null}
    </motion.button>
  );
}

function PillButton({
  children,
  onClick,
  reduce,
  variant = 'soft',
}: {
  children: React.ReactNode;
  onClick: () => void;
  reduce: boolean;
  variant?: 'soft' | 'primary';
}) {
  const cls =
    variant === 'primary'
      ? 'bg-[#0052FF] text-white font-semibold shadow-[0_0_22px_-8px_#0052FF] hover:bg-[#1a66ff]'
      : 'bg-white/10 text-white hover:bg-white/20';
  return (
    <motion.button
      onClick={onClick}
      whileHover={reduce ? undefined : { y: -1, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      className={`flex-1 rounded-full px-4 py-2 text-sm transition ${cls}`}
    >
      {children}
    </motion.button>
  );
}

function MuteButton({
  muted,
  onToggle,
  reduce,
}: {
  muted: boolean;
  onToggle: () => void;
  reduce: boolean;
}) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={reduce ? undefined : { scale: 0.88 }}
      whileHover={reduce ? undefined : { scale: 1.05 }}
      className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
      aria-label={muted ? 'Unmute' : 'Mute'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {muted ? (
          <motion.svg
            key="muted"
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 5L6 9H3v6h3l5 4V5z" />
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </motion.svg>
        ) : (
          <motion.svg
            key="on"
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 5L6 9H3v6h3l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function KnifeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="blade-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9aa3b8" />
          <stop offset="55%" stopColor="#e6ecff" />
          <stop offset="100%" stopColor="#5b6480" />
        </linearGradient>
      </defs>
      <path d="M12 1 L15 6 L15 14 L9 14 L9 6 Z" fill="url(#blade-grad)" />
      <rect x="8" y="14" width="8" height="2" fill="#0052FF" />
      <rect x="9" y="16" width="6" height="7" rx="1" fill="#0a0a14" stroke="#0052FF" strokeWidth="0.5" />
    </svg>
  );
}

function KnifeRow({
  total,
  remaining,
  reduce,
}: {
  total: number;
  remaining: number;
  reduce: boolean;
}) {
  // Render up to 10 icons. For total > 10, show a compact "n × icon" pattern.
  const compact = total > 6;
  return (
    <div className="flex items-center gap-1">
      {compact ? (
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
          <KnifeIcon size={12} />
          <motion.span
            key={remaining}
            initial={reduce ? undefined : { scale: 1.2, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="font-mono text-xs text-white"
          >
            {remaining}
            <span className="text-zinc-500">/{total}</span>
          </motion.span>
        </div>
      ) : (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: total }, (_, i) => {
            const used = i >= remaining;
            return (
              <motion.span
                key={i}
                animate={{ opacity: used ? 0.15 : 1, y: used ? -2 : 0, filter: used ? 'grayscale(1)' : 'grayscale(0)' }}
                transition={{ duration: 0.25 }}
                className="inline-flex"
              >
                <KnifeIcon size={14} />
              </motion.span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <motion.span
      aria-hidden
      className="inline-block h-9 w-9 rounded-full border-2 border-[#0052FF]/30 border-t-[#0052FF]"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );
}

function FriendlyError({
  msg,
  detail,
  show,
  onToggle,
}: {
  msg: string | null;
  detail: string | null;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <AnimatePresence>
      {msg ? (
        <motion.div
          key="start-error"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="mt-3 flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
        >
          <span>{msg}</span>
          {detail ? (
            <>
              <button
                type="button"
                onClick={onToggle}
                className="self-start text-xs text-zinc-400 underline decoration-dotted underline-offset-2 hover:text-zinc-200"
              >
                {show ? 'hide details' : 'details'}
              </button>
              <AnimatePresence initial={false}>
                {show ? (
                  <motion.pre
                    key="details"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 text-[11px] text-zinc-400"
                  >
                    {detail}
                  </motion.pre>
                ) : null}
              </AnimatePresence>
            </>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function angleDiff(a: number, b: number) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function withAlpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawWheel(g: CanvasRenderingContext2D, eng: EngineState) {
  // wheel body (wooden disc)
  const cx = WHEEL_CX;
  const cy = WHEEL_CY;

  // outer ring glow
  g.save();
  g.shadowColor = 'rgba(0,82,255,0.35)';
  g.shadowBlur = 24;
  g.fillStyle = '#1a1d2b';
  g.beginPath();
  g.arc(cx, cy, WHEEL_R + 10, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // wood disc
  const woodGrad = g.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, WHEEL_R);
  woodGrad.addColorStop(0, '#3a2a1a');
  woodGrad.addColorStop(1, '#1a1208');
  g.fillStyle = woodGrad;
  g.beginPath();
  g.arc(cx, cy, WHEEL_R, 0, Math.PI * 2);
  g.fill();

  // wood grain rings
  g.strokeStyle = 'rgba(255,180,100,0.06)';
  g.lineWidth = 1;
  for (let r = 20; r < WHEEL_R; r += 14) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }

  // center hub
  g.fillStyle = '#0a0a14';
  g.beginPath();
  g.arc(cx, cy, 12, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#0052FF';
  g.lineWidth = 2;
  g.stroke();

  // rotation tick mark so the spin is readable
  const tickX = cx + Math.cos(eng.rotation) * (WHEEL_R - 18);
  const tickY = cy + Math.sin(eng.rotation) * (WHEEL_R - 18);
  g.fillStyle = '#0052FF';
  g.beginPath();
  g.arc(tickX, tickY, 4, 0, Math.PI * 2);
  g.fill();

  // apples
  for (const a of eng.apples) {
    if (!a.alive) continue;
    const ang = a.baseAngle + eng.rotation;
    const x = cx + Math.cos(ang) * WHEEL_R;
    const y = cy + Math.sin(ang) * WHEEL_R;
    drawApple(g, x, y, a.color === 'blue' ? BLUE : RED);
  }
}

function drawApple(g: CanvasRenderingContext2D, x: number, y: number, color: string) {
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(x, y + APPLE_R * 0.6, APPLE_R * 0.7, APPLE_R * 0.25, 0, 0, Math.PI * 2);
  g.fill();

  // body
  const grad = g.createRadialGradient(x - APPLE_R * 0.35, y - APPLE_R * 0.4, APPLE_R * 0.15, x, y, APPLE_R);
  grad.addColorStop(0, lighten(color, 0.35));
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, darken(color, 0.35));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, APPLE_R, 0, Math.PI * 2);
  g.fill();

  // glossy highlight
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(x - APPLE_R * 0.4, y - APPLE_R * 0.45, APPLE_R * 0.22, APPLE_R * 0.12, -0.6, 0, Math.PI * 2);
  g.fill();

  // stem
  g.strokeStyle = '#2d1808';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x, y - APPLE_R + 2);
  g.lineTo(x + 4, y - APPLE_R - 6);
  g.stroke();

  // leaf
  g.fillStyle = '#1f8a4c';
  g.beginPath();
  g.ellipse(x + 8, y - APPLE_R - 4, 5, 3, -0.6, 0, Math.PI * 2);
  g.fill();
}

function drawKnife(g: CanvasRenderingContext2D, eng: EngineState) {
  if (eng.knife.state === 'done') return;
  const x = WHEEL_CX;
  const y = eng.knife.y;

  // blade
  const bladeTop = y - KNIFE_LEN * 0.6;
  const bladeBot = y + KNIFE_LEN * 0.2;
  const bladeGrad = g.createLinearGradient(x - KNIFE_W, 0, x + KNIFE_W, 0);
  bladeGrad.addColorStop(0, '#9aa3b8');
  bladeGrad.addColorStop(0.5, '#e6ecff');
  bladeGrad.addColorStop(1, '#5b6480');
  g.fillStyle = bladeGrad;
  g.beginPath();
  g.moveTo(x, bladeTop);
  g.lineTo(x + KNIFE_W, bladeTop + 14);
  g.lineTo(x + KNIFE_W, bladeBot);
  g.lineTo(x - KNIFE_W, bladeBot);
  g.lineTo(x - KNIFE_W, bladeTop + 14);
  g.closePath();
  g.fill();

  // guard
  g.fillStyle = '#0052FF';
  g.fillRect(x - KNIFE_W - 6, bladeBot, KNIFE_W * 2 + 12, 5);

  // handle
  g.fillStyle = '#0a0a14';
  g.fillRect(x - KNIFE_W + 1, bladeBot + 5, KNIFE_W * 2 - 2, KNIFE_LEN * 0.4);
  g.strokeStyle = '#0052FF';
  g.lineWidth = 1;
  g.strokeRect(x - KNIFE_W + 1, bladeBot + 5, KNIFE_W * 2 - 2, KNIFE_LEN * 0.4);
}

function lighten(hex: string, amt: number) {
  const r = clamp255(parseInt(hex.slice(1, 3), 16) + 255 * amt);
  const gn = clamp255(parseInt(hex.slice(3, 5), 16) + 255 * amt);
  const b = clamp255(parseInt(hex.slice(5, 7), 16) + 255 * amt);
  return `rgb(${r},${gn},${b})`;
}
function darken(hex: string, amt: number) {
  const r = clamp255(parseInt(hex.slice(1, 3), 16) - 255 * amt);
  const gn = clamp255(parseInt(hex.slice(3, 5), 16) - 255 * amt);
  const b = clamp255(parseInt(hex.slice(5, 7), 16) - 255 * amt);
  return `rgb(${r},${gn},${b})`;
}
function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

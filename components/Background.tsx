'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';
import { usePlayState } from './PlayStateProvider';

type Particle = {
  left: number; // %
  top: number; // %
  size: number; // px
  sway: number; // px (signed)
  peak: number; // opacity 0..1
  duration: number; // s
  delay: number; // s (negative so animations start mid-cycle on mount)
  hue: 'blue' | 'red' | 'white';
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeParticles(count: number, seed = 1337): Particle[] {
  const r = rng(seed);
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const layer = r();
    const size = layer < 0.55 ? 1 + r() * 1.2 : layer < 0.88 ? 1.6 + r() * 1.6 : 2.4 + r() * 2.4;
    const duration = size < 1.8 ? 18 + r() * 10 : size < 3 ? 24 + r() * 12 : 30 + r() * 16;
    const hueRoll = r();
    const hue: Particle['hue'] = hueRoll < 0.6 ? 'white' : hueRoll < 0.85 ? 'blue' : 'red';
    out.push({
      left: r() * 100,
      top: 60 + r() * 80,
      size,
      sway: (20 + r() * 40) * (r() < 0.5 ? 1 : -1),
      peak: 0.45 + r() * 0.5,
      duration,
      delay: -r() * duration,
      hue,
    });
  }
  return out;
}

const PARTICLE_POOL = makeParticles(60, 1337);

function useIsMobile() {
  // Defaults to false on the server so SSR/CSR markup matches; updates after mount.
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return mobile;
}

export function Background() {
  const reduce = useReducedMotion();
  const { isPlaying } = usePlayState();
  const isMobile = useIsMobile();

  const visibleParticles = useMemo(() => {
    if (reduce) return PARTICLE_POOL.slice(0, isMobile ? 16 : 28);
    if (isPlaying) return PARTICLE_POOL.slice(0, isMobile ? 12 : 22);
    return PARTICLE_POOL.slice(0, isMobile ? 24 : 60);
  }, [reduce, isPlaying, isMobile]);

  const blur = isMobile ? 28 : 60;

  // On mobile, mix-blend-mode: screen combined with blurred fixed layers is the
  // main culprit for flickering / repaint glitches in iOS Safari and some
  // Android browsers. Drop the blend mode on mobile and rely on plain alpha.
  const auroraWrapStyle: CSSProperties = {
    mixBlendMode: isMobile ? undefined : 'screen',
    opacity: isPlaying ? 0.55 : isMobile ? 0.9 : 1,
    transition: 'opacity 600ms ease',
  };

  const wheelDuration = isPlaying ? '260s' : isMobile ? '140s' : '90s';
  const gridDuration = isPlaying ? '22s' : isMobile ? '14s' : '7s';
  const wheelOpacity = isPlaying ? 0.05 : isMobile ? 0.07 : 0.09;
  const gridOpacity = isPlaying ? 0.45 : isMobile ? 0.55 : 0.75;
  const gridHeight = isMobile ? '38svh' : '46svh';

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: '#05070F' }}
    >
      {/* 1. Base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, rgba(0,82,255,0.22), rgba(0,0,0,0) 60%), radial-gradient(80% 60% at 100% 100%, rgba(255,77,77,0.10), rgba(0,0,0,0) 70%), linear-gradient(180deg, #05070F 0%, #080C1E 60%, #0A0E1A 100%)',
        }}
      />

      {/* 2. Aurora blobs. Sized in svh so URL bar collapse on mobile does not jump them. */}
      <div className="absolute inset-0" style={auroraWrapStyle}>
        <AuroraBlob
          name="bs-aurora-1"
          duration="22s"
          animate={!reduce}
          blur={blur}
          style={{
            top: '-22svh',
            left: '-18vw',
            width: '85svh',
            height: '85svh',
            background:
              'radial-gradient(closest-side, rgba(0,82,255,0.85), rgba(0,82,255,0) 70%)',
          }}
        />
        <AuroraBlob
          name="bs-aurora-2"
          duration="28s"
          animate={!reduce}
          blur={blur}
          style={{
            top: '18svh',
            right: '-22vw',
            width: '75svh',
            height: '75svh',
            background:
              'radial-gradient(closest-side, rgba(255,77,77,0.75), rgba(255,77,77,0) 70%)',
          }}
        />
        <AuroraBlob
          name="bs-aurora-3"
          duration="34s"
          animate={!reduce}
          blur={blur}
          style={{
            bottom: '-40svh',
            left: '50%',
            marginLeft: '-55svh',
            width: '110svh',
            height: '110svh',
            background:
              'radial-gradient(closest-side, rgba(26,102,255,0.8), rgba(26,102,255,0) 65%)',
          }}
        />
        {/* The 4th blob is decorative. Skip on mobile to cut GPU work. */}
        {!isMobile ? (
          <AuroraBlob
            name="bs-aurora-4"
            duration="40s"
            animate={!reduce}
            blur={blur}
            style={{
              top: '-12svh',
              right: '4vw',
              width: '55svh',
              height: '55svh',
              background:
                'radial-gradient(closest-side, rgba(255,109,109,0.7), rgba(255,109,109,0) 70%)',
            }}
          />
        ) : null}
      </div>

      {/* 3. Wheel silhouette */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '36%',
          width: isMobile ? '140vmin' : '170vmin',
          height: isMobile ? '140vmin' : '170vmin',
          opacity: wheelOpacity,
          transition: 'opacity 600ms ease',
          animationName: reduce ? 'none' : 'bs-wheel-rot',
          animationDuration: wheelDuration,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          transform: 'translate(-50%, -50%)',
          willChange: reduce ? 'auto' : 'transform',
        }}
      >
        <WheelSilhouette />
      </div>

      {/* 4. Particle field */}
      <div className="absolute inset-0">
        {visibleParticles.map((p, i) => {
          const color =
            p.hue === 'blue'
              ? 'rgba(155, 188, 255, 0.95)'
              : p.hue === 'red'
                ? 'rgba(255, 170, 170, 0.9)'
                : 'rgba(255, 255, 255, 0.95)';
          const glow =
            p.hue === 'blue'
              ? '0 0 8px rgba(0,82,255,0.55)'
              : p.hue === 'red'
                ? '0 0 8px rgba(255,77,77,0.5)'
                : '0 0 6px rgba(255,255,255,0.5)';
          const style: CSSProperties = {
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            borderRadius: '999px',
            background: color,
            boxShadow: isMobile ? undefined : glow,
            opacity: reduce ? p.peak * 0.55 : 0,
            animationName: reduce ? 'none' : 'bs-particle',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            willChange: reduce ? 'auto' : 'transform, opacity',
          };
          (style as Record<string, string | number>)['--bs-sway'] = p.sway;
          (style as Record<string, string | number>)['--bs-peak'] = p.peak;
          return <span key={i} style={style} />;
        })}
      </div>

      {/* 5. Synthwave depth grid */}
      <div
        className="absolute bottom-0 left-0 right-0 overflow-hidden"
        style={{ height: gridHeight, opacity: gridOpacity, transition: 'opacity 600ms ease' }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,82,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(0,82,255,0.4) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            transform: 'perspective(420px) rotateX(58deg)',
            transformOrigin: 'top center',
            animationName: reduce ? 'none' : 'bs-grid-scroll',
            animationDuration: gridDuration,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            willChange: reduce ? 'auto' : 'background-position',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(5,7,15,0) 0%, rgba(5,7,15,0.85) 80%, rgba(5,7,15,1) 100%)',
          }}
        />
        <div
          className="absolute left-0 right-0"
          style={{
            top: 0,
            height: 2,
            background:
              'linear-gradient(90deg, rgba(0,82,255,0) 0%, rgba(0,82,255,0.95) 50%, rgba(0,82,255,0) 100%)',
            boxShadow: '0 0 22px 3px rgba(0,82,255,0.55)',
            animationName: reduce ? 'none' : 'bs-horizon-glow',
            animationDuration: '5s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            willChange: reduce ? 'auto' : 'opacity, box-shadow',
          }}
        />
      </div>

      {/* 6a. Card spotlight */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(closest-side at 50% 42%, rgba(5,7,15,0.55), rgba(5,7,15,0) 38%)',
        }}
      />

      {/* 6b. Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      {/* 6c. Texture overlays. feTurbulence and overlay blend are expensive on
          mobile GPUs and tend to cause continuous repaint glitches. Desktop
          only. */}
      <div
        className="absolute inset-0 hidden sm:block"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")",
          opacity: 0.07,
          mixBlendMode: 'overlay',
        }}
      />
      <div
        className="absolute inset-0 hidden sm:block"
        style={{
          backgroundImage:
            'repeating-linear-gradient(180deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)',
          opacity: 0.4,
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}

function AuroraBlob({
  name,
  duration,
  animate,
  blur,
  style,
}: {
  name: string;
  duration: string;
  animate: boolean;
  blur: number;
  style: CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: '999px',
        filter: `blur(${blur}px)`,
        animationName: animate ? name : 'none',
        animationDuration: duration,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
        willChange: animate ? 'transform, opacity' : 'auto',
        ...style,
      }}
    />
  );
}

function WheelSilhouette() {
  const apples = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return {
      x: 250 + Math.cos(a) * 215,
      y: 250 + Math.sin(a) * 215,
      color: i % 2 === 0 ? '#0052FF' : '#FF4D4D',
    };
  });
  return (
    <svg viewBox="0 0 500 500" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <circle cx="250" cy="250" r="240" fill="none" stroke="#0052FF" strokeOpacity="0.6" strokeWidth="2" />
      <circle cx="250" cy="250" r="232" fill="none" stroke="#0052FF" strokeOpacity="0.25" strokeWidth="1" />
      <circle
        cx="250"
        cy="250"
        r="190"
        fill="none"
        stroke="#0052FF"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="3 8"
      />
      {apples.map((a, i) => (
        <g key={i}>
          <circle cx={a.x} cy={a.y} r="18" fill={a.color} opacity="0.85" />
          <circle cx={a.x - 5} cy={a.y - 6} r="5" fill="#ffffff" opacity="0.35" />
        </g>
      ))}
      <circle cx="250" cy="250" r="16" fill="#0a0a14" stroke="#0052FF" strokeWidth="2" />
      <circle cx="250" cy="250" r="5" fill="#0052FF" opacity="0.9" />
    </svg>
  );
}

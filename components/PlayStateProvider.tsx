'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Ctx = {
  isPlaying: boolean;
  setPlaying: (v: boolean) => void;
};

const PlayStateContext = createContext<Ctx>({ isPlaying: false, setPlaying: () => {} });

export function PlayStateProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setPlaying] = useState(false);
  const value = useMemo(() => ({ isPlaying, setPlaying }), [isPlaying]);
  return <PlayStateContext.Provider value={value}>{children}</PlayStateContext.Provider>;
}

export function usePlayState() {
  return useContext(PlayStateContext);
}

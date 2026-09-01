'use client';

import { create } from 'zustand';
import { DEFAULT_STYLE } from '@moduqr/renderer';
import type { PayloadType, QRStyle } from '@moduqr/shared';

interface Snapshot {
  readonly payloadType: PayloadType;
  readonly payload: string;
  readonly style: QRStyle;
  readonly presetId: string | null;
}

interface StudioState extends Snapshot {
  readonly past: readonly Snapshot[];
  readonly future: readonly Snapshot[];
  readonly setContent: (payloadType: PayloadType, payload: string) => void;
  readonly setStyle: (style: QRStyle, presetId?: string | null) => void;
  readonly patchStyle: (patch: Partial<QRStyle>) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly reset: () => void;
  readonly load: (snapshot: Snapshot) => void;
}

const initial: Snapshot = {
  payloadType: 'url',
  payload: 'https://example.com',
  style: DEFAULT_STYLE,
  presetId: null,
};

const snapshot = (state: StudioState): Snapshot => ({
  payloadType: state.payloadType,
  payload: state.payload,
  style: state.style,
  presetId: state.presetId,
});

const pushPast = (past: readonly Snapshot[], current: Snapshot): readonly Snapshot[] => [...past.slice(-99), current];

export const useStudioStore = create<StudioState>((set) => ({
  ...initial,
  past: [],
  future: [],
  setContent: (payloadType, payload) => set((state) => ({ payloadType, payload, past: pushPast(state.past, snapshot(state)), future: [] })),
  setStyle: (style, presetId = null) => set((state) => ({ style, presetId, past: pushPast(state.past, snapshot(state)), future: [] })),
  patchStyle: (patch) => set((state) => ({ style: { ...state.style, ...patch }, presetId: null, past: pushPast(state.past, snapshot(state)), future: [] })),
  undo: () => set((state) => {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { ...previous, past: state.past.slice(0, -1), future: [snapshot(state), ...state.future].slice(0, 100) };
  }),
  redo: () => set((state) => {
    const next = state.future[0];
    if (!next) return state;
    return { ...next, past: pushPast(state.past, snapshot(state)), future: state.future.slice(1) };
  }),
  reset: () => set((state) => ({ ...initial, past: pushPast(state.past, snapshot(state)), future: [] })),
  load: (loaded) => set((state) => ({ ...loaded, past: pushPast(state.past, snapshot(state)), future: [] })),
}));

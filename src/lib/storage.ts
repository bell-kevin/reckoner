// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

export type Theme = "auto" | "light" | "dark";

export interface SheetT {
  id: string;
  name: string;
  text: string;
  updated: number;
}

export interface PersistShape {
  sheets: SheetT[];
  activeId: string;
  theme: Theme;
}

const KEY = "reckoner.v1";

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function load(): PersistShape | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistShape;
    if (!Array.isArray(p.sheets) || p.sheets.length === 0) return null;
    return p;
  } catch {
    return null;
  }
}

export function save(p: PersistShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage full or unavailable (private mode) — the session still works
  }
}

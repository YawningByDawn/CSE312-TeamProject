import type { Save, Settings } from '../types';

// The run's one save, replaced at each dawn (an older day's is gone with it), and the player's settings.

const SAVE = 'hg.rb.save';
const SETTINGS = 'hg.rb.settings';

const DEFAULTS: Settings = { master: 1, music: 0.7, sfx: 0.8, ambience: 0.6, uiSize: 'medium', hints: true, seenHints: [] };

export function readSave(): Save | null {
  const raw = localStorage.getItem(SAVE);
  if (raw === null) return null;
  const save = JSON.parse(raw) as Save;
  return save.state.v === 2 ? save : null;
}

export const writeSave = (s: Save): void => localStorage.setItem(SAVE, JSON.stringify(s));
export const clearSave = (): void => localStorage.removeItem(SAVE);

export function readSettings(): Settings {
  const raw = localStorage.getItem(SETTINGS);
  return raw === null ? { ...DEFAULTS } : { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
}

export const writeSettings = (s: Settings): void => localStorage.setItem(SETTINGS, JSON.stringify(s));

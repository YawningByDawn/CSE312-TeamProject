/**
 * Every player-visible word, read with `uiText(key, slots)`. Keys are dotted (`place.grave.name`); each words file
 * under `words/` exports one flat table and this file joins them. Templates: `{name}` plain, `{^name}` first letter
 * capitalised, `{n|stone|stones}` picks by the number in slot `n` (the number itself is not printed).
 * Words are written already typeset (curly quotes, real dashes).
 */
import { AFTERMATH_WORDS } from './words/aftermath';
import { CALENDAR_WORDS } from './words/calendar';
import { CARD_WORDS } from './words/cards';
import { DISCOVERY_WORDS } from './words/discoveries';
import { EVENT_WORDS } from './words/events';
import { FEED_WORDS } from './words/feed';
import { GEM_WORDS } from './words/gems';
import { HUD_WORDS } from './words/hud';
import { PANEL_WORDS } from './words/panels';
import { NOTE_WORDS } from './words/notes';
import { PERSON_WORDS } from './words/people';
import { PLACE_WORDS } from './words/places';
import { REASON_WORDS } from './words/reasons';
import { ROLE_WORDS } from './words/roles';
import { STORY_WORDS } from './words/stories';
import { THREAT_WORDS } from './words/threats';

export type Slots = Readonly<Record<string, string | number>>;

const WORDS: Readonly<Record<string, string>> = {
  ...PLACE_WORDS, ...ROLE_WORDS, ...PERSON_WORDS, ...CARD_WORDS, ...GEM_WORDS, ...THREAT_WORDS,
  ...DISCOVERY_WORDS, ...CALENDAR_WORDS, ...NOTE_WORDS, ...STORY_WORDS, ...EVENT_WORDS, ...AFTERMATH_WORDS, ...FEED_WORDS,
  ...REASON_WORDS, ...HUD_WORDS, ...PANEL_WORDS,
};

const SLOT = /\{(\^?)([A-Za-z0-9_]+)(?:\|([^|{}]*)\|([^{}]*))?\}/g;

/** Whole numbers stay whole; others get one decimal. */
function num(n: number): string {
  return Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
}

/** The words under `key` with their slots filled. A key with no words, or a slot left unfilled, is a defect and throws. */
export function uiText(key: string, slots: Slots = {}): string {
  const tpl = WORDS[key];
  if (tpl === undefined) throw new Error(`uiText: no words for ${key}`);
  return tpl.replace(SLOT, (_whole, cap: string, name: string, one?: string, many?: string) => {
    const v = slots[name];
    if (v === undefined) throw new Error(`uiText: ${key} needs slot ${name}`);
    if (one !== undefined && many !== undefined) return Math.abs(Number(v)) === 1 ? one : many;
    const s = typeof v === 'number' ? num(v) : v;
    return cap ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  });
}

/** Whether `key` has words (for the check that every key in src exists). */
export function hasText(key: string): boolean {
  return key in WORDS;
}

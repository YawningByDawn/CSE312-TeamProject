import type { ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { PICKS, keyName, pickOf } from '../../content/keys';
import { FIRST_MINER } from '../../content/stats';
import { slab, verb } from './art';
import type { Ctx, Panel } from './index';

// The dawn's list (OVERHAUL): whom to possess for the day, the first miner always among them. Two columns of plates;
// the pick keys answer the first five, a click any.

const MAX = 12;
const COL = 290;
const ROW = 74;

export class Host implements Panel {
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    const s = vm.state;
    return !vm.title && !vm.film && s.phase === 'live' && !s.pending && this.c.q.picking(s) ? `host|${s.tick}` : null;
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const s = vm.state, q = this.c.q;
    const ids = q.hosts(s).slice(0, MAX);
    const h = 110 + Math.ceil(ids.length / 2) * ROW + 24;
    const { el, say } = slab(root, -320, -h / 2 - 40, 640, h, uiText('host.head'));
    ids.forEach((id, i) => {
      const p = s.people[id]!;
      const key = PICKS[i] ? `${keyName(vm.settings.keys[PICKS[i]!]?.[0] ?? '')}  ` : '';
      const sub = `${uiText('host.hp', { hp: Math.round(p.stats.hp), max: Math.round(q.maxHp(p)) })} · ${id === FIRST_MINER.id ? uiText('host.first') : uiText(`role.${p.role}.name`)}`;
      verb(el, 36 + (i % 2) * COL, 86 + Math.floor(i / 2) * ROW, COL - 12, ROW - 10, `${key}${p.name}`, '', () => this.c.act({ type: 'possess', unit: id }), say, sub);
    });
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    const ids = this.c.q.hosts(vm.state).slice(0, MAX);
    const i = pickOf(vm.settings, e, ids.length);
    if (i < 0) return false;
    this.c.act({ type: 'possess', unit: ids[i]! });
    return true;
  }
}

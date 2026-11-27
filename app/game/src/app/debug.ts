import type { Account, DebugApi, Net, Sim } from '../types';
import type { Input } from './input';
import type { Pump } from './pump';

/** `window.__hg`: the debug and test API over the one pump. */
export function installDebug(pump: Pump, sim: Sim, input: Input, net: Net | null, account: Account): void {
  const vm = pump.vm;
  const api: DebugApi = {
    app: { get time() { return vm.time; } },
    state: () => vm.state,
    act: (a) => pump.act(a),
    send: (i) => pump.send(i),
    ticks: (n) => pump.ticks(n),
    advance: (s) => pump.advance(s),
    camera: (c) => input.jump(c),
    legal: () => sim.legal(vm.state),
    show: (e) => pump.take([e]),
    ...(net && { net }),
    account,
  };
  Object.assign(window, { __hg: api });
}

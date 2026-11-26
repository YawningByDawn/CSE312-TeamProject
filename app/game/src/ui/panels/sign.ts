import type { Account } from '../../types';
import { uiText } from '../../content/text';
import { BLOOD, DIM, VIOLET, Words, attr, div, line, slab, verb } from './art';

// The login popup (the title's top right corner, a lobby's way in): a slab centred over a scrim, a username and a password,
// a plate to log in or register, and a line to switch between the two. The account does the asking; a refusal or an
// unreachable server shows in the line under the fields. It stands over the panels in a root of its own, so the title under it
// is not built again, and its keys are its own (Enter sends, Escape closes) while it is up.

const W = 480, H = 410;
const FIELD = { username: 20, password: 72 };

export class SignIn {
  private mode: 'login' | 'register' = 'login';
  constructor(private readonly account: Account, private readonly root: HTMLElement) {
    root.style.zIndex = '20';
  }

  /** Up now: the panels leave their keys to it. */
  get shown(): boolean {
    return this.root.hasChildNodes();
  }

  show(): void {
    this.build('');
  }

  private close(): void {
    this.root.replaceChildren();
  }

  private build(username: string): void {
    const register = this.mode === 'register';
    this.close();
    const scrim = div(this.root, 'hg-b hgp-slab', -1200, -700, 2400, 1400);
    scrim.style.background = 'rgba(0,0,0,0.62)';
    scrim.addEventListener('click', () => this.close());
    const { el } = slab(this.root, -W / 2, -H / 2, W, H, uiText(register ? 'account.register' : 'account.login'));
    el.tabIndex = -1;
    attr(el, 'role', 'dialog');
    const close = new Words(el, W - 120, 26, 18, DIM, 'right', 100);
    close.el.classList.add('hg-hit');
    close.set(uiText('account.close'));
    close.el.addEventListener('click', () => this.close());

    const field = (y: number, word: string, type: string, max: number, auto: AutoFill): HTMLInputElement => {
      new Words(el, 36, y, 12, DIM).set(uiText(word).toUpperCase());
      const f = el.appendChild(document.createElement('input'));
      f.className = 'hgp-seed';
      Object.assign(f.style, { left: '36px', top: `${y + 18}px`, width: `${W - 72}px`, fontSize: '20px' });
      f.type = type;
      f.maxLength = max;
      f.autocomplete = auto;
      f.autocapitalize = 'none';
      f.spellcheck = false;
      attr(f, 'aria-label', uiText(word));
      return f;
    };
    const user = field(80, 'account.user', 'text', FIELD.username, 'username');
    const pass = field(156, 'account.pass', 'password', FIELD.password, register ? 'new-password' : 'current-password');
    user.value = username;

    const msg = line(el, 36, 236, W - 72, 17, DIM, register ? uiText('account.rules') : '');
    const say = (text: string): void => {
      msg.textContent = text;
      msg.style.color = BLOOD;
    };
    let busy = false;
    const go = (): void => {
      if (busy) return;
      busy = true;
      this.account.signIn(this.mode, user.value, pass.value).then(
        (why) => { if (why !== null) { busy = false; say(why); } },
        () => { busy = false; say(uiText('account.offline')); },
      );
    };
    verb(el, 36, 300, W - 72, 56, uiText(register ? 'account.register' : 'account.login'), '', go, () => undefined);
    const other = new Words(el, 0, 372, 17, VIOLET, 'center', W);
    other.el.classList.add('hg-hit');
    other.set(uiText(register ? 'account.toLogin' : 'account.toRegister'));
    other.el.addEventListener('click', () => {
      this.mode = register ? 'login' : 'register';
      this.build(user.value);
    });

    // while it is up no key reaches the game under it
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') go();
      else if (e.key === 'Escape') this.close();
    });
    (username ? pass : user).focus();
  }
}

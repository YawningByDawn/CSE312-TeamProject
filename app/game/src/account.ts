import type { Account } from './types';

// The framework's login: the auth service answers `/register`, `/login` and `/logout` (POST, JSON; nginx routes them).

export function makeAccount(): Account {
  return {
    name: null,
    signIn: async (mode, username, password) => {
      const post = (to: string): Promise<Response> => fetch(to, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      let r = await post(`/${mode}`);
      if (r.ok && mode === 'register') r = await post('/login');
      if (r.ok) {
        location.reload();
        return null;
      }
      // the auth service answers a refusal as `{ error }`; anything else is not it
      if (r.headers.get('Content-Type')?.includes('json')) return ((await r.json()) as { error: string }).error;
      throw new Error(`${r.status}`);
    },
    logOut: () => void fetch('/logout', { method: 'POST' }).then(() => location.reload()),
  };
}

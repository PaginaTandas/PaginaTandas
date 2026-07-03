const TOKEN_KEY = 'mis_tandas_token';
const REFRESH_KEY = 'mis_tandas_refresh';
const AUTH_DOMAIN = '@paginatandas.internal';

export function usernameToEmail(user) {
  const name = user.trim().toLowerCase();
  if (!name) return '';
  if (name.includes('@')) return name;
  return `${name}${AUTH_DOMAIN}`;
}

export function isAuthenticated() {
  return !!sessionStorage.getItem(TOKEN_KEY);
}

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export async function signIn(cfg, user, pass) {
  const email = usernameToEmail(user);
  if (!email || !pass) return false;

  const res = await fetch(`${cfg.sync.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: cfg.sync.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password: pass })
  });

  if (!res.ok) return false;

  const data = await res.json();
  sessionStorage.setItem(TOKEN_KEY, data.access_token);
  sessionStorage.setItem(REFRESH_KEY, data.refresh_token);
  return true;
}

export async function refreshSession(cfg) {
  const refresh = sessionStorage.getItem(REFRESH_KEY);
  if (!refresh) return false;

  const res = await fetch(`${cfg.sync.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: cfg.sync.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: refresh })
  });

  if (!res.ok) {
    signOut();
    return false;
  }

  const data = await res.json();
  sessionStorage.setItem(TOKEN_KEY, data.access_token);
  sessionStorage.setItem(REFRESH_KEY, data.refresh_token);
  return true;
}

export function signOut() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

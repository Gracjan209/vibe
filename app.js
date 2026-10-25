(() => {
'use strict';

const API = 'https://api.spotify.com/v1';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative'
].join(' ');
const REDIRECT = location.origin + location.pathname;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------- Icons ---------- */
const ICONS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
  next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  prev: 'M6 6h2v12H6zM9.5 12l8.5 6V6z',
  shuffle: 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
  repeat1: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z',
  list: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  palette: 'M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.4c2.2 0 4-1.8 4-4 0-4.4-4.5-7.5-9.4-7.5zM6.5 12a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
  note: 'M12 3v10.55A4 4 0 1014 17V7h4V3h-6z'
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;
const setIcon = (el, n) => { el.innerHTML = icon(n); };
$$('[data-i]').forEach(el => setIcon(el, el.dataset.i));

/* ---------- Themen ---------- */
const THEMES = [
  { id: 'glass',  name: 'Liquid Glass', desc: 'Durchscheinendes Glas mit Glanz', color: '#0b1030' },
  { id: 'neon',   name: 'Neon Cyber',   desc: 'Dunkel mit Cyan- und Pink-Glow',  color: '#05010d' },
  { id: 'sunset', name: 'Sunset',       desc: 'Warmer Farbverlauf, weich',       color: '#ff5e7e' },
  { id: 'amoled', name: 'AMOLED Minimal', desc: 'Reines Schwarz, spart Akku',    color: '#000000' }
];

function setTheme(id) {
  if (!THEMES.some(t => t.id === id)) id = 'glass';
  document.documentElement.dataset.theme = id;
  ls.set('theme', id);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = THEMES.find(t => t.id === id).color;
  $$('.theme').forEach(b => b.classList.toggle('active', b.dataset.id === id));
}

function buildThemes() {
  const grid = $('#themeGrid');
  grid.textContent = '';
  THEMES.forEach(t => {
    const b = document.createElement('button');
    b.className = 'glass theme';
    b.dataset.id = t.id;
    b.innerHTML = `<div class="swatch sw-${t.id}"></div>`;
    const n = document.createElement('b'); n.textContent = t.name;
    const d = document.createElement('small'); d.textContent = t.desc;
    b.append(n, d);
    b.addEventListener('click', () => setTheme(t.id));
    grid.append(b);
  });
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

/* ---------- Auth (PKCE) ---------- */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function login() {
  const id = $('#clientId').value.trim();
  if (!id) { toast('Bitte zuerst die Client ID eintragen'); return; }
  ls.set('client_id', id);
  const verifier = b64u(crypto.getRandomValues(new Uint8Array(48)));
  ls.set('verifier', verifier);
  const challenge = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const p = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: REDIRECT,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });
  location.href = 'https://accounts.spotify.com/authorize?' + p;
}

async function tokenRequest(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!r.ok) throw new Error('token');
  const t = await r.json();
  ls.set('access', t.access_token);
  if (t.refresh_token) ls.set('refresh', t.refresh_token);
  ls.set('expires', String(Date.now() + t.expires_in * 1000 - 30000));
}

async function handleCallback() {
  const q = new URLSearchParams(location.search);
  if (q.get('error')) {
    history.replaceState({}, '', REDIRECT);
    toast('Anmeldung abgebrochen');
    return;
  }
  const code = q.get('code');
  if (!code) return;
  history.replaceState({}, '', REDIRECT);
  try {
    await tokenRequest(new URLSearchParams({
      client_id: ls.get('client_id') || '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      code_verifier: ls.get('verifier') || ''
    }));
  } catch (e) {
    toast('Anmeldung fehlgeschlagen. Prüfe Client ID und Redirect URI.');
  }
}

async function getToken() {
  if (Date.now() > Number(ls.get('expires') || 0)) {
    const rt = ls.get('refresh');
    if (!rt) return null;
    try {
      await tokenRequest(new URLSearchParams({
        client_id: ls.get('client_id') || '',
        grant_type: 'refresh_token',
        refresh_token: rt
      }));
    } catch (e) { logout(); return null; }
  }
  return ls.get('access');
}

function logout() {
  ['access', 'refresh', 'expires', 'verifier'].forEach(ls.del);
  location.href = REDIRECT;
}

async function api(path, opts = {}) {
  const token = await getToken();
  if (!token) throw Object.assign(new Error('auth'), { status: 401 });
  const r = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (r.status === 204 || r.status === 202) return null;
  if (r.status === 401) { logout(); throw Object.assign(new Error('auth'), { status: 401 }); }
  if (!r.ok) {
    let m = '';
    try { m = (await r.json()).error.message; } catch (e) {}
    throw Object.assign(new Error(m || String(r.status)), { status: r.status });
  }
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

/* ---------- Player ---------- */
let st = null;
let lastSync = 0;
let dragging = false;
let lastCover = '';

const fmt = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

async function poll() {
  try {
    st = await api('/me/player');
    lastSync = Date.now();
    render();
  } catch (e) {
    if (e.status && e.status !== 401) console.warn(e);
  }
}

function render() {
  const item = st && st.item;
  const playing = !!(st && st.is_playing);
  setIcon($('#bPlay'), playing ? 'pause' : 'play');

  if (!item) {
    $('#title').textContent = 'Nichts spielt gerade';
    $('#artist').textContent = 'Starte einen Song in der Spotify-App';
    $('#device').textContent = '';
    $('#cover').hidden = true;
    $('#coverEmpty').hidden = false;
    $('#bg-cover').style.backgroundImage = '';
    lastCover = '';
    return;
  }

  const imgs = (item.album && item.album.images) || item.images || [];
  const url = imgs.length ? imgs[0].url : '';
  $('#title').textContent = item.name;
  $('#artist').textContent = item.artists
    ? item.artists.map(a => a.name).join(', ')
    : (item.show ? item.show.name : '');
  if (url !== lastCover) {
    lastCover = url;
    $('#cover').src = url;
    $('#bg-cover').style.backgroundImage = url ? `url("${url}")` : '';
  }
  $('#cover').hidden = !url;
  $('#coverEmpty').hidden = !!url;
  $('#tEnd').textContent = fmt(item.duration_ms);
  $('#device').textContent = st.device ? 'Läuft auf: ' + st.device.name : '';

  $('#bShuffle').classList.toggle('on', !!st.shuffle_state);
  const rep = st.repeat_state || 'off';
  $('#bRepeat').classList.toggle('on', rep !== 'off');
  setIcon($('#bRepeat'), rep === 'track' ? 'repeat1' : 'repeat');
}

function tick() {
  if (!st || !st.item || dragging) return;
  const dur = st.item.duration_ms;
  let pos = st.progress_ms + (st.is_playing ? Date.now() - lastSync : 0);
  pos = Math.min(pos, dur);
  const seek = $('#seek');
  seek.value = Math.round(pos / dur * 1000);
  seek.style.setProperty('--p', (pos / dur * 100) + '%');
  $('#tNow').textContent = fmt(pos);
}

async function cmd(path, method = 'PUT', body) {
  try {
    await api(path, { method, body });
    setTimeout(poll, 350);
  } catch (e) {
    if (e.status === 404) toast('Kein aktives Gerät. Öffne Spotify und starte kurz einen Song.');
    else if (e.status === 403) toast('Das geht nur mit Spotify Premium.');
    else if (e.status === 429) toast('Zu viele Anfragen. Kurz warten.');
    else toast('Fehler: ' + e.message);
  }
}

function bindPlayer() {
  $('#bPlay').addEventListener('click', () => {
    const playing = st && st.is_playing;
    if (st) { st.is_playing = !playing; st.progress_ms = st.progress_ms || 0; lastSync = Date.now(); render(); }
    cmd(playing ? '/me/player/pause' : '/me/player/play');
  });
  $('#bNext').addEventListener('click', () => cmd('/me/player/next', 'POST'));
  $('#bPrev').addEventListener('click', () => cmd('/me/player/previous', 'POST'));
  $('#bShuffle').addEventListener('click', () => {
    const on = !(st && st.shuffle_state);
    if (st) { st.shuffle_state = on; render(); }
    cmd('/me/player/shuffle?state=' + on);
  });
  $('#bRepeat').addEventListener('click', () => {
    const order = ['off', 'context', 'track'];
    const cur = (st && st.repeat_state) || 'off';
    const next = order[(order.indexOf(cur) + 1) % 3];
    if (st) { st.repeat_state = next; render(); }
    cmd('/me/player/repeat?state=' + next);
  });

  const seek = $('#seek');
  seek.addEventListener('input', () => {
    dragging = true;
    if (st && st.item) {
      const pos = seek.value / 1000 * st.item.duration_ms;
      $('#tNow').textContent = fmt(pos);
      seek.style.setProperty('--p', (seek.value / 10) + '%');
    }
  });
  seek.addEventListener('change', () => {
    if (st && st.item) {
      const pos = Math.round(seek.value / 1000 * st.item.duration_ms);
      st.progress_ms = pos; lastSync = Date.now();
      cmd('/me/player/seek?position_ms=' + pos);
    }
    dragging = false;
  });
}

/* ---------- Playlists ---------- */
let listsLoaded = false;
async function loadLists() {
  if (listsLoaded) return;
  const grid = $('#grid');
  grid.textContent = '';
  try {
    const data = await api('/me/playlists?limit=50');
    const items = (data.items || []).filter(Boolean);
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'muted empty-note';
      p.textContent = 'Keine Playlists gefunden.';
      grid.append(p);
    }
    items.forEach(pl => {
      const b = document.createElement('button');
      b.className = 'glass pl';
      if (pl.images && pl.images[0]) {
        const img = document.createElement('img');
        img.src = pl.images[0].url; img.alt = ''; img.loading = 'lazy';
        b.append(img);
      } else {
        const ph = document.createElement('div'); ph.className = 'ph'; b.append(ph);
      }
      const n = document.createElement('span'); n.textContent = pl.name;
      b.append(n);
      b.addEventListener('click', () => openPlaylist(pl));
      grid.append(b);
    });
    listsLoaded = true;
  } catch (e) {
    const p = document.createElement('p');
    p.className = 'muted empty-note';
    p.textContent = 'Playlists konnten nicht geladen werden.';
    grid.append(p);
  }
}

/* ---------- Playlist-Detail (Songliste) ---------- */
async function fetchTracks(id, offset) {
  try {
    return await api('/playlists/' + id + '/items?limit=100&offset=' + offset);
  } catch (e) {
    if (e.status === 401) throw e;
    return await api('/playlists/' + id + '/tracks?limit=100&offset=' + offset);
  }
}

function closePlaylist() {
  const det = $('#detail');
  if (det) det.remove();
  $('#grid').hidden = false;
  $('#view-lists .page-title').hidden = false;
  $('#view-lists').scrollTop = 0;
}

async function openPlaylist(pl) {
  const view = $('#view-lists');
  $('#grid').hidden = true;
  $('#view-lists .page-title').hidden = true;
  const old = $('#detail'); if (old) old.remove();

  const det = document.createElement('div');
  det.id = 'detail';
  const back = document.createElement('button');
  back.className = 'chip back';
  back.textContent = '← Playlists';
  back.addEventListener('click', closePlaylist);
  const h = document.createElement('h2');
  h.className = 'page-title';
  h.textContent = pl.name;
  const all = document.createElement('button');
  all.className = 'primary';
  all.textContent = 'Von vorn abspielen';
  all.addEventListener('click', async () => {
    await cmd('/me/player/play', 'PUT', { context_uri: pl.uri });
    showView('view-player');
  });
  const list = document.createElement('div');
  list.className = 'tracks';
  const info = document.createElement('p');
  info.className = 'muted empty-note';
  info.textContent = 'Lade Songs…';
  list.append(info);
  det.append(back, h, all, list);
  view.append(det);
  view.scrollTop = 0;

  try {
    let tracks = [];
    for (let offset = 0; offset < 500; offset += 100) {
      const data = await fetchTracks(pl.id, offset);
      const batch = (data.items || []).map(it => it && (it.item || it.track)).filter(t => t && t.uri);
      tracks = tracks.concat(batch);
      if (!data.next) break;
    }
    list.textContent = '';
    if (!tracks.length) { info.textContent = 'Keine Songs gefunden.'; list.append(info); return; }
    tracks.forEach((t, i) => {
      const row = document.createElement('button');
      row.className = 'glass track';
      const num = document.createElement('i'); num.textContent = String(i + 1);
      const box = document.createElement('div');
      const name = document.createElement('b'); name.textContent = t.name;
      const art = document.createElement('small');
      art.textContent = (t.artists || []).map(a => a.name).join(', ');
      box.append(name, art);
      row.append(num, box);
      row.addEventListener('click', async () => {
        await cmd('/me/player/play', 'PUT', { context_uri: pl.uri, offset: { uri: t.uri } });
        showView('view-player');
      });
      list.append(row);
    });
  } catch (e) {
    list.textContent = '';
    info.textContent = 'Songs konnten nicht geladen werden' + (e.message ? ' (' + e.message + ')' : '') + '.';
    list.append(info);
  }
}

/* ---------- Navigation ---------- */
function showView(id) {
  ['view-player', 'view-lists', 'view-themes'].forEach(v => { $('#' + v).hidden = v !== id; });
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === id));
  if (id === 'view-lists') loadLists();
}

/* ---------- Start ---------- */
async function init() {
  buildThemes();
  setTheme(ls.get('theme') || 'glass');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  await handleCallback();

  $('#redirectUri').textContent = REDIRECT;
  $('#clientId').value = ls.get('client_id') || '';
  $('#loginBtn').addEventListener('click', login);
  $('#logoutBtn').addEventListener('click', logout);
  $('#copyBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(REDIRECT); toast('Adresse kopiert'); }
    catch (e) { toast('Bitte die Adresse von Hand markieren und kopieren'); }
  });

  const loggedIn = !!ls.get('refresh');
  if (!loggedIn) {
    ['view-player', 'view-lists', 'view-themes'].forEach(v => { $('#' + v).hidden = true; });
    $('#login').hidden = false;
    return;
  }

  $('#tabbar').hidden = false;
  $$('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
  bindPlayer();
  poll();
  setInterval(poll, 4000);
  setInterval(tick, 500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
}

init();
})();

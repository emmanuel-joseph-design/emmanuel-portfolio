const API_VERSION = '2022-11-28';
const SESSION_COOKIE = '__Host-portfolio_cms';
const STATE_COOKIE = '__Host-portfolio_oauth_state';
const PROJECT_CATEGORIES = new Set(['Brand', 'Marketing', 'Product']);
const MEDIA_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});
const text = (value, status = 200) => new Response(value, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
const encode = (value) => new TextEncoder().encode(value);
const decode = (value) => new TextDecoder().decode(value);
const bytesToBase64 = (bytes) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};
const base64ToBytes = (value) => {
  const binary = atob(value.replace(/\s/g, ''));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
const base64url = (bytes) => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64url = (value) => base64ToBytes(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
const randomValue = (length = 32) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
};
const extension = (filename) => filename.slice(filename.lastIndexOf('.')).toLowerCase();
const cookieValue = (request, name) => {
  const cookies = request.headers.get('cookie') || '';
  for (const cookie of cookies.split(';')) {
    const [key, ...value] = cookie.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
};
const cookie = (name, value, maxAge) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const safeError = (error) => {
  if (error instanceof HttpError) return error;
  console.error(error);
  return new HttpError(500, 'The CMS could not complete that request. Please retry.');
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function encryptionKey(secret) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const digest = await crypto.subtle.digest('SHA-256', encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealSession(payload, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(secret), encode(JSON.stringify(payload)));
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv); combined.set(new Uint8Array(encrypted), iv.length);
  return base64url(combined);
}

export async function openSession(value, secret) {
  try {
    const combined = fromBase64url(value);
    if (combined.length < 29) return null;
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.subarray(0, 12) }, await encryptionKey(secret), combined.subarray(12));
    const session = JSON.parse(decode(new Uint8Array(decrypted)));
    if (!session.token || !session.login || !session.csrf || session.expiresAt < Date.now()) return null;
    return session;
  } catch { return null; }
}

function mediaPath(value, required = false) {
  if (!value && !required) return '';
  if (typeof value !== 'string' || !/^\/media\/cms\/[a-zA-Z0-9-]+\.(?:png|jpe?g|webp|gif|mp4|webm)$/.test(value)) throw new HttpError(400, 'One of the project media paths is invalid.');
  return value;
}

export function videoSource(value, required = false) {
  if (!value && !required) return '';
  if (typeof value !== 'string') throw new HttpError(400, 'Enter a valid YouTube or Vimeo link.');
  if (/^\/media\/cms\/[a-zA-Z0-9-]+\.(?:mp4|webm)$/.test(value)) return value;
  let url;
  try { url = new URL(value); } catch { throw new HttpError(400, 'Enter a valid YouTube or Vimeo link.'); }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
  if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]+)/)?.[1] || '';
  }
  if (/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === 'vimeo.com') id = url.pathname.split('/').filter(Boolean)[0] || '';
  if (host === 'player.vimeo.com') id = url.pathname.match(/^\/video\/(\d+)/)?.[1] || '';
  if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  throw new HttpError(400, 'Use a valid YouTube or Vimeo video link.');
}

export function validateProject(value, { requireMedia = false } = {}) {
  if (!value || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug || '') || value.slug.length > 100) throw new HttpError(400, 'Choose a URL name using lowercase letters, numbers, and hyphens.');
  if (typeof value.title !== 'string' || !value.title.trim()) throw new HttpError(400, 'Enter a project title.');
  if (!Number.isInteger(value.year) || value.year < 1900 || value.year > 2200) throw new HttpError(400, 'Enter a valid year.');
  if (!Number.isInteger(value.order)) throw new HttpError(400, 'Display order must be a whole number.');
  if (!Array.isArray(value.categories) || value.categories.some((category) => !PROJECT_CATEGORIES.has(category))) throw new HttpError(400, 'Choose only the available project categories.');
  if (!Array.isArray(value.sections) || value.sections.length > 100) throw new HttpError(400, 'The project contains an invalid number of sections.');
  const project = {
    slug: value.slug,
    title: value.title.trim().slice(0, 250),
    description: String(value.description ?? '').slice(0, 20000),
    client: String(value.client ?? '').slice(0, 500),
    role: String(value.role ?? '').slice(0, 500),
    credits: String(value.credits ?? '').slice(0, 5000),
    year: value.year,
    order: value.order,
    categories: [...new Set(value.categories)],
    cover_image: mediaPath(value.cover_image, requireMedia),
    published: Boolean(value.published),
    sections: value.sections.map((section, order) => {
      if (!['full-image', 'double-image', 'video'].includes(section?.type)) throw new HttpError(400, 'Choose a valid gallery section type.');
      const expected = section.type === 'double-image' ? 2 : 1;
      if (!Array.isArray(section.assets) || section.assets.length !== expected) throw new HttpError(400, 'A gallery section has the wrong number of files.');
      const assets = section.assets.map((asset) => section.type === 'video' || (section.type === 'double-image' && typeof asset === 'string' && /^https?:\/\//.test(asset)) ? videoSource(asset, requireMedia) : mediaPath(asset, requireMedia));
      for (const asset of assets.filter(Boolean)) {
        const embedded = asset.startsWith('https://');
        const localVideo = MEDIA_TYPES[extension(asset)]?.startsWith('video/');
        if (section.type === 'video' ? !(embedded || localVideo) : section.type === 'double-image' ? localVideo : embedded || localVideo) throw new HttpError(400, 'Choose the correct image or video type for each section.');
      }
      const layout = {};
      if (section.aspectRatio !== undefined) {
        if (typeof section.aspectRatio !== 'number' || !Number.isFinite(section.aspectRatio) || section.aspectRatio < 0.1 || section.aspectRatio > 10) throw new HttpError(400, 'Invalid media layout.');
        layout.aspectRatio = section.aspectRatio;
      }
      if (section.imageFit !== undefined) {
        if (!['contain', 'cover'].includes(section.imageFit)) throw new HttpError(400, 'Invalid media layout.');
        layout.imageFit = section.imageFit;
      }
      return { id: String(section.id || crypto.randomUUID()), type: section.type, assets, order, ...layout };
    }),
  };
  if (project.cover_image && MEDIA_TYPES[extension(project.cover_image)].startsWith('video/')) throw new HttpError(400, 'The project cover must be an image.');
  return project;
}

function validUpload(bytes, ext) {
  if (ext === '.png') return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
  if (ext === '.jpg' || ext === '.jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (ext === '.gif') return /^GIF8[79]a/.test(decode(bytes.subarray(0, 6)));
  if (ext === '.webp') return decode(bytes.subarray(0, 4)) === 'RIFF' && decode(bytes.subarray(8, 12)) === 'WEBP';
  if (ext === '.mp4') return decode(bytes.subarray(4, 8)) === 'ftyp';
  if (ext === '.webm') return bytes.length >= 4 && [26,69,223,163].every((byte, index) => bytes[index] === byte);
  return false;
}

async function github(env, token, endpoint, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json', authorization: `Bearer ${token}`,
      'x-github-api-version': API_VERSION, 'user-agent': 'emmanuel-portfolio-cms',
      ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 404 ? 'The CMS cannot access the required repository. Check the GitHub App installation.' : body.message || `GitHub request failed (${response.status}).`;
    const error = new HttpError(response.status === 404 ? 503 : 502, message);
    error.githubStatus = response.status;
    throw error;
  }
  return body;
}

const repositoryEndpoint = (env, repo, endpoint = '') => `/repos/${env.GITHUB_OWNER}/${repo}${endpoint}`;
const contentEndpoint = (env, repo, path) => repositoryEndpoint(env, repo, `/contents/${path.split('/').map(encodeURIComponent).join('/')}`);

async function getContent(env, token, repo, path, fresh = false) {
  const refresh = fresh ? `&_cms_read=${crypto.randomUUID()}` : '';
  return github(env, token, `${contentEndpoint(env, repo, path)}?ref=main${refresh}`, {
    cache: 'no-store', headers: { 'cache-control': 'no-cache' },
  });
}

async function maybeContent(env, token, repo, path, fresh = false) {
  try { return await getContent(env, token, repo, path, fresh); }
  catch (error) { if (error instanceof HttpError && error.status === 503) return null; throw error; }
}

async function putContent(env, token, repo, path, bytes, message, expectedSha) {
  const content = bytesToBase64(bytes);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await maybeContent(env, token, repo, path, true);
    // A previous request may have succeeded even if its response was interrupted.
    if (existing?.content?.replace(/\s/g, '') === content) return { content: { sha: existing.sha } };
    if (expectedSha !== undefined && expectedSha !== (existing?.sha ?? null)) {
      throw new HttpError(409, 'This draft changed in another tab or session. Your edits are still open and have not been overwritten. Keep a copy of your changes before reopening the latest draft.');
    }
    try {
      return await github(env, token, contentEndpoint(env, repo, path), {
        method: 'PUT',
        body: JSON.stringify({ message, content, branch: 'main', ...(existing?.sha ? { sha: existing.sha } : {}) }),
      });
    } catch (error) {
      if (!(error instanceof HttpError) || error.githubStatus !== 409) throw error;
      if (attempt === 2) throw new HttpError(409, 'GitHub is receiving another update. Your edits are still open. Please try Save Draft again.');
    }
  }
}

async function listProjects(env, token) {
  await github(env, token, repositoryEndpoint(env, env.CONTENT_REPO));
  let entries;
  try { entries = await github(env, token, `${contentEndpoint(env, env.CONTENT_REPO, 'projects')}?ref=main`); }
  catch (error) { if (error instanceof HttpError && error.status === 503) return []; throw error; }
  if (!Array.isArray(entries)) return [];
  const projects = await Promise.all(entries.filter((entry) => entry.type === 'file' && entry.name.endsWith('.json')).map(async (entry) => {
    const file = await getContent(env, token, env.CONTENT_REPO, `projects/${entry.name}`);
    return { ...JSON.parse(decode(base64ToBytes(file.content))), revision: file.sha };
  }));
  return projects.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (b.year ?? 0) - (a.year ?? 0));
}

async function readPrivateMedia(env, token, publicPath) {
  const filename = publicPath.split('/').pop();
  if (!/^[a-zA-Z0-9-]+\.(?:png|jpe?g|webp|gif|mp4|webm)$/.test(filename || '')) throw new HttpError(400, 'Invalid media request.');
  const file = await getContent(env, token, env.CONTENT_REPO, `media/${filename}`);
  return { bytes: base64ToBytes(file.content), contentType: MEDIA_TYPES[extension(filename)] };
}

async function publicCommit(env, token, project) {
  const ref = await github(env, token, repositoryEndpoint(env, env.SITE_REPO, '/git/ref/heads/main'));
  const parent = await github(env, token, repositoryEndpoint(env, env.SITE_REPO, `/git/commits/${ref.object.sha}`));
  const published = { ...validateProject(project), id: project.slug, published: Boolean(project.published) };
  const tree = [];
  const projectBlob = await github(env, token, repositoryEndpoint(env, env.SITE_REPO, '/git/blobs'), {
    method: 'POST', body: JSON.stringify({ content: JSON.stringify(published, null, 2) + '\n', encoding: 'utf-8' }),
  });
  tree.push({ path: `content/projects/${project.slug}.json`, mode: '100644', type: 'blob', sha: projectBlob.sha });
  if (project.published) {
    const assets = [...new Set([project.cover_image, ...project.sections.flatMap((section) => section.assets)])].filter((asset) => typeof asset === 'string' && asset.startsWith('/media/'));
    for (const publicPath of assets) {
      const filename = publicPath.split('/').pop();
      const privateFile = await getContent(env, token, env.CONTENT_REPO, `media/${filename}`);
      const blob = await github(env, token, repositoryEndpoint(env, env.SITE_REPO, '/git/blobs'), {
        method: 'POST', body: JSON.stringify({ content: privateFile.content.replace(/\s/g, ''), encoding: 'base64' }),
      });
      tree.push({ path: `public/media/cms/${filename}`, mode: '100644', type: 'blob', sha: blob.sha });
    }
  }
  const nextTree = await github(env, token, repositoryEndpoint(env, env.SITE_REPO, '/git/trees'), {
    method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree }),
  });
  const commit = await github(env, token, repositoryEndpoint(env, env.SITE_REPO, '/git/commits'), {
    method: 'POST', body: JSON.stringify({ message: `CMS: ${project.published ? 'Publish' : 'Unpublish'} ${project.slug}`, tree: nextTree.sha, parents: [ref.object.sha] }),
  });
  await github(env, token, repositoryEndpoint(env, env.SITE_REPO, '/git/refs/heads/main'), {
    method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return commit.sha;
}

async function publicCommitWithRetry(env, token, project, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await publicCommit(env, token, project); }
    catch (error) {
      lastError = error;
      if (!(error instanceof HttpError) || ![409, 422, 502].includes(error.githubStatus ?? error.status)) throw error;
    }
  }
  throw new HttpError(409, 'Another publication is being finalized. Your draft is safe. Please wait a moment, refresh the CMS, and try publishing again.');
}

async function sessionFor(request, env) {
  const session = await openSession(cookieValue(request, SESSION_COOKIE), env.SESSION_SECRET);
  if (!session || session.login.toLowerCase() !== env.ALLOWED_LOGIN.toLowerCase()) throw new HttpError(401, 'Sign in with the authorized GitHub account.');
  return session;
}

function requireCsrf(request, session) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('x-cms-csrf') !== session.csrf) throw new HttpError(403, 'Refresh the CMS before saving again.');
}

async function requestJson(request, maximumBytes = 30 * 1024 * 1024) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maximumBytes) throw new HttpError(413, 'The selected file is too large.');
  const body = await request.arrayBuffer();
  if (body.byteLength > maximumBytes) throw new HttpError(413, 'The selected file is too large.');
  try { return JSON.parse(decode(new Uint8Array(body))); }
  catch { throw new HttpError(400, 'The CMS sent an invalid request.'); }
}

function securityHeaders(headers) {
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('content-security-policy', "default-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' blob:; media-src 'self' blob:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://github.com");
  return headers;
}

async function handleAuth(request, env, url) {
  if (url.pathname === '/auth/login') {
    const state = randomValue();
    const callback = `${url.origin}/auth/callback`;
    const target = new URL('https://github.com/login/oauth/authorize');
    target.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    target.searchParams.set('redirect_uri', callback);
    target.searchParams.set('state', state);
    return new Response(null, { status: 302, headers: { location: target.toString(), 'set-cookie': cookie(STATE_COOKIE, state, 600) } });
  }
  if (url.pathname === '/auth/callback') {
    const state = cookieValue(request, STATE_COOKIE);
    if (!state || state !== url.searchParams.get('state') || !url.searchParams.get('code')) throw new HttpError(400, 'GitHub authorization could not be verified. Please start again.');
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: `${url.origin}/auth/callback` }),
    });
    const result = await response.json();
    if (!response.ok || !result.access_token) throw new HttpError(502, 'GitHub did not complete authorization. Please retry.');
    const user = await github(env, result.access_token, '/user');
    if (user.login.toLowerCase() !== env.ALLOWED_LOGIN.toLowerCase()) throw new HttpError(403, `This CMS is restricted to ${env.ALLOWED_LOGIN}.`);
    const session = await sealSession({ token: result.access_token, login: user.login, csrf: randomValue(), expiresAt: Date.now() + 8 * 60 * 60 * 1000 }, env.SESSION_SECRET);
    const headers = new Headers({ location: '/' });
    headers.append('set-cookie', cookie(SESSION_COOKIE, session, 8 * 60 * 60));
    headers.append('set-cookie', cookie(STATE_COOKIE, '', 0));
    return new Response(null, { status: 302, headers });
  }
  if (url.pathname === '/auth/logout') {
    return new Response(null, { status: 302, headers: { location: '/', 'set-cookie': cookie(SESSION_COOKIE, '', 0) } });
  }
  throw new HttpError(404, 'Not found.');
}

async function handleApi(request, env, url) {
  const session = await sessionFor(request, env);
  if (request.method !== 'GET') requireCsrf(request, session);
  if (request.method === 'GET' && url.pathname === '/api/me') return json({ login: session.login, csrf: session.csrf, siteUrl: env.SITE_URL });
  if (request.method === 'GET' && url.pathname === '/api/projects') return json(await listProjects(env, session.token));
  if (request.method === 'GET' && url.pathname.startsWith('/api/media/')) {
    const media = await readPrivateMedia(env, session.token, `/media/cms/${url.pathname.slice('/api/media/'.length)}`);
    return new Response(media.bytes, { headers: { 'content-type': media.contentType, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' } });
  }
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  const body = await requestJson(request);
  if (url.pathname === '/api/save') {
    const project = validateProject(body);
    if (body.revision !== undefined && body.revision !== null && !/^[a-f0-9]{40}$/.test(body.revision)) throw new HttpError(400, 'Invalid draft revision.');
    const saved = await putContent(env, session.token, env.CONTENT_REPO, `projects/${project.slug}.json`, encode(JSON.stringify(project, null, 2) + '\n'), `CMS: Save draft ${project.slug}`, body.revision);
    return json({ message: 'Draft saved privately on GitHub.', revision: saved.content.sha });
  }
  if (url.pathname === '/api/upload') {
    const ext = extension(String(body.name || ''));
    if (!MEDIA_TYPES[ext]?.startsWith('image/') || typeof body.data !== 'string') throw new HttpError(400, 'Use JPG, PNG, WebP, or GIF image files. Add videos by pasting a YouTube or Vimeo link.');
    const bytes = base64ToBytes(body.data);
    const limit = 10;
    if (!bytes.length || bytes.length > limit * 1024 * 1024) throw new HttpError(413, `The file must be smaller than ${limit} MB.`);
    if (!validUpload(bytes, ext)) throw new HttpError(400, 'This file does not match its image or video extension.');
    const filename = `${crypto.randomUUID()}${ext}`;
    await putContent(env, session.token, env.CONTENT_REPO, `media/${filename}`, bytes, `CMS: Upload ${filename}`);
    return json({ url: `/media/cms/${filename}` });
  }
  if (url.pathname === '/api/publish') {
    const projectFile = await getContent(env, session.token, env.CONTENT_REPO, `projects/${body.slug}.json`);
    const project = validateProject(JSON.parse(decode(base64ToBytes(projectFile.content))), { requireMedia: Boolean(body.published) });
    project.published = Boolean(body.published);
    await publicCommitWithRetry(env, session.token, project);
    let warning = '';
    try {
      await putContent(env, session.token, env.CONTENT_REPO, `projects/${project.slug}.json`, encode(JSON.stringify(project, null, 2) + '\n'), `CMS: Mark ${project.published ? 'published' : 'unpublished'} ${project.slug}`);
    } catch (error) {
      console.error('Public repository updated but private publication status did not sync.', error);
      warning = ' The website update was sent successfully, but the private status could not be synchronized. Refresh before retrying.';
    }
    return json({ message: `${project.published ? 'Published' : 'Unpublished'}. GitHub Pages is rebuilding the portfolio.${warning}`, deploymentUrl: `https://github.com/${env.GITHUB_OWNER}/${env.SITE_REPO}/actions/workflows/pages.yml`, warning: Boolean(warning) });
  }
  throw new HttpError(404, 'Not found.');
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      let response;
      if (url.pathname.startsWith('/auth/')) response = await handleAuth(request, env, url);
      else if (url.pathname.startsWith('/api/')) response = await handleApi(request, env, url);
      else response = await env.ASSETS.fetch(request);
      const headers = securityHeaders(new Headers(response.headers));
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      const safe = safeError(error);
      const response = url.pathname.startsWith('/api/') ? json({ error: safe.message }, safe.status) : text(safe.message, safe.status);
      const headers = securityHeaders(new Headers(response.headers));
      if (safe.status === 401 && url.pathname.startsWith('/api/')) headers.set('x-cms-login', '/auth/login');
      return new Response(response.body, { status: response.status, headers });
    }
  },
};

export default worker;

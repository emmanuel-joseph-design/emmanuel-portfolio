import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { openSession, sealSession, validateProject } from './src/worker.mjs';

const env = {
  GITHUB_OWNER: 'emmanuel-joseph-design', CONTENT_REPO: 'portfolio-content', SITE_REPO: 'emmanuel-portfolio',
  ALLOWED_LOGIN: 'FolushoJoseph', SITE_URL: 'https://example.com/',
  SESSION_SECRET: 'a-secure-test-secret-with-more-than-32-characters', GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret',
  ASSETS: { fetch: () => new Response('asset') },
};
const baseProject = {
  slug: 'identity-project', title: 'Identity project', description: '', client: '', role: '', credits: '',
  year: 2026, order: 0, categories: ['Brand'], cover_image: '/media/cms/11111111-1111-4111-8111-111111111111.png',
  published: false, sections: [{ id: 'one', type: 'full-image', assets: ['/media/cms/22222222-2222-4222-8222-222222222222.png'], order: 0 }],
};
const toBase64 = (value) => Buffer.from(value).toString('base64');
async function authenticatedRequest(path, options = {}) {
  const csrf = 'csrf-token';
  const session = await sealSession({ token: 'github-token', login: 'FolushoJoseph', csrf, expiresAt: Date.now() + 60000 }, env.SESSION_SECRET);
  return new Request(`https://cms.example.com${path}`, {
    ...options,
    headers: { cookie: `__Host-portfolio_cms=${session}`, origin: 'https://cms.example.com', 'x-cms-csrf': csrf, 'content-type': 'application/json', ...options.headers },
  });
}

test('session encryption rejects tampering and expiration', async () => {
  const session = await sealSession({ token: 'token', login: 'FolushoJoseph', csrf: 'csrf', expiresAt: Date.now() + 5000 }, env.SESSION_SECRET);
  assert.equal((await openSession(session, env.SESSION_SECRET)).login, 'FolushoJoseph');
  const middle = Math.floor(session.length / 2);
  const tampered = `${session.slice(0, middle)}${session[middle] === 'a' ? 'b' : 'a'}${session.slice(middle + 1)}`;
  assert.equal(await openSession(tampered, env.SESSION_SECRET), null);
  const expired = await sealSession({ token: 'token', login: 'FolushoJoseph', csrf: 'csrf', expiresAt: 1 }, env.SESSION_SECRET);
  assert.equal(await openSession(expired, env.SESSION_SECRET), null);
});

test('project validation protects media paths and types', () => {
  assert.equal(validateProject(baseProject).title, 'Identity project');
  assert.throws(() => validateProject({ ...baseProject, slug: '../escape' }));
  assert.throws(() => validateProject({ ...baseProject, cover_image: '/media/cms/../../secret.png' }));
  assert.throws(() => validateProject({ ...baseProject, sections: [{ type: 'video', assets: [baseProject.cover_image] }] }));
  assert.equal(validateProject({ ...baseProject, sections: [{ type: 'video', assets: ['https://vimeo.com/123456789'] }] }).sections[0].assets[0], 'https://player.vimeo.com/video/123456789');
  const mixed = validateProject({ ...baseProject, sections: [{ type: 'double-image', assets: [baseProject.cover_image, 'https://vimeo.com/123456789'] }] }).sections[0];
  assert.deepEqual(mixed.assets, [baseProject.cover_image, 'https://player.vimeo.com/video/123456789']);
  assert.throws(() => validateProject({ ...baseProject, sections: [{ type: 'double-image', assets: [baseProject.cover_image, 'https://evil.example/video'] }] }));
  assert.throws(() => validateProject({ ...baseProject, sections: [{ type: 'full-image', assets: ['https://vimeo.com/123456789'] }] }));
  assert.throws(() => validateProject({ ...baseProject, sections: [{ type: 'video', assets: ['https://evil.example/video'] }] }));
  assert.throws(() => validateProject({ ...baseProject, cover_image: '' }, { requireMedia: true }));
});

test('API requires an encrypted session and matching CSRF token', async () => {
  assert.equal((await worker.fetch(new Request('https://cms.example.com/api/projects'), env)).status, 401);
  const request = await authenticatedRequest('/api/save', { method: 'POST', body: JSON.stringify(baseProject), headers: { 'x-cms-csrf': 'wrong' } });
  assert.equal((await worker.fetch(request, env)).status, 403);
});

test('publishing creates a public tree containing only the selected project assets', async (context) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname !== 'api.github.com') return originalFetch(input, options);
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, path: url.pathname, body });
    const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname.endsWith('/contents/projects/identity-project.json') && method === 'GET') return response({ sha: 'private-project-sha', content: toBase64(JSON.stringify(baseProject)) });
    if (url.pathname.includes('/contents/media/')) return response({ sha: 'private-media-sha', content: toBase64('image-bytes') });
    if (url.pathname.endsWith('/git/ref/heads/main')) return response({ object: { sha: 'parent-commit' } });
    if (url.pathname.endsWith('/git/commits/parent-commit')) return response({ tree: { sha: 'parent-tree' } });
    if (url.pathname.endsWith('/git/blobs')) return response({ sha: `blob-${calls.filter((call) => call.path.endsWith('/git/blobs')).length}` }, 201);
    if (url.pathname.endsWith('/git/trees')) return response({ sha: 'new-tree' }, 201);
    if (url.pathname.endsWith('/git/commits')) return response({ sha: 'new-commit' }, 201);
    if (url.pathname.endsWith('/git/refs/heads/main')) return response({ object: { sha: 'new-commit' } });
    if (url.pathname.endsWith('/contents/projects/identity-project.json') && method === 'PUT') return response({ content: { sha: 'updated' } }, 200);
    return response({ message: 'Unexpected mock request' }, 500);
  };
  const request = await authenticatedRequest('/api/publish', { method: 'POST', body: JSON.stringify({ slug: baseProject.slug, published: true }) });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200, await response.text());
  const tree = calls.find((call) => call.path.endsWith('/git/trees')).body.tree;
  assert.deepEqual(tree.map((entry) => entry.path), [
    'content/projects/identity-project.json',
    'public/media/cms/11111111-1111-4111-8111-111111111111.png',
    'public/media/cms/22222222-2222-4222-8222-222222222222.png',
  ]);
  assert.equal(calls.filter((call) => call.method === 'PATCH' && call.path.endsWith('/git/refs/heads/main')).length, 1);
});

test('saving retries stale GitHub versions without changing the submitted draft', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const writes = [];
  const reads = [];
  const firstSha = 'a'.repeat(40), latestSha = 'b'.repeat(40), savedSha = 'c'.repeat(40);
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if ((options.method || 'GET') === 'GET') {
      reads.push(url.searchParams.get('_cms_read'));
      assert.equal(options.cache, 'no-store');
      return reply({ sha: reads.length === 1 ? firstSha : latestSha, content: toBase64('previous draft') });
    }
    writes.push(JSON.parse(options.body));
    return writes.length === 1 ? reply({ message: 'projects/identity-project.json does not match ' + firstSha }, 409) : reply({ content: { sha: savedSha } });
  };
  // An already-open editor from the previous deployment has no revision field.
  const response = await worker.fetch(await authenticatedRequest('/api/save', { method: 'POST', body: JSON.stringify(baseProject) }), env);
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.revision, savedSha);
  assert.deepEqual(writes.map((write) => write.sha), [firstSha, latestSha]);
  assert.equal(writes[0].content, writes[1].content);
  assert.equal(new Set(reads).size, 2);
});

test('publishing retries a competing public branch update', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  let updateAttempts = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, path: url.pathname, body });
    const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname.endsWith('/contents/projects/identity-project.json') && method === 'GET') return response({ sha: 'private-project-sha', content: toBase64(JSON.stringify(baseProject)) });
    if (url.pathname.includes('/contents/media/')) return response({ sha: 'private-media-sha', content: toBase64('image-bytes') });
    if (url.pathname.endsWith('/git/ref/heads/main') && method === 'GET') return response({ object: { sha: `parent-${updateAttempts}` } });
    if (url.pathname.includes('/git/commits/parent-')) return response({ tree: { sha: 'parent-tree' } });
    if (url.pathname.endsWith('/git/blobs')) return response({ sha: `blob-${calls.filter((call) => call.path.endsWith('/git/blobs')).length}` }, 201);
    if (url.pathname.endsWith('/git/trees')) return response({ sha: 'new-tree' }, 201);
    if (url.pathname.endsWith('/git/commits')) return response({ sha: `new-commit-${updateAttempts}` }, 201);
    if (url.pathname.endsWith('/git/refs/heads/main') && method === 'PATCH') {
      updateAttempts += 1;
      return updateAttempts === 1 ? response({ message: 'Update is not a fast forward' }, 422) : response({ object: { sha: 'new-commit-1' } });
    }
    if (url.pathname.endsWith('/contents/projects/identity-project.json') && method === 'PUT') return response({ content: { sha: 'updated' } });
    return response({ message: `Unexpected mock request: ${url.pathname}` }, 500);
  };
  const response = await worker.fetch(await authenticatedRequest('/api/publish', { method: 'POST', body: JSON.stringify({ slug: baseProject.slug, published: true }) }), env);
  assert.equal(response.status, 200, await response.text());
  assert.equal(updateAttempts, 2);
});

test('saving stops on a genuine competing edit and retains the other session draft', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let reads = 0, writes = 0;
  globalThis.fetch = async (_input, options = {}) => {
    if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify({ sha: (++reads === 1 ? 'a' : 'b').repeat(40), content: toBase64('another draft') }));
    writes += 1;
    return new Response(JSON.stringify({ message: 'sha mismatch' }), { status: 409 });
  };
  const response = await worker.fetch(await authenticatedRequest('/api/save', { method: 'POST', body: JSON.stringify({ ...baseProject, revision: 'a'.repeat(40) }) }), env);
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /another tab or session/);
  assert.equal(writes, 1);
});

test('a repeated completed save succeeds without writing again', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let writes = 0;
  globalThis.fetch = async (_input, options = {}) => {
    if (options.method === 'PUT') writes += 1;
    return new Response(JSON.stringify({ sha: 'b'.repeat(40), content: toBase64(JSON.stringify(validateProject(baseProject), null, 2) + '\n') }));
  };
  const response = await worker.fetch(await authenticatedRequest('/api/save', { method: 'POST', body: JSON.stringify({ ...baseProject, revision: 'a'.repeat(40) }) }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 'b'.repeat(40));
  assert.equal(writes, 0);
});

test('conflict retries are bounded and permission failures are not retried', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  for (const status of [409, 403]) {
    let writes = 0;
    globalThis.fetch = async (_input, options = {}) => {
      if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify({ sha: 'a'.repeat(40), content: toBase64('previous draft') }));
      writes += 1;
      return new Response(JSON.stringify({ message: 'GitHub write failed' }), { status });
    };
    const response = await worker.fetch(await authenticatedRequest('/api/save', { method: 'POST', body: JSON.stringify(baseProject) }), env);
    assert.equal(response.status, status === 409 ? 409 : 502);
    assert.equal(writes, status === 409 ? 3 : 1);
    if (status === 409) assert.match((await response.json()).error, /edits are still open/);
  }
});

test('a new project cannot overwrite a draft created by another editor', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let writes = 0;
  globalThis.fetch = async (_input, options = {}) => {
    if (options.method === 'PUT') writes += 1;
    return new Response(JSON.stringify({ sha: 'a'.repeat(40), content: toBase64('existing draft') }));
  };
  const response = await worker.fetch(await authenticatedRequest('/api/save', { method: 'POST', body: JSON.stringify({ ...baseProject, revision: null }) }), env);
  assert.equal(response.status, 409);
  assert.equal(writes, 0);
});

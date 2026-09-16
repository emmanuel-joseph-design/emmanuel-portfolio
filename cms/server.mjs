import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const exists = async (file) => { try { await fs.access(file); return true; } catch { return false; } };
const readJSON = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const atomicJSON = async (file, data) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(`${file}.tmp`, JSON.stringify(data, null, 2) + '\n'); await fs.rename(`${file}.tmp`, file); };

export function videoSource(value, required = false) {
  if (!value && !required) return '';
  if (typeof value !== 'string') throw new Error('Enter a valid YouTube or Vimeo link.');
  if (/^\/media\/cms\/[a-zA-Z0-9-]+\.(?:mp4|webm)$/.test(value)) return value;
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid YouTube or Vimeo link.'); }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
  if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]+)/)?.[1] || '';
  if (/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === 'vimeo.com') id = url.pathname.split('/').filter(Boolean)[0] || '';
  if (host === 'player.vimeo.com') id = url.pathname.match(/^\/video\/(\d+)/)?.[1] || '';
  if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  throw new Error('Use a valid YouTube or Vimeo video link.');
}

export function validateProject(value) {
  if (!value || !slugPattern.test(value.slug) || value.slug.length > 100) throw new Error('Choose a URL name using lowercase letters, numbers and hyphens.');
  if (typeof value.title !== 'string' || !value.title.trim()) throw new Error('Enter a project title.');
  if (!Number.isInteger(value.year) || value.year < 1900 || value.year > 2200) throw new Error('Enter a valid year.');
  if (!Number.isInteger(value.order)) throw new Error('Display order must be a whole number.');
  if (!Array.isArray(value.categories) || value.categories.some((c) => !['Brand', 'Marketing', 'Product'].includes(c))) throw new Error('Invalid categories.');
  if (!Array.isArray(value.sections) || value.sections.length > 100) throw new Error('Invalid sections.');
  const media = (url) => {
    if (typeof url !== 'string' || (url && (!/^\/media\/[a-zA-Z0-9_./-]+$/.test(url) || url.includes('..') || !mime[path.extname(url).toLowerCase()]))) throw new Error('Invalid media path.');
    return url;
  };
  if (value.cover_image && mime[path.extname(value.cover_image).toLowerCase()]?.startsWith('video/')) throw new Error('The cover must be an image.');
  return {
    slug: value.slug, title: value.title.trim().slice(0, 250),
    ...Object.fromEntries(['description', 'client', 'role', 'credits'].map((key) => [key, String(value[key] ?? '').slice(0, 20000)])),
    year: value.year, order: value.order, categories: [...new Set(value.categories)], cover_image: media(value.cover_image || ''),
    published: false,
    sections: value.sections.map((s, order) => {
      if (!['full-image', 'double-image', 'video'].includes(s.type) || !Array.isArray(s.assets) || s.assets.length !== (s.type === 'double-image' ? 2 : 1)) throw new Error('Invalid gallery section.');
      const assets = s.assets.map((asset) => s.type === 'video' || (s.type === 'double-image' && typeof asset === 'string' && /^https?:\/\//.test(asset)) ? videoSource(asset) : media(asset));
      if (assets.some((asset) => {
        if (!asset) return false;
        const embedded = asset.startsWith('https://');
        const localVideo = mime[path.extname(asset).toLowerCase()]?.startsWith('video/');
        if (s.type === 'video') return !(embedded || localVideo);
        if (s.type === 'double-image') return localVideo;
        return embedded || localVideo;
      })) throw new Error('Choose the correct media type for this section.');
      return { id: String(s.id || randomUUID()), type: s.type, assets, order };
    }),
  };
}

export async function createCMS({ root = path.dirname(here), allowPublish = true, runCommand } = {}) {
  const drafts = path.join(root, '.local-cms/drafts');
  const uploads = path.join(root, '.local-cms/media');
  const content = path.join(root, 'content/projects');
  await Promise.all([drafts, uploads, content].map((dir) => fs.mkdir(dir, { recursive: true })));
  const token = randomBytes(32).toString('hex');
  let busy = false;
  let job = { state: 'idle', message: '' };
  const command = runCommand || (async (file, args, options = {}) => (await exec(file, args, { cwd: root, timeout: 180000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, ...options })).stdout.trim());
  const list = async () => {
    const projects = new Map();
    for (const filename of (await fs.readdir(content)).filter((f) => f.endsWith('.json'))) {
      const p = await readJSON(path.join(content, filename));
      if (filename === 'example.json' && !p.published) continue;
      projects.set(p.slug, { ...p, live: p.published, draft: false });
    }
    for (const filename of (await fs.readdir(drafts)).filter((f) => f.endsWith('.json'))) {
      const p = await readJSON(path.join(drafts, filename));
      projects.set(p.slug, { ...p, live: projects.get(p.slug)?.live || false, draft: true });
    }
    return [...projects.values()].sort((a, b) => a.order - b.order || b.year - a.year);
  };
  const assetFile = async (url) => {
    if (!url.startsWith('/media/') || url.includes('..') || !mime[path.extname(url).toLowerCase()]) throw new Error('Invalid media.');
    const local = path.join(uploads, path.basename(url));
    if (url.startsWith('/media/cms/') && await exists(local)) return local;
    return path.join(root, 'public', url);
  };
  const publish = async (slug, published) => {
    try {
      if (!allowPublish) throw new Error('Publishing is disabled in this environment.');
      job = { state: 'running', message: 'Checking GitHub connection…' };
      if (await command('git', ['branch', '--show-current']) !== 'main') throw new Error('Switch the repository to main before publishing.');
      if (await command('git', ['remote', 'get-url', 'origin']) !== 'https://github.com/emmanuel-joseph-design/emmanuel-portfolio.git') throw new Error('Unexpected GitHub repository.');
      await command('git', ['fetch', 'origin', 'main']);
      if (Number(await command('git', ['rev-list', '--count', 'HEAD..origin/main']))) throw new Error('GitHub has newer changes. Sync the repository before publishing.');
      const outgoing = await command('git', ['log', '--format=%s', 'origin/main..HEAD']);
      if (outgoing && outgoing.split('\n').some((line) => !line.startsWith('CMS: '))) throw new Error('There are other local commits. Publish or sync those separately first.');
      if (await command('git', ['diff', '--cached', '--name-only'])) throw new Error('Other changes are staged in Git. Commit or unstage them before publishing.');
      const p = (await list()).find((p) => p.slug === slug);
      if (!p) throw new Error('Save this project first.');
      const project = { ...validateProject(p), published };
      const existing = [];
      for (const filename of (await fs.readdir(content)).filter((f) => f.endsWith('.json'))) {
        if ((await readJSON(path.join(content, filename))).slug === slug) existing.push(filename);
      }
      if (existing.length > 1) throw new Error('Duplicate project URLs in content files.');
      const relative = `content/projects/${existing[0] || `${slug}.json`}`;
      const assets = [...new Set([project.cover_image, ...project.sections.flatMap((s) => s.assets)])];
      if (published && assets.some((a) => !a)) throw new Error('Add a cover and fill every gallery upload before publishing.');
      const files = [relative];
      for (const url of assets.filter((asset) => asset && asset.startsWith('/media/'))) {
        if (!await exists(await assetFile(url))) throw new Error(`Missing media: ${url}`);
        if (url.startsWith('/media/cms/')) files.push(`public${url}`);
      }
      const dirty = (await command('git', ['diff', '--name-only'])).split('\n').filter(Boolean);
      if (dirty.some((file) => !files.includes(file))) throw new Error('Other project code has unsaved Git changes. Commit those separately before publishing.');
      job.message = 'Preparing project and checking the website build…';
      const targetFile = path.join(root, relative);
      const previousContent = await exists(targetFile) ? await fs.readFile(targetFile) : null;
      const copiedFiles = [];
      for (const url of assets.filter((a) => a.startsWith('/media/cms/'))) {
        const destination = path.join(root, 'public', url);
        const source = await assetFile(url);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        if (source !== destination) {
          if (!await exists(destination)) copiedFiles.push(destination);
          await fs.copyFile(source, destination);
        }
      }
      await atomicJSON(targetFile, project);
      try {
        await command(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], { env: { ...process.env, NEXT_PUBLIC_BASE_PATH: '/emmanuel-portfolio' } });
      } catch (error) {
        if (previousContent) await fs.writeFile(targetFile, previousContent);
        else await fs.rm(targetFile, { force: true });
        await Promise.all(copiedFiles.map((file) => fs.rm(file, { force: true })));
        throw error;
      }
      job.message = 'Saving the publishing commit…';
      await command('git', ['add', '--', ...files]);
      if (await command('git', ['diff', '--cached', '--name-only'])) await command('git', ['commit', '-m', `CMS: ${published ? 'Publish' : 'Unpublish'} ${slug}`, '--', ...files]);
      job.message = 'Uploading to GitHub…';
      await command('git', ['push', 'origin', 'main']);
      await fs.rm(path.join(drafts, `${slug}.json`), { force: true });
      job = { state: 'success', message: 'Sent to GitHub. The website will update when deployment finishes.', url: 'https://github.com/emmanuel-joseph-design/emmanuel-portfolio/actions/workflows/pages.yml' };
    } catch (error) {
      job = { state: 'error', message: `${error.message.split('\n')[0]} Your local content is kept. Fix the issue and retry.`, detail: String(error.stderr || error.stdout || '').slice(-3000) };
    } finally { busy = false; }
  };
  const server = http.createServer(async (req, res) => {
    const send = (status, body, type = 'application/json') => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
    try {
      const host = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== host) return send(403, { error: 'Open the editor using its 127.0.0.1 address.' });
      const url = new URL(req.url, `http://${host}`);
      if (req.method !== 'GET' && (req.headers.origin !== `http://${host}` || req.headers['x-cms-token'] !== token)) return send(403, { error: 'Refresh the editor before saving.' });
      if (req.method === 'GET') {
        if (url.pathname === '/') return send(200, (await fs.readFile(path.join(here, 'index.html'), 'utf8')).replace('__TOKEN__', token), 'text/html; charset=utf-8');
        if (url.pathname === '/app.js') return send(200, await fs.readFile(path.join(here, 'app.js')), 'text/javascript');
        if (url.pathname === '/style.css') return send(200, await fs.readFile(path.join(here, 'style.css')), 'text/css');
        if (url.pathname === '/api/projects') return send(200, await list());
        if (url.pathname === '/api/status') return send(200, job);
        if (url.pathname.startsWith('/media/')) return send(200, await fs.readFile(await assetFile(url.pathname)), mime[path.extname(url.pathname).toLowerCase()]);
        return send(404, { error: 'Not found.' });
      }
      if (req.method !== 'POST') return send(405, { error: 'Method not allowed.' });
      if (busy) return send(409, { error: 'Publishing is in progress. Please wait.' });
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 29 * 1024 * 1024) throw new Error('File too large. Use images under 10 MB and videos under 20 MB.'); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (url.pathname === '/api/save') {
        const project = validateProject(body);
        await atomicJSON(path.join(drafts, `${project.slug}.json`), project);
        return send(200, { message: 'Draft saved on this computer.' });
      }
      if (url.pathname === '/api/upload') {
        const ext = path.extname(String(body.name)).toLowerCase();
        if (!mime[ext]?.startsWith('image/') || typeof body.data !== 'string') throw new Error('Use JPG, PNG, WebP or GIF image files. Add videos by pasting a YouTube or Vimeo link.');
        const data = Buffer.from(body.data, 'base64');
        const limit = 10;
        if (!data.length || data.length > limit * 1024 * 1024) throw new Error(`File must be smaller than ${limit} MB.`);
        const signature = ext === '.png' ? data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : ['.jpg','.jpeg'].includes(ext) ? data[0] === 255 && data[1] === 216 && data[2] === 255 : ext === '.gif' ? /^GIF8[79]a/.test(data.toString('ascii',0,6)) : ext === '.webp' ? data.toString('ascii',0,4) === 'RIFF' && data.toString('ascii',8,12) === 'WEBP' : ext === '.mp4' ? data.toString('ascii',4,8) === 'ftyp' : data.subarray(0,4).equals(Buffer.from([26,69,223,163]));
        if (!signature) throw new Error('This file does not match its image or video extension.');
        const filename = `${randomUUID()}${ext}`;
        await fs.writeFile(path.join(uploads, filename), data);
        return send(200, { url: `/media/cms/${filename}` });
      }
      if (url.pathname === '/api/publish') {
        if (busy) return send(409, { error: 'Publishing is already in progress.' });
        if (!slugPattern.test(body.slug) || typeof body.published !== 'boolean') throw new Error('Invalid publish request.');
        busy = true;
        void publish(body.slug, body.published);
        return send(202, { message: 'Publishing started.' });
      }
      return send(404, { error: 'Not found.' });
    } catch (error) { send(400, { error: error.code === 'ENOENT' ? 'File not found.' : error.message }); }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createCMS();
  server.on('error', (error) => { console.error(error.code === 'EADDRINUSE' ? 'The CMS is already running. Open http://127.0.0.1:4310' : error.message); process.exitCode = 1; });
  server.listen(4310, '127.0.0.1', () => console.log('Portfolio CMS: http://127.0.0.1:4310\nKeep this terminal open while editing. Press Ctrl+C to stop.'));
}

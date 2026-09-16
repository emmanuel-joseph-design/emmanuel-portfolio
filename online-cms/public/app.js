const $ = (id) => document.getElementById(id);
const form = $('project-form');
let csrf = '';
let project;
let projects = [];
let dirty = false;
let locked = false;
let uploads = 0;

const notice = (message, error = false) => {
  $('notice').hidden = false;
  $('notice').replaceChildren(document.createTextNode(message));
  $('notice').className = error ? 'error' : '';
};
const element = (tag, content, className) => {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
};
const assetUrl = (value) => value?.startsWith('/media/cms/') ? `/api/media/${value.split('/').pop()}` : value;
const embedUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : '';
    if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]+)/)?.[1] || '';
    if (/^[a-zA-Z0-9_-]{6,20}$/.test(id || '')) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (host === 'vimeo.com') id = url.pathname.split('/').filter(Boolean)[0];
    if (host === 'player.vimeo.com') id = url.pathname.match(/^\/video\/(\d+)/)?.[1] || '';
    if (/^\d+$/.test(id || '')) return `https://player.vimeo.com/video/${id}`;
  } catch { /* The server displays the validation message when saving. */ }
  return '';
};

async function api(route, body) {
  const options = body === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cms-csrf': csrf },
    body: JSON.stringify(body),
  };
  const response = await fetch(`/api/${route}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'The request failed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function changed() {
  dirty = true;
  $('save-state').textContent = 'Unsaved changes';
}

function lock(value) {
  locked = value;
  for (const control of document.querySelectorAll('#editor button,#editor input,#editor textarea')) control.disabled = value;
}

function collect() {
  return {
    ...project,
    ...Object.fromEntries(['title', 'description', 'client', 'role', 'credits'].map((key) => [key, form.elements[key].value])),
    year: Number(form.elements.year.value),
    order: Number(form.elements.order.value),
    categories: [...form.querySelectorAll('[name=category]:checked')].map((input) => input.value),
  };
}

async function save() {
  if (uploads) throw new Error('Wait for the uploads to finish.');
  if (!form.reportValidity()) throw new Error('Fill in the required project fields.');
  project = collect();
  if (!project.slug) {
    const base = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'project';
    let slug = base;
    let suffix = 2;
    while (projects.some((item) => item.slug === slug)) slug = `${base}-${suffix++}`;
    project.slug = slug;
  }
  const result = await api('save', project);
  dirty = false;
  $('save-state').textContent = result.message;
  return result;
}

async function dashboard() {
  projects = await api('projects');
  $('projects').replaceChildren();
  if (!projects.length) {
    const empty = element('div', '', 'empty');
    empty.append(element('h2', 'Your next project starts here'), element('p', 'Upload your images and tell the story behind your work.'));
    $('projects').append(empty);
  }
  for (const item of projects) {
    const row = element('div', '', 'project-row');
    const thumbnail = item.cover_image ? element('img', '', 'thumbnail') : element('div', '', 'thumbnail');
    if (item.cover_image) { thumbnail.src = assetUrl(item.cover_image); thumbnail.alt = ''; }
    const info = element('div', '', 'project-info');
    info.append(element('h2', item.title));
    const badges = element('div', '', 'badges');
    badges.append(element('span', item.published ? 'Published' : 'Private draft', `badge${item.published ? ' live' : ''}`));
    info.append(badges, element('p', `${item.categories.join(', ')} · ${item.year}`));
    const edit = element('button', 'Edit', 'outline');
    edit.onclick = () => editProject(item);
    row.append(thumbnail, info, edit);
    $('projects').append(row);
  }
  $('loading').hidden = true;
  $('login').hidden = true;
  $('dashboard').hidden = false;
  $('editor').hidden = true;
}

function uploadZone(current, video, onUploaded) {
  const zone = element('label', '', 'upload');
  if (current) {
    const media = element(video ? 'video' : 'img');
    media.src = assetUrl(current);
    if (video) media.controls = true;
    else media.alt = 'Uploaded image preview';
    zone.append(media);
  }
  const caption = element('span', current ? 'Choose a replacement or drop a file here' : `Drop ${video ? 'a video' : 'an image'} here or choose a file`);
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = video ? '.mp4,.webm' : '.jpg,.jpeg,.png,.webp,.gif';
  input.setAttribute('aria-label', video ? 'Upload video' : 'Upload image');
  zone.append(caption, input, element('small', video ? 'MP4 / WebM · up to 20 MB' : 'JPG / PNG / WebP / GIF · up to 10 MB'));
  async function upload(file) {
    if (!file || locked) return;
    if (!(video ? /\.(mp4|webm)$/i : /\.(jpg|jpeg|png|webp|gif)$/i).test(file.name)) return notice(video ? 'Choose an MP4 or WebM video.' : 'Choose a JPG, PNG, WebP, or GIF image.', true);
    if (file.size > (video ? 20 : 10) * 1024 * 1024) return notice('This file is too large. Please compress it before uploading.', true);
    uploads += 1;
    input.disabled = true;
    caption.textContent = 'Uploading privately to GitHub…';
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await api('upload', { name: file.name, data });
      onUploaded(result.url);
      changed();
      renderMedia();
    } catch (error) {
      notice(error.message, true);
      caption.textContent = 'Upload failed. Choose a file to retry.';
    } finally {
      uploads -= 1;
      input.disabled = false;
    }
  }
  input.onchange = () => upload(input.files[0]);
  zone.ondragover = (event) => { event.preventDefault(); zone.classList.add('drag'); };
  zone.ondragleave = () => zone.classList.remove('drag');
  zone.ondrop = (event) => { event.preventDefault(); zone.classList.remove('drag'); upload(event.dataTransfer.files[0]); };
  return zone;
}

function videoLinkField(current, onChanged, onCommit = renderMedia) {
  const zone = element('div', '', 'upload');
  const source = embedUrl(current);
  if (source) {
    const frame = element('iframe', '', 'preview-media');
    frame.src = source; frame.title = 'Embedded video preview'; frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; frame.allowFullscreen = true;
    frame.style.aspectRatio = '16 / 9'; frame.style.border = '0';
    zone.append(frame);
  }
  zone.append(element('span', current ? 'Replace the video link' : 'Paste a YouTube or Vimeo video link'));
  const input = document.createElement('input');
  input.type = 'url'; input.placeholder = 'https://www.youtube.com/watch?v=…'; input.value = current || ''; input.setAttribute('aria-label', 'YouTube or Vimeo video link');
  input.oninput = () => { onChanged(input.value.trim()); changed(); };
  input.onchange = onCommit;
  zone.append(input, element('small', 'The video stays hosted on YouTube or Vimeo · displayed at 16:9'));
  return zone;
}

function doubleMediaField(current, onChanged, index) {
  const slot = element('div', '', 'media-choice');
  slot.style.cssText = 'display:grid;align-content:start;gap:10px';
  const label = element('label');
  label.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;font-weight:700';
  label.append(element('span', `Slot ${index + 1} media`));
  const select = document.createElement('select');
  select.style.cssText = 'border:1px solid var(--line);border-radius:6px;padding:8px;color:var(--purple);background:white;font:600 12px Inter,Arial,sans-serif';
  select.setAttribute('aria-label', `Slot ${index + 1} media type`);
  select.append(new Option('Image', 'image'), new Option('Embedded video', 'embed'));
  select.value = embedUrl(current) ? 'embed' : 'image';
  let field = select.value === 'embed' ? videoLinkField(current, onChanged, () => {}) : uploadZone(current, false, onChanged);
  select.onchange = () => {
    onChanged(''); changed();
    const next = select.value === 'embed' ? videoLinkField('', onChanged, () => {}) : uploadZone('', false, onChanged);
    field.replaceWith(next); field = next;
  };
  label.append(select);
  slot.append(label, field);
  return slot;
}

function renderMedia() {
  $('cover').replaceChildren(uploadZone(project.cover_image, false, (url) => { project.cover_image = url; }));
  $('sections').replaceChildren();
  project.sections.forEach((section, index) => {
    const block = element('div', '', 'section');
    const head = element('div', '', 'section-head');
    head.append(element('strong', `${index + 1}. ${section.type.replace('-', ' ')}`));
    const controls = element('div');
    const actions = [
      ['↑', 'Move section up', () => { if (index) [project.sections[index - 1], project.sections[index]] = [project.sections[index], project.sections[index - 1]]; }],
      ['↓', 'Move section down', () => { if (index < project.sections.length - 1) [project.sections[index + 1], project.sections[index]] = [project.sections[index], project.sections[index + 1]]; }],
      ['×', 'Remove section', () => { project.sections.splice(index, 1); }],
    ];
    for (const [label, title, action] of actions) {
      const button = element('button', label, 'outline');
      button.type = 'button';
      button.setAttribute('aria-label', title);
      button.onclick = () => { action(); changed(); renderMedia(); };
      controls.append(button);
    }
    head.append(controls);
    block.append(head);
    const group = element('div', '', section.type === 'double-image' ? 'pair' : '');
    section.assets.forEach((asset, assetIndex) => group.append(section.type === 'video' ? videoLinkField(asset, (url) => { section.assets[assetIndex] = url; }) : section.type === 'double-image' ? doubleMediaField(asset, (url) => { section.assets[assetIndex] = url; }, assetIndex) : uploadZone(asset, false, (url) => { section.assets[assetIndex] = url; })));
    block.append(group);
    $('sections').append(block);
  });
}

function editProject(value) {
  project = structuredClone(value || {
    slug: '', title: '', description: '', client: '', role: '', year: new Date().getFullYear(),
    order: 0, categories: [], cover_image: '', credits: 'Emmanuel Folusho Joseph', sections: [], published: false,
  });
  for (const key of ['title', 'description', 'client', 'role', 'year', 'order', 'credits']) form.elements[key].value = project[key];
  for (const input of form.querySelectorAll('[name=category]')) input.checked = project.categories.includes(input.value);
  $('editor-title').textContent = value ? 'Edit Project' : 'Add Project';
  $('save-state').textContent = value ? 'Ready to edit' : 'New private draft';
  $('unpublish').hidden = !project.published;
  dirty = false;
  renderMedia();
  $('dashboard').hidden = true;
  $('editor').hidden = false;
  $('notice').hidden = true;
  form.elements.title.focus();
}

function preview() {
  const value = collect();
  const article = $('preview-content');
  article.replaceChildren();
  article.append(element('h1', value.title || 'Untitled project'));
  if (value.cover_image) {
    const cover = element('img', '', 'preview-cover');
    cover.src = assetUrl(value.cover_image); cover.alt = value.title;
    article.append(cover);
  }
  const info = element('div', '', 'preview-info');
  info.append(element('p', value.description), element('p', `${value.client}\n${value.role}\n${value.year} · ${value.categories.join(', ')}`));
  article.append(info);
  for (const section of value.sections) {
    const group = element('div', '', section.type === 'double-image' ? 'pair' : '');
    for (const asset of section.assets.filter(Boolean)) {
      const embedded = embedUrl(asset);
      const media = element(embedded ? 'iframe' : section.type === 'video' ? 'video' : 'img', '', 'preview-media');
      media.src = embedded || assetUrl(asset);
      if (embedded) { media.title = 'Embedded project video'; media.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; media.allowFullscreen = true; media.style.aspectRatio = '16 / 9'; media.style.border = '0'; }
      else if (section.type === 'video') media.controls = true;
      else media.alt = 'Project image';
      group.append(media);
    }
    article.append(group);
  }
  article.append(element('p', value.credits, 'preview-credits'));
  $('preview-dialog').showModal();
}

async function publish(published) {
  try {
    await save();
    lock(true);
    notice(published ? 'Publishing project and media…' : 'Removing project from public listings…');
    const result = await api('publish', { slug: project.slug, published });
    project.published = published;
    dirty = false;
    await dashboard();
    notice(result.message);
    const link = element('a', ' View deployment ↗');
    link.href = result.deploymentUrl; link.target = '_blank'; link.rel = 'noopener';
    $('notice').append(link);
  } catch (error) {
    notice(error.message, true);
  } finally { lock(false); }
}

form.oninput = changed;
form.onsubmit = async (event) => {
  event.preventDefault();
  try { const result = await save(); notice(result.message); }
  catch (error) { notice(error.message, true); }
};
$('add').onclick = () => editProject();
$('back').onclick = () => { if (!dirty || confirm('Leave without saving these changes?')) dashboard().catch((error) => notice(error.message, true)); };
$('preview').onclick = preview;
$('close-preview').onclick = () => $('preview-dialog').close();
$('publish').onclick = () => publish(true);
$('unpublish').onclick = () => publish(false);
for (const button of document.querySelectorAll('[data-section]')) button.onclick = () => {
  const type = button.dataset.section;
  project.sections.push({ id: crypto.randomUUID(), type, assets: type === 'double-image' ? ['', ''] : [''], order: project.sections.length });
  changed(); renderMedia();
};
window.addEventListener('beforeunload', (event) => { if (dirty || uploads) { event.preventDefault(); event.returnValue = ''; } });

async function start() {
  try {
    const me = await api('me');
    csrf = me.csrf;
    $('account').textContent = `@${me.login}`;
    $('account').hidden = false;
    $('site-link').href = me.siteUrl;
    await dashboard();
  } catch (error) {
    $('loading').hidden = true;
    if (error.status === 401) $('login').hidden = false;
    else notice(error.message, true);
  }
}

start();

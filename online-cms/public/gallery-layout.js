import Player from './vendor/vimeo-player.js';

const players = new WeakMap();
const ratios = new Map();
export const validRatio = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0.1 && value <= 10;

// Pairs use one frame shape, preferring the first image over a video fallback.
export function chooseRatio(manual, items) {
  if (validRatio(manual)) return manual;
  const image = items.find((item) => item.image && validRatio(item.ratio));
  return image?.ratio || items.find((item) => validRatio(item.ratio))?.ratio || 16 / 9;
}

export function sizeGallery(group, options = {}) {
  let active = true;
  const cleanups = [];
  const media = [...group.querySelectorAll('.gallery-frame > img, .gallery-frame > video, .gallery-frame > iframe')];
  const items = media.map((node) => ({ image: node.tagName === 'IMG', ratio: ratios.get(node.src) }));
  const update = () => {
    if (active) group.style.setProperty('--media-ratio', String(chooseRatio(options.aspectRatio, items)));
  };
  media.forEach((node, index) => {
    const record = (width, height) => {
      const ratio = width / height;
      if (!active || !validRatio(ratio)) return;
      items[index].ratio = ratio;
      ratios.set(node.src, ratio);
      update();
    };
    if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
      const event = node.tagName === 'IMG' ? 'load' : 'loadedmetadata';
      const read = () => record(node.naturalWidth || node.videoWidth, node.naturalHeight || node.videoHeight);
      node.addEventListener(event, read);
      cleanups.push(() => node.removeEventListener(event, read));
      read();
    } else if (/^https:\/\/player\.vimeo\.com\/video\/\d+$/.test(node.src)) {
      let player = players.get(node);
      if (!player) { player = new Player(node); players.set(node, player); }
      Promise.all([player.getVideoWidth(), player.getVideoHeight()])
        .then(([width, height]) => record(width, height))
        .catch(() => { /* Keep the selected ratio or fallback when unavailable. */ });
      cleanups.push(() => queueMicrotask(() => {
        // React can reconnect effects in development; only destroy detached players.
        if (!node.isConnected) { player.destroy().catch(() => {}); players.delete(node); }
      }));
    }
  });
  update();
  return () => { active = false; cleanups.forEach((cleanup) => cleanup()); };
}

export function createGallery(section, sourceUrl = (value) => value, embedUrl = (value) => value.startsWith('https://') ? value : '') {
  const group = document.createElement('div');
  group.className = `media-gallery-section${section.type === 'double-image' ? ' media-gallery-pair' : ''}`;
  group.dataset.fit = section.imageFit || 'contain';
  section.assets.forEach((asset, index) => {
    const frame = document.createElement('div');
    frame.className = 'gallery-frame';
    if (asset) {
      const embed = embedUrl(asset);
      const media = document.createElement(embed ? 'iframe' : section.type === 'video' ? 'video' : 'img');
      media.src = embed || sourceUrl(asset);
      if (embed) {
        media.title = `Project video ${index + 1}`;
        media.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        media.allowFullscreen = true;
      } else if (section.type === 'video') media.controls = true;
      else media.alt = 'Project image';
      frame.append(media);
    }
    group.append(frame);
  });
  return group;
}

export function layoutControls(section, onChange) {
  const controls = document.createElement('div');
  controls.className = 'media-layout-controls';
  const label = document.createElement('label');
  label.append('Frame proportions ');
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Frame proportions');
  for (const [text, value] of [['Automatic', ''], ['16:9 — landscape', 16 / 9], ['3:2 — landscape', 3 / 2], ['4:3 — landscape', 4 / 3], ['1:1 — square', 1], ['4:5 — portrait', 4 / 5], ['9:16 — portrait', 9 / 16]]) select.append(new Option(text, String(value)));
  if (section.aspectRatio && ![...select.options].some((option) => option.value === String(section.aspectRatio))) select.append(new Option('Custom saved ratio', String(section.aspectRatio)));
  select.value = section.aspectRatio ? String(section.aspectRatio) : '';
  select.onchange = () => { if (select.value) section.aspectRatio = Number(select.value); else delete section.aspectRatio; onChange(); };
  label.append(select);
  controls.append(label);
  if (section.type === 'double-image') {
    const fitLabel = document.createElement('label');
    fitLabel.append('Images ');
    const fit = document.createElement('select');
    fit.setAttribute('aria-label', 'Image fitting');
    fit.append(new Option('Show complete image', 'contain'), new Option('Crop to fill frame', 'cover'));
    fit.value = section.imageFit || 'contain';
    fit.onchange = () => { section.imageFit = fit.value; onChange(); };
    fitLabel.append(fit);
    controls.append(fitLabel);
  }
  const hint = document.createElement('small');
  hint.textContent = section.type === 'double-image' ? 'Automatic matches the image proportions, or the first video when both slots are videos.' : 'Automatic uses the original media proportions. Choose a ratio if detection is unavailable.';
  controls.append(hint);
  return controls;
}

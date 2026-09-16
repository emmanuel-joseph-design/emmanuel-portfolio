import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRatio } from '../online-cms/public/gallery-layout.js';
import { validateProject as local } from './server.mjs';
import { validateProject as online } from '../online-cms/src/worker.mjs';

test('portrait pairs follow the image regardless of slot order; full videos keep their ratio', () => {
  const image = { image: true, ratio: 1200 / 1476 };
  const video = { image: false, ratio: 16 / 9 };
  assert.equal(chooseRatio(undefined, [video, image]), image.ratio);
  assert.equal(chooseRatio(undefined, [image, video]), image.ratio);
  assert.equal(chooseRatio(undefined, [{ image: false, ratio: 2400 / 1434 }]), 2400 / 1434);
  assert.equal(chooseRatio(1, [image, video]), 1);
  assert.equal(chooseRatio(undefined, [{ image: false }]), 16 / 9);
  assert.equal(chooseRatio(undefined, [{ image: false, ratio: 9 / 16 }, video]), 9 / 16);
});

test('both CMS validators preserve layout on save and reject malformed ratios and fit values', () => {
  const project = { slug: 'sizing-test', title: 'Sizing test', year: 2026, order: 0, categories: [], cover_image: '', sections: [{ type: 'double-image', assets: ['', ''], aspectRatio: 4 / 5, imageFit: 'contain' }] };
  for (const validate of [local, online]) {
    const saved = validate(project);
    assert.equal(saved.sections[0].aspectRatio, 4 / 5);
    assert.equal(saved.sections[0].imageFit, 'contain');
    assert.equal(validate(saved).sections[0].aspectRatio, 4 / 5);
    for (const aspectRatio of [0, -1, Infinity, NaN, '1', 100]) assert.throws(() => validate({ ...project, sections: [{ ...project.sections[0], aspectRatio }] }));
    assert.throws(() => validate({ ...project, sections: [{ ...project.sections[0], imageFit: 'stretch' }] }));
    const old = validate({ ...project, sections: [{ type: 'video', assets: ['https://vimeo.com/1227389469'] }] });
    assert.equal(old.sections[0].aspectRatio, undefined);
  }
});

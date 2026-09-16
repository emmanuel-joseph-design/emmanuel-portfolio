import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Project } from './types';

// Read only at build time. Draft content is never passed to client components.
export function getProjects(): Project[] {
  const directory = path.join(process.cwd(), 'content/projects');
  const projects = readdirSync(directory).filter((name) => name.endsWith('.json')).map((name) => {
    const project = JSON.parse(readFileSync(path.join(directory, name), 'utf8')) as Project;
    const fail = (message: string): never => { throw new Error(`${name}: ${message}`); };
    if (!project.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) fail('Use a lowercase, hyphenated slug.');
    if (!project.title || typeof project.published !== 'boolean' || !Number.isInteger(project.year)) fail('Title, year and published are required.');
    if (!Array.isArray(project.categories) || project.categories.some((category) => !['Brand', 'Marketing', 'Product'].includes(category))) fail('Invalid categories.');
    if (!Array.isArray(project.sections)) fail('Sections must be an array.');
    for (const section of project.sections) {
      const count = section.type === 'double-image' ? 2 : 1;
      if (!['full-image', 'double-image', 'video'].includes(section.type) || !Array.isArray(section.assets) || section.assets.length !== count) fail('Invalid gallery section.');
      if (section.aspectRatio !== undefined && (typeof section.aspectRatio !== 'number' || !Number.isFinite(section.aspectRatio) || section.aspectRatio < 0.1 || section.aspectRatio > 10)) fail('Invalid media proportions.');
      if (section.imageFit !== undefined && !['contain', 'cover'].includes(section.imageFit)) fail('Invalid image fitting.');
      for (const asset of section.assets) {
        const embeddedVideo = /^https:\/\/(?:www\.youtube-nocookie\.com\/embed\/[a-zA-Z0-9_-]{6,20}|player\.vimeo\.com\/video\/\d+)$/.test(asset);
        const localVideo = /^\/media\/cms\/.+\.(?:mp4|webm)$/.test(asset);
        const remote = asset.startsWith('https://');
        if (section.type === 'video' ? !(embeddedVideo || localVideo) : section.type === 'double-image' ? localVideo || (remote && !embeddedVideo) : remote || localVideo) fail('Invalid gallery media type.');
      }
    }
    if (project.published) {
      for (const asset of [project.cover_image, ...project.sections.flatMap((section) => section.assets)]) {
        if (!asset) fail('Published media cannot be empty.');
        if (asset.startsWith('https://')) continue;
        if (!asset.startsWith('/media/') || asset.includes('..') || !existsSync(path.join(process.cwd(), 'public', asset))) fail(`Missing local media: ${asset}`);
      }
    }
    return { ...project, id: project.slug, order: project.order ?? 0 };
  });
  if (new Set(projects.map((project) => project.slug)).size !== projects.length) throw new Error('Project slugs must be unique.');
  return projects.filter((project) => project.published).sort((a, b) => a.order - b.order || b.year - a.year || a.slug.localeCompare(b.slug));
}

export function getProject(slug: string): Project | undefined {
  return getProjects().find((project) => project.slug === slug);
}

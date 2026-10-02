'use client';
import Link from 'next/link';
import { assetPath } from '@/lib/asset-path';
import Image from 'next/image';
import TagPill from './TagPill';
import { Project } from '@/lib/types';

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/project/${project.slug}`}
      style={{ display: 'block', textDecoration: 'none' }}
    >
      <article
        style={{ cursor: 'pointer' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '1';
        }}
      >
        {/* Cover image */}
        <div
          style={{
            width: '100%',
            aspectRatio: '4/3',
            background: 'var(--purple)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {project.cover_image ? (
            <Image
              src={assetPath(project.cover_image)}
              alt={project.title}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--purple)',
              }}
            />
          )}
        </div>

        {/* Title pill */}
        <div style={{ marginTop: '12px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '40px',
              padding: '0 16px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--purple)',
              color: 'var(--white)',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            {project.title}
          </span>
        </div>

        {/* Tags row */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
          {project.categories.map((cat) => (
            <TagPill key={cat} label={cat} variant="outlined" size="sm" height={40} />
          ))}
          <TagPill label={String(project.year)} variant="outlined" size="sm" height={40} />
        </div>
      </article>
    </Link>
  );
}

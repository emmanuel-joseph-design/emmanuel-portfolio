"use client";
import { useEffect, useRef } from 'react';
import { assetPath } from '@/lib/asset-path';
import { MediaSection, Section, TextSection } from '@/lib/types';
import { sizeGallery } from '@/online-cms/public/gallery-layout.js';
import '@/online-cms/public/gallery-layout.css';
import styles from './MediaGallery.module.css';

function GallerySection({ section }: { section: MediaSection }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) return sizeGallery(ref.current, section);
  }, [section]);
  return (
    <div ref={ref} className={`media-gallery-section${section.type === 'double-image' ? ' media-gallery-pair' : ''}`} data-fit={section.imageFit || 'contain'}>
      {section.assets.map((asset, index) => (
        <div className="gallery-frame" key={`${index}:${asset}`}>
          {asset?.startsWith('https://') ? (
            <iframe src={asset} title={`Project video ${index + 1}`} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />
          ) : asset ? section.type === 'video' ? (
            <video src={assetPath(asset)} controls />
          ) : (
            <img src={assetPath(asset)} alt="" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ProjectTextSection({ section }: { section: TextSection }) {
  return (
    <section className={styles.textSection}>
      {section.heading && <h2>{section.heading}</h2>}
      <p>{section.body}</p>
    </section>
  );
}

export default function MediaGallery({ sections }: { sections: Section[] }) {
  return (
    <div>
      {[...sections].sort((a, b) => a.order - b.order).map((section) => (
        section.type === 'text'
          ? <ProjectTextSection key={section.id} section={section} />
          : <GallerySection key={section.id} section={section} />
      ))}
    </div>
  );
}

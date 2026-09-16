"use client";
import { useEffect, useRef } from 'react';
import { assetPath } from '@/lib/asset-path';
import { Section } from '@/lib/types';
import { sizeGallery } from '@/online-cms/public/gallery-layout.js';
import '@/online-cms/public/gallery-layout.css';

function GallerySection({ section }: { section: Section }) {
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
export default function MediaGallery({ sections }: { sections: Section[] }) {
  return <div>{[...sections].sort((a, b) => a.order - b.order).map((section) => <GallerySection key={section.id} section={section} />)}</div>;
}

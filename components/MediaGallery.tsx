import { assetPath } from '@/lib/asset-path';
import { Section } from '@/lib/types';

export default function MediaGallery({ sections }: { sections: Section[] }) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {sorted.map((section) => (
        <div key={section.id}>
          {section.type === 'full-image' && (
            <div
              style={{
                width: '100%',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--lavender)',
              }}
            >
              {section.assets[0] ? (
                <img
                  src={assetPath(section.assets[0])}
                  alt=""
                  style={{ width: '100%', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', aspectRatio: '16/7', background: 'var(--purple)' }} />
              )}
            </div>
          )}

          {section.type === 'double-image' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: 'var(--lavender)',
                  }}
                >
                  {section.assets[i]?.startsWith('https://') ? (
                    <iframe
                      src={section.assets[i]}
                      title={`Project video ${i + 1}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      style={{ width: '100%', aspectRatio: '16 / 9', display: 'block', border: 0 }}
                    />
                  ) : section.assets[i] ? (
                    <img
                      src={assetPath(section.assets[i])}
                      alt=""
                      style={{ width: '100%', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--purple)' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {section.type === 'video' && (
            <div
              style={{
                width: '100%',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: '#000',
              }}
            >
              {section.assets[0]?.startsWith('https://') ? (
                <iframe
                  src={section.assets[0]}
                  title="Project video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{ width: '100%', aspectRatio: '16 / 9', display: 'block', border: 0 }}
                />
              ) : section.assets[0] ? (
                <video
                  src={assetPath(section.assets[0])}
                  controls
                  style={{ width: '100%', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--purple)' }} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export const dynamicParams = false;

import { notFound } from 'next/navigation';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MediaGallery from '@/components/MediaGallery';
import { getProject, getProjects } from '@/lib/projects';
import { assetPath } from '@/lib/asset-path';

export function generateStaticParams() {
  const params = getProjects().map(({ slug }) => ({ slug }));
  // Next 16 rejects an empty static path list. This reserved path renders notFound
  // until the first project is published; it never appears in public listings.
  return params.length ? params : [{ slug: '_empty' }];
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) notFound();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar
        projectTitle={project.title}
        projectCategories={project.categories}
        projectYear={project.year}
      />

      <main style={{ flex: 1 }}>
        {/* Hero cover */}
        <div
          style={{
            width: '100%',
            aspectRatio: '16/8',
            background: 'var(--purple)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {project.cover_image && (
            <Image
              src={assetPath(project.cover_image)}
              alt={project.title}
              fill
              style={{ objectFit: 'cover' }}
              priority
              sizes="100vw"
            />
          )}
        </div>

        {/* Challenge and solution */}
        {(project.challenge || project.solution) && (
          <div className="challenge-solution">
            {project.challenge && (
              <section>
                <h2>Challenge</h2>
                <p>{project.challenge}</p>
              </section>
            )}
            {project.solution && (
              <section>
                <h2>Solution</h2>
                <p>{project.solution}</p>
              </section>
            )}
          </div>
        )}

        {/* Project content */}
        {project.sections.length > 0 && (
          <div style={{ padding: '0 var(--page-pad) 48px' }}>
            <MediaGallery sections={project.sections} />
          </div>
        )}

        {/* Description and metadata */}
        <div className="project-info-block">
          <div>
            <p
              style={{
                fontSize: 'clamp(16px, 2vw, 20px)',
                fontWeight: 700,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}
            >
              {project.description}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              { label: 'Project', value: project.title },
              { label: 'Client', value: project.client },
              { label: 'Role', value: project.role },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: '11px', fontWeight: 600, opacity: 0.5, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {label}
                </p>
                <p style={{ fontSize: '16px', fontWeight: 800 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Credits */}
        <div
          className="credits-block"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '24px var(--page-pad)',
            borderTop: '1px solid var(--lavender)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, opacity: 0.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Credits
          </span>
          <div style={{ display: 'flex', gap: '32px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>
              {project.credits || 'Emmanuel Folusho Joseph'}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 500, opacity: 0.6 }}>
              Creative Director & Brand Designer
            </span>
          </div>
        </div>
      </main>

      <Footer />

      <style>{`
        .challenge-solution {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(32px, 6vw, 96px);
          padding: clamp(48px, 7vw, 96px) var(--page-pad);
          border-bottom: 1px solid var(--lavender);
        }
        .challenge-solution section {
          min-width: 0;
        }
        .challenge-solution h2 {
          margin: 0 0 18px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.55;
        }
        .challenge-solution p {
          margin: 0;
          font-size: clamp(17px, 1.8vw, 22px);
          font-weight: 400;
          line-height: 1.65;
          white-space: pre-wrap;
        }
        .project-info-block {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          padding: 48px var(--page-pad);
          border-top: 1px solid var(--lavender);
        }
        @media (max-width: 768px) {
          .challenge-solution,
          .project-info-block {
            grid-template-columns: 1fr !important;
          }
          .credits-block {
            flex-direction: column !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}

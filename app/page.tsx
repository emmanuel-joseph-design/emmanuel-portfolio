import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProjectCard from '@/components/ProjectCard';
import IntroAnimation from '@/components/IntroAnimation';
import { getProjects } from '@/lib/projects';

export default async function Home() {
  const projects = await getProjects();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <IntroAnimation />
      <Navbar />

      <main style={{ padding: '0 var(--page-pad)', flex: 1 }}>
        {/* Hero */}
        <section
          className="fade-up"
          style={{ paddingTop: '80px', paddingBottom: '80px' }}
        >
          <h1
            style={{
              fontSize: 'clamp(42px, 4vw, 52px)',
              fontWeight: 900,
              fontStyle: 'italic',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              marginBottom: '48px',
            }}
          >
            Hi, I&apos;m Emmanuel — I help businesses look sharp, sound clear, and stand out for the right reasons. Through brand and marketing design, I turn ideas into visuals that actually do their job.
          </h1>

          <div style={{ display: 'flex', gap: '12px', width: '50%' }}>
            <a href="#work" className="cta-outlined" style={{ flex: 1, justifyContent: 'center' }}>
              Explore my work ↓
            </a>
            <Link href="/contact" className="cta-solid" style={{ flex: 1, justifyContent: 'center' }}>
              Get in touch
            </Link>
          </div>
        </section>

        {/* Project Grid */}
        <section id="work" style={{ paddingBottom: '80px' }}>
          {projects.length === 0 ? (
            <p style={{ opacity: 0.4, fontSize: '16px' }}>No projects yet.</p>
          ) : (
            <div className="project-grid">
              {projects.map((project, i) => (
                <div key={project.id} className={`fade-up delay-${Math.min(i + 1, 4)}`}>
                  <ProjectCard project={project} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />

      <style>{`
        .cta-outlined {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 24px;
          border-radius: var(--radius-pill);
          border: 1.5px solid var(--purple);
          color: var(--purple);
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          text-decoration: none;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .cta-outlined:hover { opacity: 0.7; }

        .cta-solid {
          display: inline-flex;
          align-items: center;
          padding: 14px 24px;
          border-radius: var(--radius-pill);
          background: var(--purple);
          color: var(--white);
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .cta-solid:hover { opacity: 0.85; }

        .project-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 32px;
        }

        @media (max-width: 768px) {
          .project-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

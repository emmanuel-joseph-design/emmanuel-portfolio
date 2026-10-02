import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';

const EXPERIENCE = [
  { company: 'Dillali', period: 'Jan 2022 — Oct 2022' },
  { company: 'Lykdat', period: 'Jan 2023 — Mar 2025' },
  { company: 'JAN3', period: 'May 2025 — Sep 2025' },
];

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      <main style={{ padding: '0 var(--page-pad)', flex: 1 }}>
        {/* Bio and image */}
        <section
          className="about-hero"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.8fr)',
            alignItems: 'start',
            gap: 'clamp(32px, 6vw, 96px)',
            paddingTop: '72px',
            paddingBottom: '72px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
            }}
          >
            <p
              className="fade-up"
              style={{
                fontSize: 'clamp(28px, 2.6vw, 36px)',
                fontWeight: 900,
                fontStyle: 'italic',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              Emmanuel Joseph is a brand and marketing designer with a strong focus on building
              distinctive visual identities and high-performing campaigns.
            </p>
            <p
              className="fade-up delay-1"
              style={{
                fontSize: 'clamp(28px, 2.6vw, 36px)',
                fontWeight: 400,
                fontStyle: 'italic',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                opacity: 0.75,
              }}
            >
              Drawing on his experience across digital products and startups, he combines
              strategic thinking with creative execution to help brands connect with their
              target audience and grow with clarity and impact.
            </p>
          </div>

          <div
            className="fade-up delay-2"
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 'var(--radius-md)',
              aspectRatio: '5/4',
            }}
          >
            <Image
              src="/media/about/emmanuel-joseph.png"
              alt="Emmanuel Joseph seated by a window overlooking London"
              fill
              sizes="(max-width: 900px) 100vw, 45vw"
              style={{ objectFit: 'cover', objectPosition: 'center calc(50% - 20px)' }}
              priority
            />
          </div>
        </section>

        {/* Experience */}
        <section
          className="fade-up delay-3"
          style={{ paddingBottom: '80px', maxWidth: '700px' }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.5,
              marginBottom: '24px',
            }}
          >
            Experience
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {EXPERIENCE.map(({ company, period }) => (
              <div
                key={company}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '18px 0',
                  borderBottom: '1px solid var(--lavender)',
                }}
              >
                <span style={{ fontSize: '20px', fontWeight: 800 }}>{company}</span>
                <span style={{ fontSize: '14px', fontWeight: 500, opacity: 0.6 }}>{period}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />

      <style>{`
        @media (max-width: 900px) {
          .about-hero {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import FJMonogram from './FJMonogram';
import TagPill from './TagPill';

interface NavbarProps {
  projectTitle?: string;
  projectCategories?: string[];
  projectYear?: number;
}

const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/work', label: 'Index' },
];

export default function Navbar({ projectTitle, projectCategories, projectYear }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === '/';
  const isProject = pathname.startsWith('/project/');

  const activePage = isHome
    ? null
    : isProject
    ? projectTitle
    : NAV_LINKS.find((l) => pathname.startsWith(l.href))?.label;

  const otherLinks = isProject
    ? []
    : NAV_LINKS.filter((l) => !pathname.startsWith(l.href));

  return (
    <>
      <nav className="site-nav">
        {/* Left: FJ logo (link) + wordmark (separate span) */}
        <div className="nav-left">
          <Link href="/" className="nav-logo-link">
            <FJMonogram size={40} />
            {!isProject && (
              <span className="nav-wordmark">
                Emmanuel Folusho Joseph
              </span>
            )}
          </Link>
        </div>

        {/* Right */}
        <div className="nav-right">
          {/* Active page pill */}
          {activePage && (
            <span className="nav-active-pill">{activePage}</span>
          )}

          {/* Project page: tags + year + back */}
          {isProject && (
            <>
              {projectCategories?.map((cat) => (
                <TagPill key={cat} label={cat} variant="outlined" size="sm" height={40} />
              ))}
              {projectYear && (
                <TagPill label={String(projectYear)} variant="outlined" size="sm" height={40} />
              )}
              <button className="nav-back-btn" onClick={() => router.back()} aria-label="Go back">
                ←
              </button>
            </>
          )}

          {/* Inactive nav links */}
          {!isProject && otherLinks.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link">
              {l.label}
            </Link>
          ))}

          {/* Mobile back button (inner pages only) */}
          {!isHome && !isProject && (
            <button className="nav-back-btn mobile-back" onClick={() => router.back()} aria-label="Go back">
              ←
            </button>
          )}
        </div>
      </nav>

      <style>{`
        .site-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--page-pad);
          height: var(--nav-height);
          position: sticky;
          top: 0;
          background-color: #FFFFFF;
          z-index: 100;
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .nav-logo-link {
          display: flex;
          align-items: center;
          gap: 10px;
          background: none !important;
          border: none !important;
          padding: 0 !important;
          text-decoration: none !important;
          line-height: 0;
        }

        .nav-wordmark {
          font-size: 15px;
          font-weight: 700;
          color: #FFFFFF;
          background-color: #B300EF;
          white-space: nowrap;
          height: 40px;
          padding: 0 16px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nav-link {
          font-size: 14px;
          font-weight: 600;
          color: #B300EF !important;
          background-color: #F3D9FF !important;
          border: none !important;
          text-decoration: none !important;
          height: 40px;
          padding: 0 16px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          transition: opacity 0.18s ease, transform 0.18s ease;
          transform-origin: center;
        }

        .nav-link:hover {
          opacity: 0.75;
          transform: scale(0.96);
        }

        .nav-link:active {
          transform: scale(0.92);
          opacity: 0.6;
        }

        @keyframes pillIn {
          from {
            opacity: 0;
            transform: scale(0.88);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .nav-active-pill {
          display: inline-flex;
          align-items: center;
          height: 40px;
          padding: 0 16px;
          border-radius: 6px;
          background-color: #B300EF;
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 700;
          animation: pillIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .nav-back-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1.5px solid #B300EF;
          color: #B300EF;
          background: none;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }

        @media (max-width: 768px) {
          .nav-wordmark { display: none; }
          .mobile-back { display: inline-flex; }
        }

        @media (min-width: 769px) {
          .mobile-back { display: none; }
        }
      `}</style>
    </>
  );
}

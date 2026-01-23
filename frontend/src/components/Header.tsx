import React, { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import './Header.css';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
    }
    
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        const headerHeight = 63.6; // Match the header height from CSS
        const elementPosition = element.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({
          top: elementPosition,
          behavior: 'smooth'
        });
      }
    }, 10);
    
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <h1>OSRS RAID SIM</h1>
            </div>

            <nav className={`nav ${isMobileMenuOpen ? 'nav-open' : ''}`}>
              <a href="#gear" className="nav-link" onClick={(e) => scrollToSection('gear', e)}>Gear Selection</a>
              <a href="#rooms" className="nav-link" onClick={(e) => scrollToSection('rooms', e)}>Room Selection</a>
              <a href="#plots" className="nav-link" onClick={(e) => scrollToSection('plots', e)}>Statistics</a>
              <button
                className="nav-link about-btn"
                style={{ marginLeft: '1rem', fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => setShowAbout(true)}
                aria-label="About this project"
              >
                About
              </button>
            </nav>

            <div className="header-actions">

              {/* GitHub icon link */}
              <a
                href="https://github.com/Synderis/speedrunners-of-osrs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View on GitHub"
                style={{ display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="25"
                  height="25"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-secondary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ verticalAlign: 'middle' }}
                >
                  <path d="M12 2C6.477 2 2 6.484 2 12.012c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.833.091-.646.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.254-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.396.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.847-2.337 4.695-4.566 4.944.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .268.18.579.688.481C19.138 20.188 22 16.435 22 12.012 22 6.484 17.523 2 12 2z" />
                </svg>
              </a>

              <button 
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>

              <button 
                className="mobile-menu-toggle"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle mobile menu"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* About Modal */}
      {showAbout && (
        <div
          className="about-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowAbout(false)}
        >
          <div
            style={{
              background: theme === 'light' ? '#fff' : '#222',
              color: theme === 'light' ? '#222' : '#fff',
              padding: '2rem 2.5rem',
              borderRadius: '12px',
              boxShadow: '0 4px 32px #0004',
              maxWidth: '600px',
              textAlign: 'center',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAbout(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: 'inherit'
              }}
              aria-label="Close about modal"
            >
              ×
            </button>
            <h2 style={{ marginBottom: '1rem' }}>About This Project</h2>
            <p style={{ fontSize: '1.05rem', marginBottom: '1.2rem' }}>
              <strong>Speedrunners of OSRS</strong> is an open-source tool for Old School RuneScape players to analyze gear, simulate raid rooms, and optimize strategies for the Chambers of Xeric. Built with TypeScript and Rust, it features interactive stat cards, optimal reset threshold calculations, CSV export, and customizable gear/inventory setups. <br /><br />
              Contributions are welcome in any capacity, we accept any coding language (preferably <strong>TypeScript</strong> and <strong>Rust</strong>). <a href="https://github.com/Synderis/speedrunners-of-osrs" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>GitHub page</a>.
            </p>
            <div style={{ fontSize: '1rem' }}>
              Special thanks to Pecanbread12, Wes J, Kaudal, and Ryksyy for their contributions to the project.
            </div>
            <div style={{ fontSize: '0.95rem', color: theme === 'light' ? '#444' : '#ccc' }}>
              Developed by Synderis. &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;

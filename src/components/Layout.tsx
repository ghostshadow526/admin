import { ReactNode, useEffect } from 'react';
import { LogOut, Settings, User } from 'lucide-react';
import feather from 'feather-icons';

interface LayoutProps {
  children: ReactNode;
  currentEmail?: string;
  onLogout?: () => void;
  onPageChange?: (page: 'dashboard' | 'admins' | 'gallery' | 'buy-rice') => void;
  currentPage?: string;
}

export default function Layout({ children, currentEmail, onLogout, onPageChange, currentPage }: LayoutProps) {
  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      try {
        feather.replace();
      } catch {
        // no-op
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  });

  return (
    <div className="wrapper">
      {/* Sidebar */}
      <nav id="sidebar" className="sidebar js-sidebar">
        <div className="sidebar-content js-simplebar">
          <a className="sidebar-brand" href="#/">
            <span className="align-middle">AdminKit</span>
          </a>

          <ul className="sidebar-nav">
            <li className="sidebar-header">Pages</li>

            <li className="sidebar-item">
              <a 
                className={`sidebar-link ${currentPage === 'dashboard' ? 'active' : ''}`} 
                href="#/" 
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange?.('dashboard');
                }}
              >
                <i className="align-middle" data-feather="sliders"></i>{' '}
                <span className="align-middle">Dashboard</span>
              </a>
            </li>

            <li className="sidebar-item">
              <a 
                className={`sidebar-link ${currentPage === 'admins' ? 'active' : ''}`} 
                href="#/" 
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange?.('admins');
                }}
              >
                <i className="align-middle" data-feather="shield"></i>{' '}
                <span className="align-middle">Create Admins</span>
              </a>
            </li>

            <li className="sidebar-item">
              <a 
                className={`sidebar-link ${currentPage === 'gallery' ? 'active' : ''}`} 
                href="#/" 
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange?.('gallery');
                }}
              >
                <i className="align-middle" data-feather="image"></i>{' '}
                <span className="align-middle">Gallery</span>
              </a>
            </li>

            <li className="sidebar-item">
              <a
                className={`sidebar-link ${currentPage === 'buy-rice' ? 'active' : ''}`}
                href="#/"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange?.('buy-rice');
                }}
              >
                <i className="align-middle" data-feather="shopping-cart"></i>{' '}
                <span className="align-middle">Buy Rice</span>
              </a>
            </li>
          </ul>

          <div className="sidebar-cta">
            <div className="sidebar-cta-content">
              <strong className="d-inline-block mb-2">Admin Panel</strong>
              <div className="mb-3 text-sm">Manage users and upgrade access</div>
              <div className="d-grid">
                <button onClick={onLogout} className="btn btn-primary">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="main">
        {/* Navbar */}
        <nav className="navbar navbar-expand navbar-light navbar-bg">
          <a className="sidebar-toggle js-sidebar-toggle">
            <i className="hamburger align-self-center"></i>
          </a>

          <div className="navbar-collapse collapse">
            <ul className="navbar-nav navbar-align">
              <li className="nav-item dropdown">
                <a
                  className="nav-link dropdown-toggle d-none d-sm-inline-block"
                  href="#/"
                  data-bs-toggle="dropdown"
                >
                  <User className="align-middle me-1" size={18} />
                  <span className="text-dark">{currentEmail}</span>
                </a>
                <div className="dropdown-menu dropdown-menu-end">
                  <a className="dropdown-item" href="#/">
                    <Settings className="align-middle me-1" size={16} /> Settings
                  </a>
                  <div className="dropdown-divider"></div>
                  <a className="dropdown-item" href="#/" onClick={onLogout}>
                    <LogOut className="align-middle me-1" size={16} /> Log out
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </nav>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}

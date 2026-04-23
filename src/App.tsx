import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import AdminPanel from './components/AdminPanel';
import LoginPage from './pages/Login';
import 'bootstrap/dist/css/bootstrap.min.css';
import './adminkit.css';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if admin is already logged in
    const storedEmail = localStorage.getItem('adminEmail');
    if (storedEmail) {
      setIsLoggedIn(true);
      setAdminEmail(storedEmail);
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminUid');
    setIsLoggedIn(false);
    setAdminEmail(null);
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Toaster />
      {!isLoggedIn ? (
        <LoginPage onLoginSuccess={() => {
          const email = localStorage.getItem('adminEmail');
          if (email) {
            setAdminEmail(email);
            setIsLoggedIn(true);
          }
        }} />
      ) : (
        <AdminPanel currentEmail={adminEmail || ''} onLogout={handleLogout} />
      )}
    </div>
  );
}

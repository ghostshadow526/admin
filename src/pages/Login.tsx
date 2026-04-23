import { useState, FormEvent } from 'react';
import { loginAdmin } from '../firebase';
import { toast } from 'sonner';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('admintest@gmail.com');
  const [password, setPassword] = useState('Clown123$$');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginAdmin(email, password);
      toast.success('Successfully logged in!');
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      const errorMsg = error.code === 'auth/user-not-found' 
        ? 'User not found'
        : error.code === 'auth/wrong-password'
        ? 'Incorrect password'
        : error.code === 'auth/invalid-email'
        ? 'Invalid email'
        : error.message || 'Login failed. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="d-flex w-100">
      <div className="container d-flex flex-column">
        <div className="row vh-100">
          <div className="col-sm-10 col-md-8 col-lg-6 col-xl-5 mx-auto d-table h-100">
            <div className="d-table-cell align-middle">
              <div className="text-center mt-4">
                <h1 className="h2">Welcome back!</h1>
                <p className="lead">Sign in to your account to continue</p>
              </div>

              <div className="card">
                <div className="card-body">
                  <div className="m-sm-3">
                    <form onSubmit={handleSubmit}>
                      <div className="mb-3">
                        <label className="form-label">Email</label>
                        <input
                          className="form-control form-control-lg"
                          type="email"
                          name="email"
                          placeholder="clhoetash@gmail.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Password</label>
                        <input
                          className="form-control form-control-lg"
                          type="password"
                          name="password"
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <div className="form-check align-items-center">
                          <input
                            id="customControlInline"
                            type="checkbox"
                            className="form-check-input"
                            value="remember-me"
                            name="remember-me"
                            defaultChecked
                          />
                          <label
                            className="form-check-label text-small"
                            htmlFor="customControlInline"
                          >
                            Remember me
                          </label>
                        </div>
                      </div>
                      <div className="d-grid gap-2 mt-3">
                        <button
                          type="submit"
                          disabled={loading}
                          className="btn btn-lg btn-primary"
                        >
                          {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              <div className="text-center mb-3 mt-3">
                <span className="text-muted">Admin access required</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

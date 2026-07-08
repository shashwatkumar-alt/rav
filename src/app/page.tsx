'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function HeroLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hero-root">
      {/* ── Fullscreen Video Background ── */}
      <video
        className="hero-video"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
      </video>

      {/* ── Navigation ── */}
      <nav className="hero-nav-wrapper" aria-label="Main navigation">
        <div className="hero-nav">
          {/* Logo */}
          <span
            className="hero-nav-logo"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            R.A.V. Public School
          </span>

          {/* Single Login Button */}
          <button
            id="nav-login"
            type="button"
            className="hero-nav-cta liquid-glass"
            onClick={() => setShowLogin(true)}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1.5px solid rgba(255,255,255,0.55)',
              fontWeight: 500,
              letterSpacing: '0.03em',
            }}
          >
            Login
          </button>
        </div>
      </nav>

      {/* ── Hero Content ── */}
      <section className="hero-content" aria-labelledby="hero-heading">
        <h1
          id="hero-heading"
          className="hero-h1 animate-fade-rise"
          style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-2.46px' }}
        >
          R.A.V. Public School
        </h1>

        <p className="hero-subtext animate-fade-rise-delay">
          At R.A.V. Public School, we nurture curious minds, build strong character, and
          empower each learner to achieve excellence — inside the classroom and beyond.
        </p>

        <button
          id="hero-login"
          type="button"
          className="hero-cta liquid-glass animate-fade-rise-delay-2"
          onClick={() => setShowLogin(true)}
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: '1.5px solid rgba(255,255,255,0.55)',
            fontWeight: 500,
            letterSpacing: '0.04em',
          }}
        >
          Login
        </button>
      </section>

      {/* ── Login Overlay ── */}
      {showLogin && (
        <div
          className="hero-login-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Admin login"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogin(false);
          }}
          style={{ background: 'rgba(0, 0, 10, 0.05)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
        >
          <div
            className="hero-login-card animate-fade-rise"
            style={{
              background: 'rgba(8, 12, 28, 0.92)',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            {/* Close */}
            <button
              type="button"
              aria-label="Close login"
              onClick={() => setShowLogin(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 20,
                background: 'none',
                border: 'none',
                color: 'var(--muted-foreground)',
                fontSize: 22,
                cursor: 'pointer',
                lineHeight: 1,
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLButtonElement).style.color = 'var(--foreground)')
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLButtonElement).style.color = 'var(--muted-foreground)')
              }
            >
              ✕
            </button>

            {/* Header */}
            <div className="hero-login-header">
              <div className="hero-login-logo">R</div>
              <h2
                className="hero-login-title"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                R.A.V. School Portal
              </h2>
              <p className="hero-login-subtitle">Admin Result Generation System</p>
            </div>

            {/* Error */}
            {error && (
              <div className="error-message" role="alert">
                <span>⚠</span> {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  className="form-input"
                  type="text"
                  placeholder="Enter admin username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  className="form-input"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                id="login-submit"
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

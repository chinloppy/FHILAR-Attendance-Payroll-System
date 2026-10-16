
import React, { useState } from "react";

/* FHILAR login is sign-in only. Admin creation belongs in CEO Settings. */
export default function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(form);
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-art">
        <div className="auth-art-top">
          <img src="/fhilar-logo.png" alt="FHILAR Apparel" />
          <span>THE WORKPLACE STUDIO · 2026</span>
        </div>
        <div className="auth-editorial">
          <span className="auth-label">✿ AN ORGANIZED DAY IS A LOVELY DAY</span>
          <h1>Workdays,<br /><em>made lovely.</em></h1>
          <p>Attendance, fair hourly pay, and thoughtful team management in one pretty little space.</p>
          <div className="auth-collage" aria-hidden="true">
            <div className="auth-sticker sticker-one">♡</div>
            <div className="auth-papers">
              <small>FHILAR'S DAILY NOTE</small>
              <strong>every hour<br />matters.</strong>
              <span>✿ ✧ ✿</span>
            </div>
            <div className="auth-sticker sticker-two">the payroll edit ↗</div>
          </div>
        </div>
        <div className="auth-art-bottom">thoughtfully made for the FHILAR team ♡</div>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <span className="eyebrow">✧ AUTHORIZED TEAM ACCESS</span>
          <h2>Welcome back, lovely.</h2>
          <p>Sign in using the account provided by your Super Administrator.</p>
          <form onSubmit={submit} className="auth-form">
            <label>
              Email Address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="admin@fhilar.com"
                value={form.email}
                onChange={e => setForm(current => ({ ...current, email: e.target.value }))}
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(current => ({ ...current, password: e.target.value }))}
                />
                <button type="button" onClick={() => setVisible(show => !show)}>
                  {visible ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button type="submit" disabled={busy} className="btn btn-primary auth-submit">
              {busy ? "Signing you in…" : "Sign In to FHILAR ↗"}
            </button>
            <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
              ♡ Need an account or password reset? Contact the FHILAR Super Admin.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

/*
 * Shown BEFORE the main app whenever a new or reset Admin signs in using
 * their temporary password. The user's own temporary password is required
 * to set a new password; the CEO cannot view saved passwords.
 */
export function FirstLoginPasswordChange({ admin, onSave, onLogout }) {
  const [form, setForm] = useState({ old: "", next: "", confirm: "" });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const saved = await onSave(form.old, form.next, form.confirm);
      if (!saved) setError("Unable to change password. Check your entries and try again.");
    } catch (err) {
      setError(err.message || "Password change failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-art">
        <div className="auth-art-top">
          <img src="/fhilar-logo.png" alt="FHILAR Apparel" />
          <span>FHILAR · FIRST SIGN-IN</span>
        </div>
        <div className="auth-editorial">
          <span className="auth-label">✿ A FRESH START, JUST FOR YOU</span>
          <h1>Make it<br /><em>your own.</em></h1>
          <p>Your Super Admin has created your account. Set a personal password before continuing.</p>
        </div>
        <div className="auth-art-bottom">a little extra care for your account ♡</div>
      </section>
      <section className="auth-form-side">
        <div className="auth-card">
          <span className="eyebrow">✧ FIRST-TIME ACCOUNT SETUP</span>
          <h2>Hello, {admin.name}! ♡</h2>
          <p>Replace the temporary password from your Super Admin to access the FHILAR workspace.</p>
          <form className="auth-form" onSubmit={submit}>
            <label>
              Temporary Password
              <div className="password-field">
                <input
                  required
                  autoComplete="current-password"
                  type={visible ? "text" : "password"}
                  value={form.old}
                  onChange={e => setForm(old => ({ ...old, old: e.target.value }))}
                  placeholder="Password provided by CEO"
                />
                <button type="button" onClick={() => setVisible(x => !x)}>
                  {visible ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <label>
              New Personal Password
              <input
                required
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={form.next}
                onChange={e => setForm(old => ({ ...old, next: e.target.value }))}
                placeholder="At least 8 characters"
              />
            </label>
            <label>
              Confirm New Password
              <input
                required
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={form.confirm}
                onChange={e => setForm(old => ({ ...old, confirm: e.target.value }))}
                placeholder="Re-enter your new password"
              />
            </label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button type="submit" disabled={busy} className="btn btn-primary auth-submit">
              {busy ? "Saving your password…" : "Set My Password & Continue ♡"}
            </button>
            <button type="button" className="btn btn-outline" onClick={onLogout}>
              Sign Out Instead
            </button>
            <p className="muted" style={{ fontSize: 12 }}>
              You can change this password again later in Settings → My Account.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

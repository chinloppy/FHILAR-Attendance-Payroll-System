
import React, { useEffect, useState } from "react";
import { getShiftLabel } from "../utils/payroll";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";

function displayAccountDate(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return parsed.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

const EMPTY_ADMIN = { name: "", email: "" };

export default function Settings({
  data,
  admin,
  updateSettings,
  resetDemo,
  saveAdminProfile,
  saveAdminPassword,
  listAdmins,
  createAdminAccount,
  resetAdminPassword,
  deleteAdmin,
  reactivateAdmin
}) {
  const isCEO = admin?.role === "super_admin";

  const [settingsForm, setSettingsForm] = useState(
    () => JSON.parse(JSON.stringify(data.settings))
  );
  const [profileName, setProfileName] = useState(admin.name);
  const [passwordForm, setPasswordForm] = useState({ old: "", next: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [creating, setCreating] = useState(false);
  const [resettingAccount, setResettingAccount] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [accountRevision, setAccountRevision] = useState(0);
  const [accountSearch, setAccountSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [resetPhrase, setResetPhrase] = useState("");

  useEffect(() => {
    setSettingsForm(JSON.parse(JSON.stringify(data.settings)));
  }, [data.settings]);

  useEffect(() => {
    setProfileName(admin.name);
  }, [admin.name]);

  function changeShift(id, key, value) {
    setSettingsForm(previous => ({
      ...previous,
      shifts: {
        ...previous.shifts,
        [id]: { ...previous.shifts[id], [key]: value }
      }
    }));
  }

  function updateProfile(event) {
    event.preventDefault();
    if (saveAdminProfile({ name: profileName })) {
      setFeedback("Your profile has been updated! ♡");
    }
  }

  async function updatePassword(event) {
    event.preventDefault();
    setSavingPassword(true);
    try {
      const success = await saveAdminPassword(
        passwordForm.old,
        passwordForm.next,
        passwordForm.confirm
      );
      if (success) {
        setPasswordForm({ old: "", next: "", confirm: "" });
        setFeedback("Your password has been changed! ♡");
      }
    } finally {
      setSavingPassword(false);
    }
  }

  async function createAccount(event) {
    event.preventDefault();
    if (!isCEO || creating) return;
    setCreating(true);
    try {
      const result = await createAdminAccount(adminForm);
      if (result?.temporaryPassword) {
        setCredentials({ ...result, mode: "created" });
        setAdminForm(EMPTY_ADMIN);
        setAccountRevision(n => n + 1);
        setCopyStatus("");
      }
    } finally {
      setCreating(false);
    }
  }

  async function confirmPasswordReset(account) {
    setConfirmAction(null);
    setResettingAccount(true);
    try {
      const result = await resetAdminPassword(account.id);
      if (result?.temporaryPassword) {
        setCredentials({ ...result, mode: "reset" });
        setCopyStatus("");
        setAccountRevision(n => n + 1);
      }
    } finally {
      setResettingAccount(false);
    }
  }

  async function copyPassword() {
    if (!credentials) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(credentials.temporaryPassword);
      setCopyStatus("Copied! Share privately with the new admin. ♡");
    } catch {
      setCopyStatus("Select and copy the temporary password manually.");
    }
  }

  function confirmDeactivate(account) {
    const success = deleteAdmin(account.id);
    if (success) {
      setConfirmAction(null);
      setAccountRevision(n => n + 1);
    }
    return success;
  }

  function confirmReactivate(account) {
    const success = reactivateAdmin(account.id);
    if (success) {
      setConfirmAction(null);
      setAccountRevision(n => n + 1);
    }
    return success;
  }

  // Re-evaluate after accountRevision changes from CEO actions.
  // eslint-disable-next-line no-unused-vars
  const revision = accountRevision;
  const allAccounts = isCEO ? listAdmins() : [];
  const accountRows = allAccounts.filter(account =>
    `${account.name} ${account.email} ${account.role} ${account.status}`
      .toLowerCase()
      .includes(accountSearch.toLowerCase())
  );

  return (
    <div className="page-enter">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>Studio Settings <span>♡</span></h1>
          <p>
            {isCEO
              ? "Your profile, team accounts, and company settings in one lovely place."
              : "View your complete account details and manage your personal password."}
          </p>
        </div>
      </div>

      {/* MY ACCOUNT — BOTH ADMIN AND SUPER ADMIN */}
      <section className="panel settings-panel">
        <span className="eyebrow">MY ACCOUNT · ACCOUNT VIEWING</span>
        <h3>Your Account Profile ♡</h3>
        <div className="settings-account-info">
          <span className="employee-avatar">{(admin.name || "A").charAt(0).toUpperCase()}</span>
          <div>
            <strong>{admin.name}</strong>
            <small>{admin.email}</small>
            <small>{isCEO ? "Super Administrator · CEO" : "Administrator"}</small>
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: 20 }}>
          <label>
            Full Name
            <input value={admin.name} readOnly />
          </label>
          <label>
            Email Address
            <input value={admin.email} readOnly />
          </label>
          <label>
            Account Role
            <input value={isCEO ? "Super Admin · CEO" : "Admin"} readOnly />
          </label>
          <label>
            Account Status
            <input value={admin.status || "Active"} readOnly />
          </label>
          <label>
            Account Created
            <input value={admin.createdAt ? displayAccountDate(admin.createdAt) : "Preconfigured system account"} readOnly />
          </label>
          <label>
            Last Successful Sign In
            <input value={displayAccountDate(admin.lastLoginAt)} readOnly />
          </label>
          <label>
            Password Last Changed
            <input value={displayAccountDate(admin.passwordChangedAt)} readOnly />
          </label>
          <label>
            Account ID
            <input value={admin.id} readOnly title={admin.id} />
          </label>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          ♡ Passwords are never displayed in your account information. The CEO can issue a new temporary password instead.
        </p>

        <h4 style={{ marginTop: 28 }}>Edit My Profile</h4>
        <form className="toolbar" onSubmit={updateProfile}>
          <label>
            Display Name
            <input
              required
              minLength={2}
              maxLength={100}
              value={profileName}
              onChange={event => setProfileName(event.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit">Save My Profile ♡</button>
        </form>

        <h4 style={{ marginTop: 28 }}>Change Password</h4>
        <p className="muted">Enter your current password. The new one must be at least eight characters.</p>
        <form className="form-grid" onSubmit={updatePassword}>
          <label>
            Current Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={passwordForm.old}
              onChange={event => setPasswordForm(old => ({ ...old, old: event.target.value }))}
            />
          </label>
          <label>
            New Password
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={passwordForm.next}
              onChange={event => setPasswordForm(old => ({ ...old, next: event.target.value }))}
            />
          </label>
          <label>
            Confirm New Password
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirm}
              onChange={event => setPasswordForm(old => ({ ...old, confirm: event.target.value }))}
            />
          </label>
          <div className="modal-actions full">
            <button disabled={savingPassword} type="submit" className="btn btn-outline">
              {savingPassword ? "Updating…" : "Update My Password ♡"}
            </button>
          </div>
        </form>
        {feedback && <p className="ceo-approval-note" role="status" style={{ marginTop: 10 }}>{feedback}</p>}
      </section>

      {isCEO ? (
        <>
          {/* CREATE AN ADMIN ACCOUNT — CEO ONLY */}
          <section className="panel settings-panel">
            <span className="eyebrow">♛ SUPER ADMIN ONLY</span>
            <h3>Create an Administrator Account ✿</h3>
            <p className="muted">
              Only the CEO can issue accounts. The system generates a temporary password
              and requires the new admin to change it on their first sign-in.
            </p>
            <form className="form-grid" onSubmit={createAccount}>
              <label>
                Full Name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Administrator's full name"
                  autoComplete="off"
                  value={adminForm.name}
                  onChange={event => setAdminForm(old => ({ ...old, name: event.target.value }))}
                />
              </label>
              <label>
                Email Address
                <input
                  required
                  type="email"
                  placeholder="name@fhilar.com"
                  autoComplete="off"
                  value={adminForm.email}
                  onChange={event => setAdminForm(old => ({ ...old, email: event.target.value }))}
                />
              </label>
              <label className="full">
                Assigned Role
                <input readOnly value="Administrator (regular admin)" />
              </label>
              <div className="modal-actions full">
                <button type="submit" disabled={creating} className="btn btn-primary">
                  {creating ? "Creating account…" : "＋ Create Admin & Generate Temporary Password ♡"}
                </button>
              </div>
            </form>
          </section>

          {/* ADMIN ACCOUNT DIRECTORY — CEO ONLY */}
          <section className="panel settings-panel">
            <span className="eyebrow">♛ ACCOUNT MANAGEMENT</span>
            <h3>Manage Administrator Accounts</h3>
            <p className="muted">
              View account details, reset passwords, and deactivate/reactivate accounts.
              Deactivation is reversible and does not remove company records.
            </p>
            <div className="toolbar">
              <input
                placeholder="⌕ Search administrator name or email..."
                value={accountSearch}
                onChange={event => setAccountSearch(event.target.value)}
                aria-label="Search administrator accounts"
              />
            </div>
            <div className="admin-directory">
              {accountRows.map(account => (
                <div className="admin-directory-row" key={account.id}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{account.name}</strong>
                    <small>{account.email} · {account.role === "super_admin" ? "CEO" : "Admin"}</small>
                    <small>
                      {account.status} · Created: {account.createdAt ? displayAccountDate(account.createdAt) : "Preconfigured"}
                    </small>
                    <small>Last login: {displayAccountDate(account.lastLoginAt)}</small>
                    {account.mustChangePassword && (
                      <small style={{ color: "#ad6783" }}>✿ Temporary password · change required</small>
                    )}
                  </div>
                  <div className="table-actions" style={{ flexWrap: "wrap" }}>
                    {account.role === "super_admin" ? (
                      <span className="status pink">CEO</span>
                    ) : (
                      <>
                        {account.status === "Active" && (
                          <button
                            type="button"
                            className="text-button"
                            disabled={resettingAccount}
                            onClick={() => setConfirmAction({ type: "reset", account })}
                          >
                            Reset Password
                          </button>
                        )}
                        <button
                          type="button"
                          className={`text-button ${account.status === "Active" ? "danger-text" : ""}`}
                          onClick={() => setConfirmAction({ type: account.status === "Active" ? "deactivate" : "reactivate", account })}
                        >
                          {account.status === "Active" ? "Deactivate" : "Reactivate"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!accountRows.length && <p className="empty">No matching admin accounts found.</p>}
            </div>
          </section>

          {/* KEEP THE ORIGINAL CEO COMPANY SETTINGS */}
          <form onSubmit={event => {
            event.preventDefault();
            updateSettings(settingsForm);
          }}>
            <section className="panel settings-panel">
              <span className="eyebrow">COMPANY CONFIGURATION</span>
              <h3>Company Information</h3>
              <label>
                Company Name
                <input
                  required
                  value={settingsForm.company}
                  onChange={event => setSettingsForm(old => ({ ...old, company: event.target.value }))}
                />
              </label>
            </section>
            <section className="panel settings-panel">
              <span className="eyebrow">SALARY CONFIGURATION</span>
              <h3>Shift Schedules & Hourly Rates</h3>
              <p className="muted">New rates apply to future attendance. Existing records retain their saved rates.</p>
              <div className="shift-settings">
                {Object.entries(settingsForm.shifts).map(([id, shift]) => (
                  <div className="shift-setting" key={id}>
                    <strong>{shift.label}</strong>
                    <span className="shift-caption">{getShiftLabel({ shift: id }, settingsForm)}</span>
                    <div className="form-grid">
                      <label>
                        Shift Starts
                        <input type="time" required value={shift.start}
                          onChange={event => changeShift(id, "start", event.target.value)} />
                      </label>
                      <label>
                        Shift Ends
                        <input type="time" required value={shift.end}
                          onChange={event => changeShift(id, "end", event.target.value)} />
                      </label>
                      <label className="full">
                        Base Hourly Rate (₱)
                        <input type="number" min="0.01" step="any" required value={shift.rate}
                          onChange={event => changeShift(id, "rate", event.target.value)} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel settings-panel">
              <span className="eyebrow">NIGHT SHIFT RULES</span>
              <h3>Night Differential</h3>
              <div className="form-grid">
                <label>
                  Differential (%)
                  <input type="number" min="0" max="100" step="0.01" required
                    value={settingsForm.nightPercent}
                    onChange={event => setSettingsForm(old => ({ ...old, nightPercent: event.target.value }))} />
                </label>
                <label>
                  Night Starts
                  <input type="time" required value={settingsForm.nightStart}
                    onChange={event => setSettingsForm(old => ({ ...old, nightStart: event.target.value }))} />
                </label>
                <label>
                  Night Ends
                  <input type="time" required value={settingsForm.nightEnd}
                    onChange={event => setSettingsForm(old => ({ ...old, nightEnd: event.target.value }))} />
                </label>
              </div>
            </section>
            <button className="btn btn-primary" type="submit">♛ Save Company Payroll Settings</button>
          </form>

          <section className="panel reset-panel">
            <span className="eyebrow">♛ EXECUTIVE DATA CONTROL</span>
            <h3>Reset Shared Workspace</h3>
            <p className="muted">
              Clears company records from the active workspace and moves a backup into Archives.
              Registered admin accounts remain. An Archives backup can be restored into an empty workspace.
            </p>
            <button type="button" className="btn btn-outline" onClick={() => { setResetPhrase(""); setConfirmAction({ type: "workspace" }); }}>
              Reset Company Records
            </button>
          </section>
        </>
      ) : (
        <section className="panel">
          <span className="eyebrow">COMPANY ACCESS</span>
          <h3>Managed by the Super Admin ♛</h3>
          <p className="muted">
            Administrator account creation, password resets, company payroll settings,
            and workspace reset are available only to the CEO.
          </p>
        </section>
      )}

      {/* ONE-TIME PASSWORD HANDOFF */}
      {credentials && (
        <Modal title="A little account welcome ♡" onClose={() => setCredentials(null)}>
          <div className="fhilar-confirm" style={{ display: "grid", gap: 14 }}>
            <div className="fhilar-confirm-symbol" aria-hidden="true">✿</div>
            <h3>{credentials.mode === "created" ? "Admin account created!" : "Temporary password renewed!"}</h3>
            <p>
              Share these credentials privately with <strong>{credentials.account.name}</strong>.
              The password is shown here <strong>once only</strong>. It cannot be retrieved after closing.
            </p>
            <label>
              Email Address
              <input readOnly value={credentials.account.email} onFocus={e => e.target.select()} />
            </label>
            <label>
              Temporary Password
              <input readOnly value={credentials.temporaryPassword} onFocus={e => e.target.select()} />
            </label>
            <button type="button" className="btn btn-outline" onClick={copyPassword}>
              Copy Temporary Password ♡
            </button>
            {copyStatus && <p role="status" className="muted">{copyStatus}</p>}
            <p className="muted">
              On first login, the Admin must replace this temporary password before opening the FHILAR Dashboard.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setCredentials(null)}>
                I've Saved the Password ✿
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* SPECIAL RESET CONFIRMATION — backup is kept in Archives */}
      {confirmAction?.type === "workspace" && (
        <Modal title="A little executive confirmation ♡" onClose={() => setConfirmAction(null)}>
          <div className="fhilar-confirm" style={{ display: "grid", gap: 14 }}>
            <div className="fhilar-confirm-symbol" aria-hidden="true">✿</div>
            <h3>Reset and archive this workspace?</h3>
            <p>
              The active records will be cleared. A workspace recovery snapshot will be saved
              in Archives, and administrator accounts will remain available.
            </p>
            <label>
              Type <strong>RESET</strong> to confirm
              <input
                value={resetPhrase}
                onChange={event => setResetPhrase(event.target.value)}
                placeholder="RESET"
                autoComplete="off"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmAction(null)}>
                Keep Company Records ♡
              </button>
              <button type="button" className="btn btn-primary"
                disabled={resetPhrase !== "RESET"}
                onClick={() => {
                  const success = resetDemo();
                  if (success !== false) {
                    setConfirmAction(null);
                    setResetPhrase("");
                  }
                }}>
                Reset & Archive ✿
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ACCOUNT ACTION CONFIRMATIONS — NO BROWSER POPUPS */}
      {confirmAction && confirmAction.type !== "workspace" && (
        <ConfirmDialog
          title={
            confirmAction.type === "reset" ? "Issue a new temporary password? ♡" :
            confirmAction.type === "deactivate" ? "Deactivate this Admin account?" :
            "Welcome this Admin back? ♡"
          }
          message={
            confirmAction.type === "reset"
              ? `The current password for ${confirmAction.account.email} will stop working. A new temporary password will be shown once to the CEO.`
              : confirmAction.type === "deactivate"
              ? `Deactivate ${confirmAction.account.email}? Their company records will be kept and the account can be reactivated.`
              : `Allow ${confirmAction.account.email} to sign in again? Their previous password stays unchanged unless you reset it.`
          }
          danger={confirmAction.type === "deactivate"}
          confirmLabel={
            confirmAction.type === "reset" ? "Generate Password ✿" :
            confirmAction.type === "deactivate" ? "Deactivate Account" :
            "Reactivate Admin ♡"
          }
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction.type === "reset") {
              // The async operation manages its own completion and one-time modal.
              confirmPasswordReset(confirmAction.account);
              return true;
            }
            if (confirmAction.type === "deactivate") return confirmDeactivate(confirmAction.account);
            if (confirmAction.type === "reactivate") return confirmReactivate(confirmAction.account);
            return false;
          }}
        />
      )}
    </div>
  );
}

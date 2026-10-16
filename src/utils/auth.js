

import { appendAuditEvent } from "./auditLog";

export const ACCOUNTS_KEY = "fhilar-studio-demo-admin-accounts-v1";
export const SESSION_KEY = "fhilar-studio-demo-session-v1";
const CEO_PROFILE_KEY = "fhilar-studio-demo-ceo-profile-v2";

const CEO_ID = "fhilar-ceo-super-admin";
const CEO_EMAIL = "superadmin@gmail.com";
// Original classroom CEO login remains usable until the CEO changes it.
const INITIAL_CEO_PASSWORD = "finalSystem245";

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    throw new Error("Saved account information cannot be read.");
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("Unable to save account information in this browser.");
  }
}

function getAccounts() {
  const accounts = readJSON(ACCOUNTS_KEY, []);
  if (!Array.isArray(accounts)) throw new Error("Saved admin accounts are invalid.");
  return accounts;
}

function storeAccounts(accounts) {
  writeJSON(ACCOUNTS_KEY, accounts);
}

function getCEOProfile() {
  const saved = readJSON(CEO_PROFILE_KEY, {});
  return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
}

function saveCEOProfile(profile) {
  writeJSON(CEO_PROFILE_KEY, profile);
}

function bytesToHex(bytes) {
  const array = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  return Array.from(array, value => value.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  if (typeof hex !== "string" || !/^(?:[a-f\d]{2})+$/i.test(hex)) {
    throw new Error("Saved password information is invalid.");
  }
  return new Uint8Array(hex.match(/.{2}/g).map(pair => parseInt(pair, 16)));
}

function randomBytes(length) {
  if (!window.crypto?.getRandomValues) {
    throw new Error("Secure random values require localhost or HTTPS.");
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

function newSalt() {
  return bytesToHex(randomBytes(16));
}

function newId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : bytesToHex(randomBytes(16));
}

async function passwordHash(password, saltHex) {
  if (!window.crypto?.subtle) {
    throw new Error("Password operations require localhost or HTTPS.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations: 120000,
      hash: "SHA-256"
    },
    key,
    256
  );
  return bytesToHex(bits);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateNameAndEmail(name, email) {
  const cleanName = String(name || "").trim();
  const cleanEmail = normalizeEmail(email);
  if (cleanName.length < 2) throw new Error("Enter an administrator's full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Enter a valid email address.");
  }
  if (cleanEmail === CEO_EMAIL) throw new Error("That email belongs to the Super Admin.");
  return { name: cleanName, email: cleanEmail };
}

function validateNewPassword(password, confirmation, current = "") {
  if (String(password || "").length < 8) {
    throw new Error("New password must contain at least 8 characters.");
  }
  if (password !== confirmation) throw new Error("New passwords do not match.");
  if (password === current) throw new Error("Choose a new password different from the current one.");
}

function accountIsActive(account) {
  return account.active !== false;
}

function publicAccount(account) {
  if (!account) return null;
  const isCEO = account.id === CEO_ID;
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: isCEO ? "super_admin" : "admin",
    createdAt: account.createdAt || null,
    lastLoginAt: account.lastLoginAt || null,
    passwordChangedAt: account.passwordChangedAt || null,
    updatedAt: account.updatedAt || null,
    createdByName: account.createdByName || null,
    mustChangePassword: isCEO ? false : Boolean(account.mustChangePassword),
    status: accountIsActive(account) ? "Active" : "Inactive"
  };
}

function ceoAccount() {
  const profile = getCEOProfile();
  return publicAccount({
    ...profile,
    id: CEO_ID,
    email: CEO_EMAIL,
    name: profile.name || "FHILAR CEO",
    role: "super_admin",
    active: true
  });
}

function assertCEO(currentId) {
  if (currentId !== CEO_ID || sessionStorage.getItem(SESSION_KEY) !== CEO_ID) {
    throw new Error("Only the signed-in Super Admin may manage accounts.");
  }
}

// Allowlisted account metadata ONLY. No credentials, hashes, salts or secrets.
function auditAccount(action, actor, target, changes = [], reason = "") {
  try {
    appendAuditEvent({
      actor,
      module: "Admin Accounts",
      action,
      recordId: target?.id || "",
      subject: `${target?.name || "Administrator"} · ${target?.email || ""}`,
      changes,
      reason
    });
  } catch (error) {
    // Authentication state is already persisted for successful operations;
    // surface localStorage audit failures in development rather than rolling
    // back passwords or invalidating an otherwise successful sign-in.
    console.error("FHILAR audit trail could not be saved:", error);
  }
}

// Restoring a browser session does not automatically create a new login event.
export function getSessionAdmin() {
  const id = sessionStorage.getItem(SESSION_KEY);
  if (!id) return null;
  if (id === CEO_ID) return ceoAccount();
  const account = getAccounts().find(item => item.id === id);
  if (!account || !accountIsActive(account)) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
  return publicAccount(account);
}

export function listAdmins() {
  assertCEO(CEO_ID);
  return [ceoAccount(), ...getAccounts().map(publicAccount)];
}

export async function loginAdmin({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  const now = new Date().toISOString();
  if (cleanEmail === CEO_EMAIL) {
    const profile = getCEOProfile();
    let valid;
    if (profile.salt && profile.hash) {
      valid = await passwordHash(String(password || ""), profile.salt) === profile.hash;
    } else {
      valid = password === INITIAL_CEO_PASSWORD;
    }
    if (!valid) throw new Error("Incorrect email or password.");
    saveCEOProfile({ ...profile, lastLoginAt: now });
    sessionStorage.setItem(SESSION_KEY, CEO_ID);
    const signedIn = ceoAccount();
    auditAccount("Signed In", signedIn, signedIn);
    return signedIn;
  }

  const accounts = getAccounts();
  const account = accounts.find(item => normalizeEmail(item.email) === cleanEmail);
  if (!account || !accountIsActive(account) || !password) {
    throw new Error("Incorrect email or password, or account is inactive.");
  }
  const inputHash = await passwordHash(password, account.salt);
  if (inputHash !== account.hash) throw new Error("Incorrect email or password.");
  account.lastLoginAt = now;
  storeAccounts(accounts);
  sessionStorage.setItem(SESSION_KEY, account.id);
  const signedIn = publicAccount(account);
  auditAccount("Signed In", signedIn, signedIn);
  return signedIn;
}

export function logoutAdmin() {
  const signedIn = getSessionAdmin();
  if (signedIn) auditAccount("Signed Out", signedIn, signedIn);
  sessionStorage.removeItem(SESSION_KEY);
}

function makeTemporaryPassword() {
  // Displayed to the CEO once. Only the salted hash is stored.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = randomBytes(12);
  const chars = Array.from(values, n => alphabet[n % alphabet.length]);
  return `FH-${chars.join("")}!`;
}

// Public registration was intentionally removed: only an authenticated CEO
// can create an account. This function never signs the new admin in.
export async function createAdminByCEO(currentId, input) {
  assertCEO(currentId);
  const { name, email } = validateNameAndEmail(input.name, input.email);
  const accounts = getAccounts();
  if (accounts.some(item => normalizeEmail(item.email) === email)) {
    throw new Error("This email is already registered, including inactive accounts.");
  }
  const temporaryPassword = makeTemporaryPassword();
  const salt = newSalt();
  const hash = await passwordHash(temporaryPassword, salt);
  // Recheck authorization after hashing, before committing.
  assertCEO(currentId);
  const created = {
    id: newId(),
    name,
    email,
    role: "admin",
    active: true,
    salt,
    hash,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
    createdBy: currentId,
    createdByName: ceoAccount().name,
    lastLoginAt: null,
    passwordChangedAt: null
  };
  const latest = getAccounts();
  if (latest.some(item => normalizeEmail(item.email) === email)) {
    throw new Error("This email was already registered.");
  }
  storeAccounts([...latest, created]);
  auditAccount("Created Admin Account", ceoAccount(), publicAccount(created), [
    { field: "Account Status", before: "Not created", after: "Active" },
    { field: "First Login Password Change", before: "—", after: "Required" }
  ]);
  return { account: publicAccount(created), temporaryPassword };
}

export async function resetAdminPasswordByCEO(currentId, targetId) {
  assertCEO(currentId);
  if (targetId === CEO_ID) throw new Error("Reset the CEO password from My Account instead.");
  const accounts = getAccounts();
  const target = accounts.find(item => item.id === targetId);
  if (!target) throw new Error("Administrator account not found.");
  if (!accountIsActive(target)) throw new Error("Reactivate this account before resetting its password.");
  const temporaryPassword = makeTemporaryPassword();
  const salt = newSalt();
  const hash = await passwordHash(temporaryPassword, salt);
  assertCEO(currentId);
  // Re-read in case an account changed during the asynchronous hash.
  const latest = getAccounts();
  const saved = latest.find(item => item.id === targetId);
  if (!saved || !accountIsActive(saved)) throw new Error("Admin account is no longer active.");
  saved.salt = salt;
  saved.hash = hash;
  saved.mustChangePassword = true;
  saved.updatedAt = new Date().toISOString();
  storeAccounts(latest);
  auditAccount("Reset Admin Password", ceoAccount(), publicAccount(saved), [
    { field: "Temporary Password Issued", before: "No", after: "Yes" },
    { field: "Password Change Required", before: Boolean(target.mustChangePassword), after: true }
  ]);
  return { account: publicAccount(saved), temporaryPassword };
}

export function updateAdminProfile(id, input) {
  if (sessionStorage.getItem(SESSION_KEY) !== id) {
    throw new Error("You may edit only your own account profile.");
  }
  const name = String(input.name || "").trim();
  if (name.length < 2) throw new Error("Enter at least two characters for your name.");
  if (name.length > 100) throw new Error("Name cannot exceed 100 characters.");
  if (id === CEO_ID) {
    const oldName = ceoAccount().name;
    const updated = { ...getCEOProfile(), name, updatedAt: new Date().toISOString() };
    saveCEOProfile(updated);
    const profile = ceoAccount();
    if (oldName !== name) {
      auditAccount("Updated Own Profile", profile, profile, [
        { field: "Display Name", before: oldName, after: name }
      ]);
    }
    return profile;
  }
  const accounts = getAccounts();
  const account = accounts.find(item => item.id === id && accountIsActive(item));
  if (!account) throw new Error("Admin account not found or inactive.");
  const oldName = account.name;
  account.name = name;
  account.updatedAt = new Date().toISOString();
  storeAccounts(accounts);
  const profile = publicAccount(account);
  if (oldName !== name) {
    auditAccount("Updated Own Profile", profile, profile, [
      { field: "Display Name", before: oldName, after: name }
    ]);
  }
  return profile;
}

export async function changeAdminPassword(id, oldPassword, newPassword, confirmPassword) {
  if (sessionStorage.getItem(SESSION_KEY) !== id) {
    throw new Error("You can change only your own password.");
  }
  if (!oldPassword) throw new Error("Enter your current or temporary password.");
  validateNewPassword(newPassword, confirmPassword, oldPassword);
  if (id === CEO_ID) {
    const profile = getCEOProfile();
    const valid = profile.salt && profile.hash
      ? (await passwordHash(oldPassword, profile.salt)) === profile.hash
      : oldPassword === INITIAL_CEO_PASSWORD;
    if (!valid) throw new Error("Current CEO password is incorrect.");
    const salt = newSalt();
    const hash = await passwordHash(newPassword, salt);
    if (sessionStorage.getItem(SESSION_KEY) !== CEO_ID) throw new Error("Please sign in again.");
    saveCEOProfile({
      ...getCEOProfile(),
      salt,
      hash,
      passwordChangedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const updatedCEO = ceoAccount();
    auditAccount("Changed Own Password", updatedCEO, updatedCEO, [
      { field: "Password", before: "Previous credential (hidden)", after: "New credential saved (hidden)" }
    ]);
    return updatedCEO;
  }

  const accounts = getAccounts();
  const account = accounts.find(item => item.id === id && accountIsActive(item));
  if (!account) throw new Error("Admin account not found.");
  const oldHash = await passwordHash(oldPassword, account.salt);
  if (oldHash !== account.hash) throw new Error("Current or temporary password is incorrect.");
  const salt = newSalt();
  const hash = await passwordHash(newPassword, salt);
  if (sessionStorage.getItem(SESSION_KEY) !== id) throw new Error("Please sign in again.");
  const latest = getAccounts();
  const saved = latest.find(item => item.id === id && accountIsActive(item));
  if (!saved || saved.hash !== account.hash) throw new Error("Password was updated elsewhere. Try again.");
  saved.salt = salt;
  saved.hash = hash;
  saved.mustChangePassword = false;
  saved.passwordChangedAt = new Date().toISOString();
  saved.updatedAt = saved.passwordChangedAt;
  storeAccounts(latest);
  const profile = publicAccount(saved);
  auditAccount("Changed Own Password", profile, profile, [
    { field: "Password", before: "Previous credential (hidden)", after: "New credential saved (hidden)" },
    { field: "Password Change Required", before: Boolean(account.mustChangePassword), after: false }
  ]);
  return profile;
}

// "Remove" is now reversible deactivation; shared company data stays untouched.
export function removeAdminAccount(currentId, targetId) {
  assertCEO(currentId);
  if (targetId === CEO_ID) throw new Error("The CEO account cannot be deactivated.");
  const accounts = getAccounts();
  const target = accounts.find(item => item.id === targetId);
  if (!target) throw new Error("Administrator account not found.");
  if (!accountIsActive(target)) throw new Error("This account is already inactive.");
  target.active = false;
  target.updatedAt = new Date().toISOString();
  storeAccounts(accounts);
  const profile = publicAccount(target);
  auditAccount("Deactivated Admin", ceoAccount(), profile, [
    { field: "Account Status", before: "Active", after: "Inactive" }
  ]);
  return profile;
}

export function reactivateAdminAccount(currentId, targetId) {
  assertCEO(currentId);
  if (targetId === CEO_ID) throw new Error("CEO account is always active.");
  const accounts = getAccounts();
  const target = accounts.find(item => item.id === targetId);
  if (!target) throw new Error("Administrator account not found.");
  if (accountIsActive(target)) throw new Error("This account is already active.");
  target.active = true;
  target.updatedAt = new Date().toISOString();
  storeAccounts(accounts);
  const profile = publicAccount(target);
  auditAccount("Reactivated Admin", ceoAccount(), profile, [
    { field: "Account Status", before: "Inactive", after: "Active" }
  ]);
  return profile;
}

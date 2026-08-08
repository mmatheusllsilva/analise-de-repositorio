// Auth utilities for the Chrome extension using Supabase (public anon key only).
// This module manages storing a session placeholder in chrome.storage.local.
// The actual exchange of OAuth `code` for tokens must occur on a secure
// backend using the Supabase service_role key. See `vercel-backend/api/auth/exchange.js`.

// Save session placeholder
export async function saveSession(sessionObj) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ supabase_oauth: sessionObj }, () => resolve());
  });
}

// Get saved session placeholder
export async function getSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['supabase_oauth'], (items) => {
      resolve(items.supabase_oauth || null);
    });
  });
}

// Clear session (logout)
export async function clearSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['supabase_oauth'], () => resolve());
  });
}

// Optional helper: request backend to exchange code for real session tokens.
// This function is a stub showing how you'd call your Vercel backend.
export async function exchangeCodeForSession(code) {
  // Example POST to backend endpoint you must implement securely.
  // return fetch('<BACKEND_URL>/api/auth/exchange', { method: 'POST', body: JSON.stringify({ code }) })
  //   .then(r => r.json());
  throw new Error('exchangeCodeForSession not implemented on client. Implement backend endpoint to handle this securely.');
}

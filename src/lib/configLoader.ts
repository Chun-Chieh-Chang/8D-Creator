/**
 * Note: This is a client-side (Next.js) project. 
 * Real fs access is normally not possible in the browser.
 * However, the user mentioned "creating config.json in the program directory".
 * This implies they might be running this locally and expect a specific file to be read.
 * 
 * For a truly static/client-side export, we will:
 * 1. Try to fetch /config.json (if served statically).
 * 2. If it fails, fallback to localStorage.
 */

export async function getExternalConfig() {
  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Silent fail
  }
  return null;
}

const CLIENT_ID = "392f045b7505ac51b40654b515ed7146cc51cb2ffcf1bb7905085744fcd93dc8";
const REDIRECT_URI = "https://theklif.github.io/SimplSimkl/";
const APP_NAME = "simplsimkl";
const APP_VERSION = "1.0";
const TMDB_API_KEY = "61d04d1bd78fbe46d2702c45885e444f";

// --- IndexedDB helpers ---
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("simplsimkl", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("auth");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToken(token) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("auth", "readwrite");
    tx.objectStore("auth").put(token, "access_token");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getToken() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("auth", "readonly");
    const req = tx.objectStore("auth").get("access_token");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// --- PKCE helpers ---
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

async function sha256Challenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

// --- Step 1: kick off login ---
async function startLogin() {
  const verifier = randomVerifier();
  sessionStorage.setItem("pkce_verifier", verifier);
  const challenge = await sha256Challenge(verifier);

  const url = new URL("https://simkl.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("app-name", APP_NAME);
  url.searchParams.set("app-version", APP_VERSION);

  window.location.href = url.toString();
}

// --- Step 2: handle the redirect back ---
async function handleCallback(code) {
  const verifier = sessionStorage.getItem("pkce_verifier");
  const res = await fetch(`https://api.simkl.com/oauth/token?client_id=${CLIENT_ID}&app-name=${APP_NAME}&app-version=${APP_VERSION}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: verifier
    })
  });

  if (!res.ok) {
    document.getElementById("status").textContent =
      "Token exchange failed: " + res.status;
    return;
  }

  const data = await res.json();
  await saveToken(data.access_token);
  sessionStorage.removeItem("pkce_verifier");
  document.getElementById("status").textContent = "Connected.";

  // clean the ?code= param out of the URL
  window.history.replaceState({}, document.title, REDIRECT_URI);
}

console.log("auth.js: readyState at listener registration =", document.readyState);

// --- Entry point ---
window.addEventListener("DOMContentLoaded", async () => {
  console.log("auth.js: DOMContentLoaded handler actually ran");

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  const existingToken = await getToken();
  if (existingToken) {
    document.getElementById("status").textContent = "Already connected.";
    return;
  }

  if (code) {
    await handleCallback(code);
  } else {
    const connectBtn = document.getElementById("connectBtn");
    connectBtn.style.display = "inline-block";
    connectBtn.addEventListener("click", startLogin);
  }
});
function getSupabaseClient() {
  if (!window.supabase || !window.CARVALLO_SUPABASE_URL || !window.CARVALLO_SUPABASE_ANON_KEY) {
    return null;
  }
  if (!window.CARVALLO_ADMIN_SUPABASE_CLIENT) {
    window.CARVALLO_ADMIN_SUPABASE_CLIENT = window.supabase.createClient(window.CARVALLO_SUPABASE_URL, window.CARVALLO_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "carvallo-admin-auth"
      }
    });
  }
  return window.CARVALLO_ADMIN_SUPABASE_CLIENT;
}

const ALLOWED_ADMIN_EMAIL = "main@carvallo-motors.com";
const client = getSupabaseClient();
const loginStatus = document.querySelector("#login-status");
const adminStatus = document.querySelector("#admin-status");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");
const loginButton = document.querySelector("#login-button");
const signupButton = document.querySelector("#signup-button");
const logoutButton = document.querySelector("#logout-button");
const carForm = document.querySelector("#car-form");
const imageInput = document.querySelector("#car-images");

let currentSession = null;
let currentAdmin = null;

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setLocked(message) {
  carForm.hidden = true;
  carForm.classList.add("is-locked");
  logoutButton.hidden = !currentSession;
  loginButton.hidden = Boolean(currentSession);
  signupButton.hidden = Boolean(currentSession);
  loginEmail.hidden = Boolean(currentSession);
  loginPassword.hidden = Boolean(currentSession);
  loginStatus.textContent = message;
}

function setUnlocked(email) {
  carForm.hidden = false;
  carForm.classList.remove("is-locked");
  loginButton.hidden = true;
  signupButton.hidden = true;
  loginEmail.hidden = true;
  loginPassword.hidden = true;
  logoutButton.hidden = false;
  loginStatus.textContent = `Accesso attivo: ${email}`;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function passwordValue() {
  return loginPassword.value;
}

function guardAllowedEmail() {
  const email = normalizeEmail(loginEmail.value);
  if (email !== ALLOWED_ADMIN_EMAIL) {
    loginStatus.textContent = `Accesso consentito solo a ${ALLOWED_ADMIN_EMAIL}.`;
    return null;
  }
  return email;
}

async function checkAdminAccess(session) {
  if (!client || !session?.user?.email) return null;

  const email = session.user.email.toLowerCase();
  const { data, error } = await client
    .from("admin_users")
    .select("id,email,role")
    .ilike("email", email)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function refreshAuthState() {
  if (!client) {
    setLocked("Configura prima Supabase in config.js.");
    return;
  }

  const { data } = await client.auth.getSession();
  currentSession = data.session;

  if (!currentSession) {
    setLocked("Inserisci la password per accedere. La sessione resta salvata su questo browser.");
    return;
  }

  if (normalizeEmail(currentSession.user.email || "") !== ALLOWED_ADMIN_EMAIL) {
    await client.auth.signOut();
    currentSession = null;
    currentAdmin = null;
    setLocked(`Accesso consentito solo a ${ALLOWED_ADMIN_EMAIL}.`);
    return;
  }

  currentAdmin = await checkAdminAccess(currentSession);
  if (!currentAdmin) {
    setLocked("Accesso effettuato, ma questa email non e' autorizzata a caricare auto.");
    return;
  }

  setUnlocked(currentSession.user.email);
}

async function uploadImages(files, slug) {
  if (!files.length) return [];

  const urls = [];
  for (const file of files) {
    const extension = file.name.split(".").pop() || "jpg";
    const safeName = slugify(file.name.replace(/\.[^.]+$/, "")) || "immagine";
    const path = `${slug}/${Date.now()}-${safeName}.${extension}`;
    const { error } = await client.storage.from("car-images").upload(path, file, {
      cacheControl: "31536000",
      upsert: false
    });

    if (error) throw error;
    const { data } = client.storage.from("car-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

loginButton.addEventListener("click", async () => {
  if (!client) {
    loginStatus.textContent = "Configura prima Supabase in config.js.";
    return;
  }

  const email = guardAllowedEmail();
  const password = passwordValue();
  if (!email) return;
  if (!password) {
    loginStatus.textContent = "Inserisci la password.";
    return;
  }

  loginStatus.textContent = "Accesso in corso...";
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    loginStatus.textContent = error.message;
    return;
  }
  loginPassword.value = "";
  await refreshAuthState();
});

signupButton.addEventListener("click", async () => {
  if (!client) {
    loginStatus.textContent = "Configura prima Supabase in config.js.";
    return;
  }

  const email = guardAllowedEmail();
  const password = passwordValue();
  if (!email) return;
  if (!password || password.length < 8) {
    loginStatus.textContent = "Scegli una password di almeno 8 caratteri.";
    return;
  }

  loginStatus.textContent = "Creo la password...";
  const { error } = await client.auth.signUp({ email, password });
  if (error) {
    loginStatus.textContent = error.message;
    return;
  }

  loginStatus.textContent = "Password creata. Se Supabase richiede conferma email, conferma l'account dalla dashboard o dalla mail ricevuta, poi accedi.";
});

logoutButton.addEventListener("click", async () => {
  if (client) await client.auth.signOut();
  currentSession = null;
  currentAdmin = null;
  setLocked("Sessione chiusa.");
});

carForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client || !currentSession || !currentAdmin) {
    adminStatus.textContent = "Devi accedere con una email autorizzata.";
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const manualGalleryUrls = String(payload.gallery_urls_raw || "")
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);

  delete payload.images;
  delete payload.gallery_urls_raw;

  payload.featured = form.elements.featured.checked;
  payload.is_published = form.elements.is_published.checked;
  payload.year = payload.year ? Number(payload.year) : null;
  payload.mileage_km = payload.mileage_km ? Number(payload.mileage_km) : null;
  payload.slug = payload.slug || slugify(`${payload.make}-${payload.model}-${payload.year || "auto"}`);
  ["fuel", "transmission", "price_label", "image_url", "source_url", "short_description", "description"].forEach((key) => {
    if (payload[key] === "") payload[key] = null;
  });

  adminStatus.textContent = "Caricamento immagini...";
  try {
    const uploadedUrls = await uploadImages([...imageInput.files], payload.slug);
    const galleryUrls = [...uploadedUrls, ...manualGalleryUrls];
    if (galleryUrls.length) {
      payload.gallery_urls = galleryUrls;
      if (!payload.image_url) payload.image_url = galleryUrls[0];
    }
  } catch (error) {
    adminStatus.textContent = `Upload fallito: ${error.message}`;
    return;
  }

  adminStatus.textContent = "Salvataggio auto...";
  const { error } = await client.from("cars").upsert(payload, { onConflict: "slug" });
  if (error) {
    adminStatus.textContent = error.message;
    return;
  }

  form.reset();
  form.elements.is_published.checked = true;
  adminStatus.textContent = "Auto salvata e catalogo aggiornabile.";
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", refreshAuthState);
} else {
  refreshAuthState();
}
if (client) {
  client.auth.onAuthStateChange(() => refreshAuthState());
}

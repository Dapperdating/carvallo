function getSupabaseClient() {
  if (!window.supabase || !window.CARVALLO_SUPABASE_URL || !window.CARVALLO_SUPABASE_ANON_KEY) {
    return null;
  }
  if (!window.CARVALLO_ADMIN_SUPABASE_CLIENT) {
    window.CARVALLO_ADMIN_SUPABASE_CLIENT = window.supabase.createClient(window.CARVALLO_SUPABASE_URL, window.CARVALLO_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "carvallo-admin-auth"
      }
    });
  }
  return window.CARVALLO_ADMIN_SUPABASE_CLIENT;
}

const client = getSupabaseClient();
const loginStatus = document.querySelector("#login-status");
const adminStatus = document.querySelector("#admin-status");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");
const loginButton = document.querySelector("#login-button");
const magicLinkButton = document.querySelector("#magic-link-button");
const resetButton = document.querySelector("#reset-button");
const logoutButton = document.querySelector("#logout-button");
const resetPasswordForm = document.querySelector("#reset-password-form");
const newPassword = document.querySelector("#new-password");
const confirmPassword = document.querySelector("#confirm-password");
const resetStatus = document.querySelector("#reset-status");
const carForm = document.querySelector("#car-form");
const imageInput = document.querySelector("#car-images");
const ADMIN_PUBLIC_URL = "https://carvallo-motors.com/admin.html";

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
  resetPasswordForm.hidden = true;
  logoutButton.hidden = !currentSession;
  loginButton.hidden = Boolean(currentSession);
  magicLinkButton.hidden = Boolean(currentSession);
  resetButton.hidden = Boolean(currentSession);
  loginEmail.hidden = Boolean(currentSession);
  loginPassword.hidden = Boolean(currentSession);
  loginStatus.textContent = message;
}

function setUnlocked(email) {
  carForm.hidden = false;
  carForm.classList.remove("is-locked");
  resetPasswordForm.hidden = true;
  loginButton.hidden = true;
  magicLinkButton.hidden = true;
  resetButton.hidden = true;
  loginEmail.hidden = true;
  loginPassword.hidden = true;
  logoutButton.hidden = false;
  loginStatus.textContent = `Accesso attivo: ${email}`;
}

function showPasswordRecovery() {
  currentAdmin = null;
  carForm.hidden = true;
  carForm.classList.add("is-locked");
  resetPasswordForm.hidden = false;
  loginButton.hidden = true;
  magicLinkButton.hidden = true;
  resetButton.hidden = true;
  loginEmail.hidden = true;
  loginPassword.hidden = true;
  logoutButton.hidden = true;
  loginStatus.textContent = "Imposta una nuova password.";
  resetStatus.textContent = "Scegli una password di almeno 8 caratteri.";
  newPassword.focus();
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function passwordValue() {
  return loginPassword.value;
}

function emailValue() {
  const email = normalizeEmail(loginEmail.value);
  if (!email) {
    loginStatus.textContent = "Inserisci la tua email.";
    return null;
  }
  return email;
}

function resetRedirectUrl() {
  return `${ADMIN_PUBLIC_URL}?reset=1`;
}

function loginRedirectUrl() {
  return `${ADMIN_PUBLIC_URL}?login=1`;
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
    setLocked("Servizio non configurato.");
    return;
  }

  const { data } = await client.auth.getSession();
  currentSession = data.session;

  if (!currentSession) {
    setLocked("Inserisci le credenziali per accedere.");
    return;
  }

  currentAdmin = await checkAdminAccess(currentSession);
  if (!currentAdmin) {
    setLocked("Accesso non autorizzato.");
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
    loginStatus.textContent = "Servizio non configurato.";
    return;
  }

  const email = emailValue();
  const password = passwordValue();
  if (!email) return;
  if (!password) {
    loginStatus.textContent = "Inserisci la password.";
    return;
  }

  loginStatus.textContent = "Accesso in corso...";
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    loginStatus.textContent = "Credenziali non valide.";
    return;
  }
  loginPassword.value = "";
  await refreshAuthState();
});

magicLinkButton.addEventListener("click", async () => {
  if (!client) {
    loginStatus.textContent = "Servizio non configurato.";
    return;
  }

  const email = emailValue();
  if (!email) return;

  loginStatus.textContent = "Invio link di accesso...";
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: loginRedirectUrl(),
      shouldCreateUser: false
    }
  });
  if (error) {
    loginStatus.textContent = "Non riesco a inviare il link. Riprova tra poco.";
    return;
  }

  loginStatus.textContent = "Se l'email e' abilitata, riceverai un link per entrare.";
});

resetButton.addEventListener("click", async () => {
  if (!client) {
    loginStatus.textContent = "Servizio non configurato.";
    return;
  }

  const email = emailValue();
  if (!email) return;

  loginStatus.textContent = "Invio istruzioni di reset...";
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: resetRedirectUrl()
  });
  if (error) {
    loginStatus.textContent = "Non riesco a inviare il reset. Riprova tra poco.";
    return;
  }

  loginStatus.textContent = "Se l'email e' abilitata, riceverai un link per reimpostare la password.";
});

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) {
    resetStatus.textContent = "Servizio non configurato.";
    return;
  }

  const password = newPassword.value;
  const confirmation = confirmPassword.value;
  if (!password || password.length < 8) {
    resetStatus.textContent = "Scegli una password di almeno 8 caratteri.";
    return;
  }
  if (password !== confirmation) {
    resetStatus.textContent = "Le password non coincidono.";
    return;
  }

  resetStatus.textContent = "Aggiornamento password...";
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    resetStatus.textContent = "Non riesco ad aggiornare la password. Riapri il link di reset.";
    return;
  }

  newPassword.value = "";
  confirmPassword.value = "";
  await client.auth.signOut();
  currentSession = null;
  currentAdmin = null;
  window.history.replaceState(null, "", window.location.pathname);
  setLocked("Password aggiornata. Accedi con le nuove credenziali.");
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
    adminStatus.textContent = "Devi accedere con credenziali autorizzate.";
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
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      showPasswordRecovery();
      return;
    }
    refreshAuthState();
  });
}

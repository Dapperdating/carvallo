function getSupabaseClient() {
  if (!window.supabase || !window.CARVALLO_SUPABASE_URL || !window.CARVALLO_SUPABASE_ANON_KEY) {
    return null;
  }
  return window.supabase.createClient(window.CARVALLO_SUPABASE_URL, window.CARVALLO_SUPABASE_ANON_KEY);
}

const client = getSupabaseClient();
const loginStatus = document.querySelector("#login-status");
const adminStatus = document.querySelector("#admin-status");
const loginEmail = document.querySelector("#login-email");
const loginButton = document.querySelector("#login-button");
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
  loginEmail.hidden = Boolean(currentSession);
  loginStatus.textContent = message;
}

function setUnlocked(email) {
  carForm.hidden = false;
  carForm.classList.remove("is-locked");
  loginButton.hidden = true;
  loginEmail.hidden = true;
  logoutButton.hidden = false;
  loginStatus.textContent = `Accesso attivo: ${email}`;
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
    setLocked("Inserisci la tua email per ricevere il magic link.");
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

  const email = loginEmail.value.trim();
  if (!email) {
    loginStatus.textContent = "Inserisci una email.";
    return;
  }

  loginStatus.textContent = "Invio magic link...";
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  loginStatus.textContent = error ? error.message : "Magic link inviato. Controlla la posta.";
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
  delete payload.images;

  payload.featured = form.elements.featured.checked;
  payload.is_published = form.elements.is_published.checked;
  payload.year = payload.year ? Number(payload.year) : null;
  payload.mileage_km = payload.mileage_km ? Number(payload.mileage_km) : null;
  payload.slug = payload.slug || slugify(`${payload.make}-${payload.model}-${payload.year || "auto"}`);

  adminStatus.textContent = "Caricamento immagini...";
  try {
    const uploadedUrls = await uploadImages([...imageInput.files], payload.slug);
    if (uploadedUrls.length) {
      payload.image_url = uploadedUrls[0];
      payload.gallery_urls = uploadedUrls;
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

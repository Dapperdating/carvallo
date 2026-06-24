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
const adminDashboard = document.querySelector("#admin-dashboard");
const listingsBody = document.querySelector("#admin-listings");
const dashboardStatus = document.querySelector("#dashboard-status");
const imagePreviewList = document.querySelector("#image-preview-list");
const syncGalleryPreviewButton = document.querySelector("#sync-gallery-preview");
const generateDescriptionButton = document.querySelector("#generate-description-button");
const newCarButton = document.querySelector("#new-car-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const formTitle = document.querySelector("#form-title");
const statPublished = document.querySelector("#stat-published");
const statAvailable = document.querySelector("#stat-available");
const statClicks = document.querySelector("#stat-clicks");
const ADMIN_PUBLIC_URL = "https://carvallo-motors.com/admin.html";
const DB_SCHEMA_FIX_PATH = "supabase/admin-cars-schema-fix.sql";

let currentSession = null;
let currentAdmin = null;
let authEmailRequestPending = false;
let imageQueue = [];
let dashboardCars = [];
let dashboardClicks = new Map();
let editingSlug = "";

function uniqueId(prefix) {
  const random = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

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
  adminDashboard.hidden = true;
  adminDashboard.classList.add("is-locked");
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
  adminDashboard.hidden = false;
  adminDashboard.classList.remove("is-locked");
  resetPasswordForm.hidden = true;
  loginButton.hidden = true;
  magicLinkButton.hidden = true;
  resetButton.hidden = true;
  loginEmail.hidden = true;
  loginPassword.hidden = true;
  logoutButton.hidden = false;
  loginStatus.textContent = `Accesso attivo: ${email}`;
  loadDashboard();
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeCssUrl(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"");
}

function statusLabel(status) {
  return {
    available: "Disponibile",
    incoming: "In arrivo",
    unavailable: "Non disponibile",
    sold: "Venduta"
  }[status] || "Disponibile";
}

function titleForCar(car) {
  return `${car.make || ""} ${car.model || ""}`.trim() || car.slug || "Annuncio";
}

function dashboardImageUrl(car) {
  const gallery = Array.isArray(car.gallery_urls) ? car.gallery_urls : [];
  return adminAssetUrl(car.image_url || gallery[0] || "");
}

function adminAssetUrl(value) {
  if (!value) return "";
  const url = String(value).trim();
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${window.location.origin}/${url.replace(/^\/+/, "")}`;
}

function normalizeGalleryUrls(values) {
  return values
    .flat()
    .map((url) => String(url || "").trim())
    .filter(Boolean)
    .filter((url, index, list) => list.indexOf(url) === index);
}

function manualGalleryUrls() {
  return String(carForm.elements.gallery_urls_raw.value || "")
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function queueFromUrls(urls) {
  imageQueue = normalizeGalleryUrls(urls).map((url) => ({
    id: uniqueId("url"),
    type: "url",
    url
  }));
  renderImagePreview();
}

function addFilesToQueue(files) {
  [...files].forEach((file) => {
    imageQueue.push({
      id: uniqueId("file"),
      type: "file",
      file,
      url: URL.createObjectURL(file)
    });
  });
  renderImagePreview();
}

function syncManualUrlsToQueue() {
  const queuedUrls = imageQueue.filter((item) => item.type === "url").map((item) => item.url);
  const urls = normalizeGalleryUrls([queuedUrls, manualGalleryUrls(), carForm.elements.image_url.value]);
  const fileItems = imageQueue.filter((item) => item.type === "file");
  imageQueue = [
    ...fileItems,
    ...urls.map((url) => ({ id: uniqueId("url"), type: "url", url }))
  ];
  renderImagePreview();
}

function appendManualUrlsToQueue() {
  const queuedUrls = imageQueue.map((item) => item.type === "url" ? item.url : "").filter(Boolean);
  const urls = normalizeGalleryUrls([manualGalleryUrls(), carForm.elements.image_url.value])
    .filter((url) => !queuedUrls.includes(url));
  urls.forEach((url) => imageQueue.push({ id: uniqueId("url"), type: "url", url }));
  renderImagePreview();
}

function missingColumnName(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  const direct = message.match(/column\s+cars\.([a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (direct) return direct[1];

  const schemaCache = message.match(/'([a-z0-9_]+)'\s+column\s+of\s+'cars'/i);
  return schemaCache ? schemaCache[1] : "";
}

async function upsertCarPayload(payload) {
  const cleanPayload = { ...payload };
  const skippedColumns = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await client.from("cars").upsert(cleanPayload, { onConflict: "slug" });
    if (!error) return skippedColumns;

    const column = missingColumnName(error);
    if (!column || !(column in cleanPayload)) throw error;

    delete cleanPayload[column];
    skippedColumns.push(column);
  }

  throw new Error(`Schema Supabase non allineato. Applica ${DB_SCHEMA_FIX_PATH} e riprova.`);
}

function moveImageQueueItem(id, direction) {
  const index = imageQueue.findIndex((item) => item.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= imageQueue.length) return;
  const [item] = imageQueue.splice(index, 1);
  imageQueue.splice(nextIndex, 0, item);
  renderImagePreview();
}

function removeImageQueueItem(id) {
  const item = imageQueue.find((entry) => entry.id === id);
  if (item?.type === "file") URL.revokeObjectURL(item.url);
  imageQueue = imageQueue.filter((entry) => entry.id !== id);
  renderImagePreview();
}

function renderImagePreview() {
  if (!imagePreviewList) return;
  if (!imageQueue.length) {
    imagePreviewList.innerHTML = `<p class="empty-preview">Nessuna foto in coda.</p>`;
    return;
  }

  imagePreviewList.innerHTML = imageQueue.map((item, index) => `
    <article class="image-preview-item" draggable="true" data-image-id="${escapeHtml(item.id)}">
      <span>${index + 1}</span>
      <img src="${escapeHtml(item.url)}" alt="">
      <div>
        <button type="button" aria-label="Sposta prima" data-image-move="-1">↑</button>
        <button type="button" aria-label="Sposta dopo" data-image-move="1">↓</button>
        <button type="button" aria-label="Rimuovi" data-image-remove>×</button>
      </div>
    </article>
  `).join("");
}

function descriptionPromptFields() {
  const data = Object.fromEntries(new FormData(carForm).entries());
  return {
    make: data.make?.trim(),
    model: data.model?.trim(),
    year: data.year?.trim(),
    mileage: data.mileage_km?.trim(),
    owners: data.previous_owners?.trim(),
    engineSize: data.engine_size?.trim(),
    fuel: data.fuel?.trim(),
    transmission: data.transmission?.trim(),
    price: data.price_label?.trim(),
    serviceHistory: data.service_history?.trim(),
    highlights: data.highlights?.trim(),
    division: data.division === "selected" ? "Carvallo Selected" : "Carvallo Motors",
    status: statusLabel(data.status)
  };
}

function generateLocalDescription() {
  const car = descriptionPromptFields();
  const title = `${car.make || "Auto"} ${car.model || ""}`.trim();
  const ownerText = car.owners ? Number(car.owners) === 1 ? "un solo precedente proprietario" : `${car.owners} precedenti proprietari` : "";
  const kmText = car.mileage ? `solo ${Number(car.mileage).toLocaleString("it-IT")} chilometri` : "";
  const transmissionText = car.transmission ? `cambio ${car.transmission.toLowerCase()}` : "";
  const specs = [
    car.year ? `anno ${car.year}` : "",
    kmText,
    ownerText,
    car.engineSize ? `cilindrata ${car.engineSize}` : "",
    car.fuel || "",
    transmissionText
  ].filter(Boolean).join(", ");
  const highlights = car.highlights ? ` Tra i punti forti: ${car.highlights}.` : "";
  const maintenance = car.serviceHistory ? ` La manutenzione dichiarata e' un elemento di valore: ${car.serviceHistory}.` : "";
  const short = `${car.division} propone ${title}${car.year ? ` del ${car.year}` : ""}${specs ? `, ${specs}` : ""}. Una vettura interessante per dati, condizioni e configurazione.${highlights}`;
  const full = [
    `${car.division} propone ${title}${car.year ? ` del ${car.year}` : ""}.`,
    specs ? `Il veicolo si distingue per ${specs}, dati che lo rendono particolarmente interessante nel suo segmento.` : "Il veicolo e' stato selezionato per qualita' generale, presentazione e coerenza della configurazione.",
    car.highlights ? `In particolare, ${car.highlights}.` : "",
    maintenance,
    car.price ? `Prezzo indicato: ${car.price}.` : "Prezzo disponibile su richiesta.",
    "L'auto e' disponibile per visione su appuntamento; dati, dotazione e disponibilita' vengono verificati con Carvallo prima dell'acquisto."
  ].filter(Boolean).join(" ");

  carForm.elements.short_description.value = short;
  carForm.elements.description.value = full;
  adminStatus.textContent = "Descrizioni generate in base ai dati inseriti.";
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

function authEmailErrorMessage(error, fallback) {
  const message = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  if (error?.status === 429 || message.includes("rate limit")) {
    return "Troppe email richieste in poco tempo. Aspetta qualche minuto e riprova.";
  }
  return fallback;
}

function setAuthEmailButtonsDisabled(disabled) {
  authEmailRequestPending = disabled;
  magicLinkButton.disabled = disabled;
  resetButton.disabled = disabled;
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

async function resolveOrderedGallery(slug) {
  const galleryUrls = [];
  for (const item of imageQueue) {
    if (item.type === "url") {
      galleryUrls.push(item.url);
      continue;
    }

    const [uploadedUrl] = await uploadImages([item.file], slug);
    if (uploadedUrl) galleryUrls.push(uploadedUrl);
  }
  return normalizeGalleryUrls(galleryUrls);
}

async function loadClickCounts() {
  dashboardClicks = new Map();
  const { data, error } = await client
    .from("car_events")
    .select("car_slug,event_type")
    .eq("event_type", "open_detail")
    .limit(10000);

  if (error) {
    dashboardStatus.textContent = "Metriche click non ancora configurate. Applica la migrazione Supabase aggiornata.";
    return;
  }

  data.forEach((event) => {
    dashboardClicks.set(event.car_slug, (dashboardClicks.get(event.car_slug) || 0) + 1);
  });
}

function renderDashboard() {
  const totalClicks = [...dashboardClicks.values()].reduce((sum, value) => sum + value, 0);
  statPublished.textContent = String(dashboardCars.filter((car) => car.is_published).length);
  statAvailable.textContent = String(dashboardCars.filter((car) => car.status === "available").length);
  statClicks.textContent = String(totalClicks);

  if (!dashboardCars.length) {
    listingsBody.innerHTML = `<tr><td colspan="5">Nessun annuncio ancora salvato.</td></tr>`;
    return;
  }

  listingsBody.innerHTML = dashboardCars.map((car) => {
    const slug = car.slug || car.id;
    const clicks = dashboardClicks.get(slug) || 0;
    const image = dashboardImageUrl(car);
    return `
      <tr>
        <td>
          <div class="listing-cell">
            <figure class="listing-thumb ${image ? "" : "is-empty"}" ${image ? `style="background-image: url(&quot;${escapeHtml(escapeCssUrl(image))}&quot;)"` : ""}>
              ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(titleForCar(car))}">` : ""}
            </figure>
            <div>
              <strong>${escapeHtml(titleForCar(car))}</strong>
              <span>${escapeHtml(car.division === "selected" ? "Selected" : "Motors")} · ${escapeHtml(car.price_label || "Prezzo n/d")}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(statusLabel(car.status))}</td>
        <td><strong>${clicks}</strong></td>
        <td>${car.is_published ? "Pubblicato" : "Bozza"}</td>
        <td>
          <div class="table-actions">
            <button type="button" data-edit-car="${escapeHtml(slug)}">Modifica</button>
            <button type="button" data-toggle-publish="${escapeHtml(slug)}">${car.is_published ? "Nascondi" : "Pubblica"}</button>
            <button type="button" data-mark-sold="${escapeHtml(slug)}">Venduta</button>
            <button type="button" data-delete-car="${escapeHtml(slug)}">Elimina</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function loadDashboard() {
  if (!client || !currentAdmin) return;
  dashboardStatus.textContent = "Caricamento annunci...";
  const { data, error } = await client
    .from("cars")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    dashboardStatus.textContent = error.message;
    return;
  }

  dashboardCars = data || [];
  await loadClickCounts();
  renderDashboard();
  if (!dashboardStatus.textContent.includes("Metriche")) {
    dashboardStatus.textContent = "Dashboard aggiornata.";
  }
}

function resetEditor() {
  editingSlug = "";
  carForm.reset();
  carForm.elements.is_published.checked = true;
  imageQueue.forEach((item) => {
    if (item.type === "file") URL.revokeObjectURL(item.url);
  });
  imageQueue = [];
  renderImagePreview();
  formTitle.textContent = "Nuovo annuncio";
  cancelEditButton.hidden = true;
  adminStatus.textContent = "";
}

function editCar(slug) {
  const car = dashboardCars.find((item) => String(item.slug || item.id) === String(slug));
  if (!car) return;
  resetEditor();
  editingSlug = car.slug;
  formTitle.textContent = `Modifica ${titleForCar(car)}`;
  cancelEditButton.hidden = false;

  Object.entries(car).forEach(([key, value]) => {
    const field = carForm.elements[key];
    if (!field || field.type === "file") return;
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }
    if (Array.isArray(value)) return;
    field.value = value ?? "";
  });

  const gallery = normalizeGalleryUrls([car.image_url, car.gallery_urls || []]);
  carForm.elements.gallery_urls_raw.value = gallery.slice(1).join("\n");
  queueFromUrls(gallery);
  adminStatus.textContent = "Annuncio caricato in modifica.";
  carForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function updateCar(slug, patch) {
  dashboardStatus.textContent = "Aggiornamento annuncio...";
  const { error } = await client.from("cars").update(patch).eq("slug", slug);
  if (error) {
    dashboardStatus.textContent = error.message;
    return;
  }
  await loadDashboard();
}

async function deleteCar(slug) {
  const car = dashboardCars.find((item) => String(item.slug || item.id) === String(slug));
  if (!car) return;
  const confirmed = window.confirm(`Eliminare definitivamente ${titleForCar(car)}?`);
  if (!confirmed) return;

  dashboardStatus.textContent = "Eliminazione annuncio...";
  const { error } = await client.from("cars").delete().eq("slug", slug);
  if (error) {
    dashboardStatus.textContent = error.message;
    return;
  }
  if (editingSlug === slug) resetEditor();
  await loadDashboard();
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
  if (authEmailRequestPending) return;

  const email = emailValue();
  if (!email) return;

  loginStatus.textContent = "Invio link di accesso...";
  setAuthEmailButtonsDisabled(true);
  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: loginRedirectUrl(),
        shouldCreateUser: false
      }
    });
    if (error) {
      loginStatus.textContent = authEmailErrorMessage(error, "Non riesco a inviare il link. Riprova tra poco.");
      return;
    }

    loginStatus.textContent = "Se l'email e' abilitata, riceverai un link per entrare.";
  } finally {
    setAuthEmailButtonsDisabled(false);
  }
});

resetButton.addEventListener("click", async () => {
  if (!client) {
    loginStatus.textContent = "Servizio non configurato.";
    return;
  }
  if (authEmailRequestPending) return;

  const email = emailValue();
  if (!email) return;

  loginStatus.textContent = "Invio istruzioni di reset...";
  setAuthEmailButtonsDisabled(true);
  try {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectUrl()
    });
    if (error) {
      loginStatus.textContent = authEmailErrorMessage(error, "Non riesco a inviare il reset. Riprova tra poco.");
      return;
    }

    loginStatus.textContent = "Se l'email e' abilitata, riceverai un link per reimpostare la password.";
  } finally {
    setAuthEmailButtonsDisabled(false);
  }
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
  resetEditor();
  setLocked("Sessione chiusa.");
});

imageInput.addEventListener("change", () => {
  addFilesToQueue(imageInput.files);
  imageInput.value = "";
});

syncGalleryPreviewButton.addEventListener("click", syncManualUrlsToQueue);
generateDescriptionButton.addEventListener("click", generateLocalDescription);
newCarButton.addEventListener("click", () => {
  resetEditor();
  carForm.scrollIntoView({ behavior: "smooth", block: "start" });
});
cancelEditButton.addEventListener("click", resetEditor);

imagePreviewList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-image-id]");
  if (!item) return;
  const id = item.dataset.imageId;

  const move = event.target.closest("[data-image-move]");
  if (move) {
    moveImageQueueItem(id, Number(move.dataset.imageMove));
    return;
  }

  if (event.target.closest("[data-image-remove]")) {
    removeImageQueueItem(id);
  }
});

imagePreviewList.addEventListener("dragstart", (event) => {
  const item = event.target.closest("[data-image-id]");
  if (!item) return;
  event.dataTransfer.setData("text/plain", item.dataset.imageId);
  event.dataTransfer.effectAllowed = "move";
});

imagePreviewList.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-image-id]")) event.preventDefault();
});

imagePreviewList.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-image-id]");
  if (!target) return;
  event.preventDefault();
  const sourceId = event.dataTransfer.getData("text/plain");
  const targetId = target.dataset.imageId;
  if (!sourceId || sourceId === targetId) return;

  const sourceIndex = imageQueue.findIndex((item) => item.id === sourceId);
  const targetIndex = imageQueue.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [item] = imageQueue.splice(sourceIndex, 1);
  imageQueue.splice(targetIndex, 0, item);
  renderImagePreview();
});

listingsBody.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit-car]");
  if (edit) {
    editCar(edit.dataset.editCar);
    return;
  }

  const publish = event.target.closest("[data-toggle-publish]");
  if (publish) {
    const car = dashboardCars.find((item) => String(item.slug || item.id) === String(publish.dataset.togglePublish));
    if (car) await updateCar(car.slug, { is_published: !car.is_published });
    return;
  }

  const sold = event.target.closest("[data-mark-sold]");
  if (sold) {
    await updateCar(sold.dataset.markSold, { status: "sold", is_published: true });
    return;
  }

  const remove = event.target.closest("[data-delete-car]");
  if (remove) await deleteCar(remove.dataset.deleteCar);
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
  appendManualUrlsToQueue();

  delete payload.images;
  delete payload.gallery_urls_raw;

  payload.featured = form.elements.featured.checked;
  payload.is_published = form.elements.is_published.checked;
  payload.year = payload.year ? Number(payload.year) : null;
  payload.mileage_km = payload.mileage_km ? Number(payload.mileage_km) : null;
  payload.previous_owners = payload.previous_owners ? Number(payload.previous_owners) : null;
  payload.slug = payload.slug || slugify(`${payload.make}-${payload.model}-${payload.year || "auto"}`);
  ["engine_size", "fuel", "transmission", "price_label", "image_url", "source_url", "service_history", "highlights", "short_description", "description"].forEach((key) => {
    if (payload[key] === "") payload[key] = null;
  });

  adminStatus.textContent = "Caricamento immagini...";
  try {
    const galleryUrls = await resolveOrderedGallery(payload.slug);
    if (galleryUrls.length) {
      payload.gallery_urls = galleryUrls;
      payload.image_url = galleryUrls[0];
    } else if (payload.image_url) {
      payload.gallery_urls = [payload.image_url];
    }
  } catch (error) {
    adminStatus.textContent = `Upload fallito: ${error.message}`;
    return;
  }

  adminStatus.textContent = "Salvataggio auto...";
  let skippedColumns = [];
  try {
    skippedColumns = await upsertCarPayload(payload);
  } catch (error) {
    const column = missingColumnName(error);
    adminStatus.textContent = column
      ? `Colonna Supabase mancante: ${column}. Applica ${DB_SCHEMA_FIX_PATH} e riprova.`
      : error.message;
    return;
  }

  resetEditor();
  adminStatus.textContent = skippedColumns.length
    ? `Auto salvata, ma Supabase non ha ancora queste colonne: ${skippedColumns.join(", ")}. Applica ${DB_SCHEMA_FIX_PATH}.`
    : "Auto salvata e catalogo aggiornabile.";
  await loadDashboard();
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

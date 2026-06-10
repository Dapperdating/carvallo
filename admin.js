function getSupabaseClient() {
  if (!window.supabase || !window.CARVALLO_SUPABASE_URL || !window.CARVALLO_SUPABASE_ANON_KEY) {
    return null;
  }
  return window.supabase.createClient(window.CARVALLO_SUPABASE_URL, window.CARVALLO_SUPABASE_ANON_KEY);
}

const client = getSupabaseClient();
const loginStatus = document.querySelector("#login-status");
const adminStatus = document.querySelector("#admin-status");

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

document.querySelector("#login-button").addEventListener("click", async () => {
  if (!client) {
    loginStatus.textContent = "Configura prima Supabase in config.js.";
    return;
  }
  const email = document.querySelector("#login-email").value;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  loginStatus.textContent = error ? error.message : "Magic link inviato.";
});

document.querySelector("#car-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) {
    adminStatus.textContent = "Configura prima Supabase in config.js.";
    return;
  }

  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.featured = form.elements.featured.checked;
  payload.is_published = true;
  payload.year = payload.year ? Number(payload.year) : null;
  payload.mileage_km = payload.mileage_km ? Number(payload.mileage_km) : null;
  payload.slug = payload.slug || slugify(`${payload.make}-${payload.model}-${payload.year || "auto"}`);

  adminStatus.textContent = "Salvataggio...";
  const { error } = await client.from("cars").upsert(payload, { onConflict: "slug" });
  if (error) {
    adminStatus.textContent = error.message;
    return;
  }
  form.reset();
  adminStatus.textContent = "Auto salvata.";
});

const contacts = {
  whatsappBase: "https://wa.me/393923139899",
  whatsapp: "https://wa.me/393923139899?text=Ciao%2C%20vorrei%20pi%C3%B9%20informazioni",
  email: "info@carvallo-motors.com"
};

let activeFilter = "all";

function getSupabaseClient() {
  if (!window.supabase || !window.CARVALLO_SUPABASE_URL || !window.CARVALLO_SUPABASE_ANON_KEY) {
    return null;
  }
  return window.supabase.createClient(window.CARVALLO_SUPABASE_URL, window.CARVALLO_SUPABASE_ANON_KEY);
}

async function loadCars() {
  const client = getSupabaseClient();
  if (!client) return window.CARVALLO_SEED_CARS;

  const { data, error } = await client
    .from("cars")
    .select("*")
    .eq("is_published", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    return window.CARVALLO_SEED_CARS;
  }
  return data;
}

function formatKm(value) {
  if (value === null || value === undefined || value === "") return "Km n/d";
  return `${Number(value).toLocaleString("it-IT")} km`;
}

function statusLabel(status) {
  return {
    available: "Disponibile",
    incoming: "In arrivo",
    sold: "Venduta"
  }[status] || "Disponibile";
}

function carCard(car) {
  const title = `${car.make || ""} ${car.model || ""}`.trim();
  const year = car.year || "Anno n/d";
  const division = car.division === "selected" ? "Selected" : "Motors";
  return `
    <article class="car-card" data-division="${car.division}">
      <figure>
        <img src="${car.image_url || ""}" alt="${title}" loading="lazy">
      </figure>
      <div class="car-body">
        <div class="car-top">
          <span class="badge ${car.division === "selected" ? "selected" : ""}">${division}</span>
          <strong>${statusLabel(car.status)}</strong>
        </div>
        <h3 class="car-title">${title}</h3>
        <p class="car-meta">
          <span>${year}</span>
          <span>${formatKm(car.mileage_km)}</span>
          <span>${car.fuel || "Alimentazione n/d"}</span>
          <span>${car.transmission || "Cambio n/d"}</span>
        </p>
        <p class="car-desc">${car.short_description || ""}</p>
        <a class="button ghost" href="${contacts.whatsappBase}?text=${encodeURIComponent(`Ciao, vorrei informazioni su ${title}`)}">Richiedi info</a>
      </div>
    </article>
  `;
}

async function renderCars() {
  const grid = document.querySelector("#car-grid");
  const cars = await loadCars();
  const visible = activeFilter === "all" ? cars : cars.filter((car) => car.division === activeFilter);
  grid.innerHTML = visible.map(carCard).join("");
}

function bindFilters() {
  document.querySelectorAll(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
      renderCars();
    });
  });
}

async function submitLead(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector(".form-status");
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.type = form.dataset.form || "contact";

  const client = getSupabaseClient();
  if (!client) {
    const subject = encodeURIComponent("Valutazione auto Carvallo");
    const body = encodeURIComponent(`${payload.name}\n${payload.phone}\n${payload.email || ""}\n\n${payload.message || ""}`);
    window.location.href = `mailto:${contacts.email}?subject=${subject}&body=${body}`;
    return;
  }

  status.textContent = "Invio in corso...";
  const { error } = await client.from("leads").insert(payload);
  if (error) {
    status.textContent = "Non sono riuscito a inviare. Scrivici su WhatsApp o email.";
    return;
  }
  form.reset();
  status.textContent = "Richiesta inviata. Ti ricontattiamo a breve.";
}

document.addEventListener("DOMContentLoaded", () => {
  bindFilters();
  renderCars();
  document.querySelectorAll("[data-form]").forEach((form) => form.addEventListener("submit", submitLead));
});

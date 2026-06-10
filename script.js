const contacts = {
  whatsappBase: "https://wa.me/393923139899",
  whatsapp: "https://wa.me/393923139899?text=Ciao%2C%20vorrei%20pi%C3%B9%20informazioni",
  email: "info@carvallo-motors.com"
};

let activeDivision = "all";
let activeStatus = "available";
let searchTerm = "";

function getSupabaseClient() {
  if (!window.supabase || !window.CARVALLO_SUPABASE_URL || !window.CARVALLO_SUPABASE_ANON_KEY) {
    return null;
  }
  return window.supabase.createClient(window.CARVALLO_SUPABASE_URL, window.CARVALLO_SUPABASE_ANON_KEY);
}

async function loadCars() {
  const client = getSupabaseClient();
  if (!client) return window.CARVALLO_SEED_CARS || [];

  const { data, error } = await client
    .from("cars")
    .select("*")
    .eq("is_published", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return window.CARVALLO_SEED_CARS || [];
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

function statusClass(status) {
  return status === "sold" ? "muted" : "";
}

function carCard(car) {
  const title = `${car.make || ""} ${car.model || ""}`.trim();
  const division = car.division === "selected" ? "Selected" : "Motors";
  const price = car.price_label || "Prezzo su richiesta";
  return `
    <article class="car-card" data-division="${car.division}" data-status="${car.status}">
      <figure>
        <img src="${car.image_url || ""}" alt="${title}" loading="lazy">
      </figure>
      <div class="car-body">
        <div class="car-top">
          <span class="badge ${car.division === "selected" ? "selected" : ""}">${division}</span>
          <strong class="${statusClass(car.status)}">${statusLabel(car.status)}</strong>
        </div>
        <h3 class="car-title">${title}</h3>
        <p class="car-price">${price}</p>
        <p class="car-meta">
          <span>${car.year || "Anno n/d"}</span>
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

function matchesSearch(car) {
  if (!searchTerm) return true;
  const haystack = [
    car.make,
    car.model,
    car.year,
    car.fuel,
    car.transmission,
    car.price_label,
    car.short_description
  ].join(" ").toLowerCase();
  return haystack.includes(searchTerm);
}

function filterCars(cars, grid) {
  const limit = Number(grid.dataset.limit || 0);
  const allowSold = grid.dataset.allowSold === "true";
  const filtered = cars
    .filter((car) => (allowSold ? true : car.status !== "sold"))
    .filter((car) => (activeDivision === "all" ? true : car.division === activeDivision))
    .filter((car) => (activeStatus === "all" ? true : car.status === activeStatus))
    .filter(matchesSearch);

  return limit ? filtered.slice(0, limit) : filtered;
}

async function renderCars() {
  const grid = document.querySelector("#car-grid");
  if (!grid) return;

  const cars = await loadCars();
  const visible = filterCars(cars, grid);
  grid.innerHTML = visible.length
    ? visible.map(carCard).join("")
    : "<p class=\"empty-state\">Nessuna auto trovata con questi filtri.</p>";
}

function bindFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeDivision = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderCars();
    });
  });

  document.querySelectorAll("[data-status-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeStatus = button.dataset.statusFilter;
      document.querySelectorAll("[data-status-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderCars();
    });
  });

  const search = document.querySelector("#stock-search");
  if (search) {
    search.addEventListener("input", () => {
      searchTerm = search.value.trim().toLowerCase();
      renderCars();
    });
  }
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

function initSite() {
  bindFilters();
  renderCars();
  document.querySelectorAll("[data-form]").forEach((form) => form.addEventListener("submit", submitLead));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSite);
} else {
  initSite();
}

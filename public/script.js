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

function schemaPrice(value) {
  if (!value) return undefined;
  const match = String(value).match(/[\d.,]+/);
  if (!match) return undefined;
  return match[0].replace(/\./g, "").replace(",", ".");
}

function carCard(car) {
  const title = `${car.make || ""} ${car.model || ""}`.trim();
  const division = car.division === "selected" ? "Selected" : "Motors";
  const price = car.price_label || "Prezzo su richiesta";
  return `
    <article class="car-card" data-division="${car.division}" data-status="${car.status}" itemscope itemtype="https://schema.org/Vehicle">
      <figure>
        <img src="${car.image_url || ""}" alt="${title}" loading="lazy" itemprop="image">
      </figure>
      <div class="car-body">
        <div class="car-top">
          <span class="badge ${car.division === "selected" ? "selected" : ""}">${division}</span>
          <strong class="${statusClass(car.status)}">${statusLabel(car.status)}</strong>
        </div>
        <h3 class="car-title" itemprop="name">${title}</h3>
        <p class="car-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer"><span itemprop="price">${price}</span></p>
        <p class="car-meta">
          <span>${car.year || "Anno n/d"}</span>
          <span>${formatKm(car.mileage_km)}</span>
          <span>${car.fuel || "Alimentazione n/d"}</span>
          <span>${car.transmission || "Cambio n/d"}</span>
        </p>
        <p class="car-desc" itemprop="description">${car.short_description || ""}</p>
        <a class="button ghost" href="${contacts.whatsappBase}?text=${encodeURIComponent(`Ciao, vorrei informazioni su ${title}`)}">Richiedi info</a>
      </div>
    </article>
  `;
}

function updateScrollProgress() {
  const progress = document.querySelector(".scroll-progress");
  if (!progress) return;

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  progress.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
}

function updateHeaderState() {
  document.querySelectorAll(".site-header").forEach((header) => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  });
}

function bindMotion() {
  const revealItems = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });

  revealItems.forEach((item) => observer.observe(item));
}

function bindChromeEffects() {
  updateScrollProgress();
  updateHeaderState();
  window.addEventListener("scroll", () => {
    updateScrollProgress();
    updateHeaderState();
  }, { passive: true });
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
  injectCatalogStructuredData(visible);
}

function injectCatalogStructuredData(cars) {
  if (!document.body.classList.contains("catalog-page")) return;

  const previous = document.querySelector("#vehicle-jsonld");
  if (previous) previous.remove();

  const vehicles = cars.slice(0, 24).map((car, index) => {
    const title = `${car.make || ""} ${car.model || ""}`.trim();
    return {
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Vehicle",
        "name": title,
        "brand": car.make,
        "model": car.model,
        "vehicleModelDate": car.year || undefined,
        "mileageFromOdometer": car.mileage_km ? {
          "@type": "QuantitativeValue",
          "value": car.mileage_km,
          "unitCode": "KMT"
        } : undefined,
        "fuelType": car.fuel || undefined,
        "vehicleTransmission": car.transmission || undefined,
        "image": car.image_url || undefined,
        "description": car.short_description || undefined,
        "offers": {
          "@type": "Offer",
          "availability": car.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
          "priceCurrency": "EUR",
          "price": schemaPrice(car.price_label)
        }
      }
    };
  });

  const script = document.createElement("script");
  script.id = "vehicle-jsonld";
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Catalogo auto Carvallo Motors",
    "itemListElement": vehicles
  });
  document.head.appendChild(script);
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
  document.body.classList.add("is-ready");
  bindMotion();
  bindChromeEffects();
  bindFilters();
  renderCars();
  document.querySelectorAll("[data-form]").forEach((form) => form.addEventListener("submit", submitLead));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSite);
} else {
  initSite();
}

const contacts = {
  whatsappBase: "https://wa.me/393923139899",
  whatsapp: "https://wa.me/393923139899?text=Ciao%2C%20vorrei%20pi%C3%B9%20informazioni",
  email: "info@carvallo-motors.com"
};

let activeDivision = "all";
let activeStatus = "available";
let searchTerm = "";
let catalogCars = [];

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function assetUrl(value) {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `/${String(value).replace(/^\/+/, "")}`;
}

function carTitle(car) {
  return `${car.make || ""} ${car.model || ""}`.trim();
}

function carGallery(car) {
  const urls = Array.isArray(car.gallery_urls) ? car.gallery_urls : [];
  return [car.image_url, ...urls]
    .filter(Boolean)
    .map(assetUrl)
    .filter((url, index, list) => list.indexOf(url) === index);
}

function carDetailUrl(car) {
  const slug = encodeURIComponent(car.slug || car.id || "");
  const basePath = window.location.pathname.includes("auto") ? window.location.pathname : "/auto.html";
  return `${window.location.origin}${basePath}#auto-${slug}`;
}

function carWhatsappUrl(car) {
  const title = carTitle(car);
  const message = `Ciao, sono interessato a questa macchina: ${title}. Link annuncio: ${carDetailUrl(car)}`;
  return `${contacts.whatsappBase}?text=${encodeURIComponent(message)}`;
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
  const title = carTitle(car);
  const division = car.division === "selected" ? "Selected" : "Motors";
  const price = car.price_label || "Prezzo su richiesta";
  const image = assetUrl(car.image_url);
  return `
    <article class="car-card" data-car-slug="${escapeHtml(car.slug || car.id)}" data-division="${escapeHtml(car.division)}" data-status="${escapeHtml(car.status)}" itemscope itemtype="https://schema.org/Vehicle">
      <a class="card-hit" href="#auto-${encodeURIComponent(car.slug || car.id)}" data-open-car="${escapeHtml(car.slug || car.id)}" aria-label="Apri annuncio ${escapeHtml(title)}"></a>
      <figure>
        <img src="${image}" alt="${escapeHtml(title)}" loading="lazy" itemprop="image">
      </figure>
      <div class="car-body">
        <div class="car-top">
          <span class="badge ${car.division === "selected" ? "selected" : ""}">${division}</span>
          <strong class="${statusClass(car.status)}">${statusLabel(car.status)}</strong>
        </div>
        <h3 class="car-title" itemprop="name">${escapeHtml(title)}</h3>
        <p class="car-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer"><span itemprop="price">${price}</span></p>
        <p class="car-meta">
          <span>${car.year || "Anno n/d"}</span>
          <span>${formatKm(car.mileage_km)}</span>
          <span>${escapeHtml(car.fuel || "Alimentazione n/d")}</span>
          <span>${escapeHtml(car.transmission || "Cambio n/d")}</span>
        </p>
        <p class="car-desc" itemprop="description">${escapeHtml(car.short_description || "")}</p>
        <div class="car-actions">
          <a class="button primary" href="#auto-${encodeURIComponent(car.slug || car.id)}" data-open-car="${escapeHtml(car.slug || car.id)}">Dettagli</a>
          <a class="button ghost" href="${carWhatsappUrl(car)}">WhatsApp</a>
        </div>
      </div>
    </article>
  `;
}

function detailRows(car) {
  return [
    ["Prezzo", car.price_label || "Prezzo su richiesta"],
    ["Stato", statusLabel(car.status)],
    ["Divisione", car.division === "selected" ? "Carvallo Selected" : "Carvallo Motors"],
    ["Marca", car.make || "n/d"],
    ["Modello", car.model || "n/d"],
    ["Anno", car.year || "n/d"],
    ["Chilometri", formatKm(car.mileage_km)],
    ["Alimentazione", car.fuel || "n/d"],
    ["Cambio", car.transmission || "n/d"]
  ];
}

function openCarDetail(slug) {
  const car = catalogCars.find((item) => String(item.slug || item.id) === String(slug));
  if (!car) return;

  const title = carTitle(car);
  const gallery = carGallery(car);
  const firstImage = gallery[0] || "";
  const dialog = document.querySelector("#car-detail");
  if (!dialog) return;

  dialog.innerHTML = `
    <div class="detail-backdrop" data-close-detail></div>
    <article class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <button class="detail-close" type="button" data-close-detail aria-label="Chiudi annuncio">×</button>
      <section class="detail-gallery" aria-label="Foto ${escapeHtml(title)}">
        <figure class="detail-main-image">
          <img src="${firstImage}" alt="${escapeHtml(title)}" data-detail-main>
        </figure>
        <div class="detail-thumbs" aria-label="Seleziona foto">
          ${gallery.map((url, index) => `
            <button class="detail-thumb ${index === 0 ? "active" : ""}" type="button" data-detail-image="${escapeHtml(url)}" aria-label="Foto ${index + 1} di ${escapeHtml(title)}">
              <img src="${escapeHtml(url)}" alt="">
            </button>
          `).join("")}
        </div>
      </section>
      <section class="detail-content">
        <div class="detail-kicker">
          <span class="badge ${car.division === "selected" ? "selected" : ""}">${car.division === "selected" ? "Selected" : "Motors"}</span>
          <strong class="${statusClass(car.status)}">${statusLabel(car.status)}</strong>
        </div>
        <h2 id="detail-title">${escapeHtml(title)}</h2>
        <p class="detail-price">${escapeHtml(car.price_label || "Prezzo su richiesta")}</p>
        <div class="detail-specs">
          ${detailRows(car).map(([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `).join("")}
        </div>
        <div class="detail-copy">
          <h3>Descrizione</h3>
          <p>${escapeHtml(car.description || car.short_description || "Dettagli disponibili su richiesta.")}</p>
        </div>
        <div class="detail-note">
          <strong>Nota annuncio</strong>
          <span>Dati e disponibilità da verificare con Carvallo prima dell'acquisto.</span>
        </div>
        <div class="detail-actions">
          <a class="button primary whatsapp-action" href="${carWhatsappUrl(car)}">Scrivi su WhatsApp</a>
          <a class="button ghost" href="tel:+393923139899">Chiama</a>
        </div>
      </section>
    </article>
  `;

  dialog.hidden = false;
  document.body.classList.add("detail-open");
  window.history.replaceState(null, "", `#auto-${encodeURIComponent(car.slug || car.id)}`);
}

function closeCarDetail() {
  const dialog = document.querySelector("#car-detail");
  if (!dialog) return;
  dialog.hidden = true;
  dialog.innerHTML = "";
  document.body.classList.remove("detail-open");
  if (window.location.hash.startsWith("#auto-")) {
    window.history.replaceState(null, "", window.location.pathname);
  }
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
  catalogCars = cars;
  const visible = filterCars(cars, grid);
  grid.innerHTML = visible.length
    ? visible.map(carCard).join("")
    : "<p class=\"empty-state\">Nessuna auto trovata con questi filtri.</p>";
  bindCarCards();
  injectCatalogStructuredData(visible);

  const hashSlug = window.location.hash.startsWith("#auto-")
    ? decodeURIComponent(window.location.hash.replace("#auto-", ""))
    : "";
  if (hashSlug) openCarDetail(hashSlug);
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
        "image": assetUrl(car.image_url) || undefined,
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

function bindCarCards() {
  document.querySelectorAll(".car-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      openCarDetail(card.dataset.carSlug);
    });
  });

  document.querySelectorAll("[data-open-car]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openCarDetail(button.dataset.openCar);
    });
  });

  document.querySelectorAll(".car-card img").forEach((image) => {
    image.addEventListener("error", () => {
      image.closest("figure")?.classList.add("is-broken");
      image.removeAttribute("src");
    }, { once: true });
  });
}

function bindCarDetail() {
  const detail = document.querySelector("#car-detail");
  if (!detail) return;

  detail.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close-detail]");
    if (close) {
      closeCarDetail();
      return;
    }

    const thumb = event.target.closest("[data-detail-image]");
    if (!thumb) return;
    const main = detail.querySelector("[data-detail-main]");
    if (main) main.src = thumb.dataset.detailImage;
    detail.querySelectorAll(".detail-thumb").forEach((item) => item.classList.toggle("active", item === thumb));
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !detail.hidden) closeCarDetail();
  });
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
  bindCarDetail();
  renderCars();
  document.querySelectorAll("[data-form]").forEach((form) => form.addEventListener("submit", submitLead));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSite);
} else {
  initSite();
}

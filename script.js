const contacts = {
  whatsappBase: "https://wa.me/393923139899",
  whatsapp: "https://wa.me/393923139899?text=Ciao%2C%20vorrei%20pi%C3%B9%20informazioni",
  email: "info@carvallo-motors.com"
};

let activeDivision = "all";
let activeStatus = "available";
let searchTerm = "";
let catalogCars = [];
let zoomTouchStartX = 0;
let zoomTouchStartY = 0;

function getSupabaseClient() {
  if (!window.supabase || !window.CARVALLO_SUPABASE_URL || !window.CARVALLO_SUPABASE_ANON_KEY) {
    return null;
  }
  return window.supabase.createClient(window.CARVALLO_SUPABASE_URL, window.CARVALLO_SUPABASE_ANON_KEY);
}

async function loadCars() {
  const seedCars = window.CARVALLO_SEED_CARS || [];
  const client = getSupabaseClient();
  if (!client) return seedCars;

  const { data, error } = await client
    .from("cars")
    .select("*")
    .eq("is_published", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return seedCars;
  if (data.length < seedCars.length) {
    const seedSlugs = new Set(seedCars.map((car) => car.slug));
    return [...seedCars, ...data.filter((car) => !seedSlugs.has(car.slug))];
  }
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

function galleryArrowIcon(direction) {
  const path = direction === "next" ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6";
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg>`;
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

function autoscoutListingUrl(car) {
  if (isArchivedStatus(car.status)) return "";
  const value = String(car.source_url || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const isAutoscout = /(^|\.)autoscout24\.it$/i.test(url.hostname);
    const isListing = url.pathname.includes("/annunci/");
    return isAutoscout && isListing ? value : "";
  } catch {
    return "";
  }
}

function statusLabel(status) {
  return {
    available: "Disponibile",
    incoming: "In arrivo",
    unavailable: "Non disponibile",
    sold: "Venduta"
  }[status] || "Disponibile";
}

function statusClass(status) {
  return isArchivedStatus(status) ? "muted" : "";
}

function isArchivedStatus(status) {
  return status === "sold" || status === "unavailable";
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
  const slug = car.slug || car.id;
  return `
    <article class="car-card" data-car-slug="${escapeHtml(slug)}" data-division="${escapeHtml(car.division)}" data-status="${escapeHtml(car.status)}" itemscope itemtype="https://schema.org/Vehicle">
      <button class="card-hit" type="button" data-open-car="${escapeHtml(slug)}" aria-label="Apri annuncio ${escapeHtml(title)}"></button>
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
          <a class="button primary" href="#auto-${encodeURIComponent(slug)}" data-open-car="${escapeHtml(slug)}">Apri scheda</a>
          <a class="button ghost" href="${carWhatsappUrl(car)}">Scrivi</a>
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
  const autoscoutUrl = autoscoutListingUrl(car);
  const dialog = document.querySelector("#car-detail");
  if (!dialog) return;

  dialog.innerHTML = `
    <div class="detail-backdrop" data-close-detail></div>
    <article class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <button class="detail-close" type="button" data-close-detail aria-label="Chiudi annuncio">×</button>
      <section class="detail-gallery" aria-label="Foto ${escapeHtml(title)}">
        <figure class="detail-main-image" data-gallery-index="0">
          <button class="gallery-arrow prev" type="button" data-gallery-step="-1" aria-label="Foto precedente">${galleryArrowIcon("prev")}</button>
          <button class="gallery-arrow next" type="button" data-gallery-step="1" aria-label="Foto successiva">${galleryArrowIcon("next")}</button>
          <button class="zoom-button" type="button" data-zoom-image="${escapeHtml(firstImage)}" aria-label="Ingrandisci foto">Zoom</button>
          <img src="${firstImage}" alt="${escapeHtml(title)}" data-detail-main>
        </figure>
        <div class="detail-thumbs" aria-label="Seleziona foto">
          ${gallery.map((url, index) => `
            <button class="detail-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-index="${index}" data-detail-image="${escapeHtml(url)}" aria-label="Foto ${index + 1} di ${escapeHtml(title)}">
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
          <a class="button ghost" href="tel:+393923139899" data-call-url="tel:+393923139899">Chiama</a>
          ${autoscoutUrl ? `<a class="button ghost autoscout-action" href="${escapeHtml(autoscoutUrl)}" target="_blank" rel="noopener noreferrer">Vedi su AutoScout24</a>` : ""}
        </div>
      </section>
    </article>
  `;

  dialog.hidden = false;
  document.body.classList.add("detail-open");
  window.history.replaceState(null, "", `#auto-${encodeURIComponent(car.slug || car.id)}`);
  requestAnimationFrame(() => {
    dialog.querySelector(".detail-panel")?.scrollTo({ top: 0, left: 0 });
  });
}

function openCarDetailFromHash() {
  if (!window.location.hash.startsWith("#auto-")) return;
  openCarDetail(decodeURIComponent(window.location.hash.replace("#auto-", "")));
}

function setGalleryImage(detail, index) {
  const thumbs = [...detail.querySelectorAll(".detail-thumb")];
  if (!thumbs.length) return;
  const safeIndex = (index + thumbs.length) % thumbs.length;
  const thumb = thumbs[safeIndex];
  const imageUrl = thumb.dataset.detailImage;
  const main = detail.querySelector("[data-detail-main]");
  const mainFigure = detail.querySelector(".detail-main-image");
  const zoom = detail.querySelector("[data-zoom-image]");
  if (main) main.src = imageUrl;
  if (zoom) zoom.dataset.zoomImage = imageUrl;
  if (mainFigure) mainFigure.dataset.galleryIndex = String(safeIndex);
  thumbs.forEach((item) => item.classList.toggle("active", item === thumb));
  const strip = thumb.closest(".detail-thumbs");
  if (strip) {
    strip.scrollTo({
      left: thumb.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2,
      behavior: "smooth"
    });
  }
}

function setZoomImage(detail, index) {
  const viewer = detail.querySelector(".zoom-viewer");
  const thumbs = [...detail.querySelectorAll(".detail-thumb")];
  if (!viewer || !thumbs.length) return;

  const safeIndex = (index + thumbs.length) % thumbs.length;
  const imageUrl = thumbs[safeIndex].dataset.detailImage;
  const image = viewer.querySelector("[data-zoom-main]");
  const counter = viewer.querySelector("[data-zoom-counter]");
  const zoomThumbs = [...viewer.querySelectorAll("[data-zoom-thumb]")];
  if (image) image.src = imageUrl;
  if (counter) counter.textContent = `${safeIndex + 1} / ${thumbs.length}`;
  viewer.dataset.zoomIndex = String(safeIndex);
  zoomThumbs.forEach((thumb) => thumb.classList.toggle("active", Number(thumb.dataset.zoomThumb) === safeIndex));
  setGalleryImage(detail, safeIndex);

  const strip = viewer.querySelector(".zoom-thumbs");
  const activeThumb = viewer.querySelector(`[data-zoom-thumb="${safeIndex}"]`);
  if (strip && activeThumb) {
    strip.scrollTo({
      left: activeThumb.offsetLeft - (strip.clientWidth - activeThumb.clientWidth) / 2,
      behavior: "smooth"
    });
  }
}

function openZoomViewer(index = 0) {
  const detail = document.querySelector("#car-detail");
  const thumbs = [...detail?.querySelectorAll(".detail-thumb") || []];
  if (!detail || !thumbs.length) return;
  const safeIndex = (index + thumbs.length) % thumbs.length;
  const imageUrl = thumbs[safeIndex].dataset.detailImage;
  const existing = detail.querySelector(".zoom-viewer");
  if (existing) existing.remove();
  detail.insertAdjacentHTML("beforeend", `
    <div class="zoom-viewer" role="dialog" aria-modal="true" aria-label="Galleria foto ingrandita" data-zoom-index="${safeIndex}">
      <button class="zoom-close" type="button" data-close-zoom aria-label="Chiudi zoom">×</button>
      <button class="gallery-arrow zoom-prev" type="button" data-zoom-step="-1" aria-label="Foto precedente">${galleryArrowIcon("prev")}</button>
      <button class="gallery-arrow zoom-next" type="button" data-zoom-step="1" aria-label="Foto successiva">${galleryArrowIcon("next")}</button>
      <img src="${escapeHtml(imageUrl)}" alt="" data-zoom-main>
      <div class="zoom-meta">
        <span data-zoom-counter>${safeIndex + 1} / ${thumbs.length}</span>
      </div>
      <div class="zoom-thumbs" aria-label="Seleziona foto ingrandita">
        ${thumbs.map((thumb, thumbIndex) => `
          <button class="zoom-thumb ${thumbIndex === safeIndex ? "active" : ""}" type="button" data-zoom-thumb="${thumbIndex}" aria-label="Foto ${thumbIndex + 1}">
            <img src="${escapeHtml(thumb.dataset.detailImage)}" alt="">
          </button>
        `).join("")}
      </div>
    </div>
  `);
  setGalleryImage(detail, safeIndex);
}

function closeZoomViewer() {
  document.querySelector(".zoom-viewer")?.remove();
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

function updateScrollProgress(progress, maxScroll, scrollY) {
  if (!progress) return;

  const ratio = maxScroll > 0 ? scrollY / maxScroll : 0;
  progress.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
}

function updateHeaderState(headers, scrollY, previousState) {
  const landing = document.querySelector(".brand-landing");
  const threshold = landing ? Math.max(12, landing.offsetHeight - 96) : 12;
  const isScrolled = scrollY > threshold;
  if (previousState.value === isScrolled) return;
  previousState.value = isScrolled;
  headers.forEach((header) => header.classList.toggle("is-scrolled", isScrolled));
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
  const progress = document.querySelector(".scroll-progress");
  const headers = [...document.querySelectorAll(".site-header")];
  const previousHeaderState = { value: null };
  let maxScroll = 0;
  let frameRequested = false;

  const refreshScrollMetrics = () => {
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  };

  const runChromeEffects = () => {
    frameRequested = false;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    updateScrollProgress(progress, maxScroll, scrollY);
    updateHeaderState(headers, scrollY, previousHeaderState);
  };

  const scheduleChromeEffects = () => {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(runChromeEffects);
  };

  refreshScrollMetrics();
  runChromeEffects();
  window.addEventListener("scroll", scheduleChromeEffects, { passive: true });
  window.addEventListener("resize", () => {
    refreshScrollMetrics();
    scheduleChromeEffects();
  }, { passive: true });
  window.addEventListener("load", () => {
    refreshScrollMetrics();
    scheduleChromeEffects();
  }, { once: true });
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
    .filter((car) => (allowSold ? true : !isArchivedStatus(car.status)))
    .filter((car) => (activeDivision === "all" ? true : car.division === activeDivision))
    .filter((car) => (activeStatus === "all" ? true : car.status === activeStatus))
    .filter(matchesSearch);

  return limit ? filtered.slice(0, limit) : filtered;
}

function filterCatalogGroup(cars, archived) {
  return cars
    .filter((car) => isArchivedStatus(car.status) === archived)
    .filter((car) => (activeDivision === "all" ? true : car.division === activeDivision))
    .filter(matchesSearch);
}

function renderGrid(grid, cars, emptyMessage) {
  grid.innerHTML = cars.length
    ? cars.map(carCard).join("")
    : `<p class="empty-state">${emptyMessage}</p>`;
}

function updateCatalogStats(cars) {
  const activeCount = cars.filter((car) => !isArchivedStatus(car.status)).length;
  const archiveCount = cars.filter((car) => isArchivedStatus(car.status)).length;
  const activeStat = document.querySelector("[data-stat-active]");
  const archiveStat = document.querySelector("[data-stat-archive]");
  if (activeStat) activeStat.textContent = String(activeCount);
  if (archiveStat) archiveStat.textContent = String(archiveCount);
}

async function renderCars() {
  const grid = document.querySelector("#car-grid");
  if (!grid) return;

  const cars = await loadCars();
  catalogCars = cars;
  updateCatalogStats(cars);

  const archiveGrid = document.querySelector("#archive-grid");
  if (archiveGrid) {
    const activeCars = filterCatalogGroup(cars, false);
    const archivedCars = filterCatalogGroup(cars, true);
    renderGrid(grid, activeCars, "Nessuna auto disponibile con questi filtri.");
    renderGrid(archiveGrid, archivedCars, "Nessuna auto in archivio con questi filtri.");
    bindCarCards();
    injectCatalogStructuredData(activeCars);

    const hashSlug = window.location.hash.startsWith("#auto-")
      ? decodeURIComponent(window.location.hash.replace("#auto-", ""))
      : "";
    if (hashSlug) openCarDetail(hashSlug);
    return;
  }

  const visible = filterCars(cars, grid);
  renderGrid(grid, visible, "Nessuna auto trovata con questi filtri.");
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
          "availability": isArchivedStatus(car.status) ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
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
  if (!document.documentElement.dataset.carCardsBound) {
    document.documentElement.dataset.carCardsBound = "true";

    document.addEventListener("click", (event) => {
      const opener = event.target.closest("[data-open-car]");
      if (opener) {
        event.preventDefault();
        openCarDetail(opener.dataset.openCar);
        return;
      }

      const card = event.target.closest(".car-card");
      if (!card || event.target.closest("a, button")) return;
      openCarDetail(card.dataset.carSlug);
    });

    window.addEventListener("hashchange", openCarDetailFromHash);
  }

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

    if (event.target.closest("[data-close-zoom]")) {
      closeZoomViewer();
      return;
    }

    const call = event.target.closest("[data-call-url]");
    if (call) {
      event.preventDefault();
      window.location.href = call.dataset.callUrl;
      return;
    }

    const zoom = event.target.closest("[data-zoom-image]");
    if (zoom) {
      const current = Number(detail.querySelector(".detail-main-image")?.dataset.galleryIndex || 0);
      openZoomViewer(current);
      return;
    }

    if (event.target.closest("[data-detail-main]")) {
      const current = Number(detail.querySelector(".detail-main-image")?.dataset.galleryIndex || 0);
      openZoomViewer(current);
      return;
    }

    const zoomStep = event.target.closest("[data-zoom-step]");
    if (zoomStep) {
      const viewer = detail.querySelector(".zoom-viewer");
      const current = Number(viewer?.dataset.zoomIndex || 0);
      setZoomImage(detail, current + Number(zoomStep.dataset.zoomStep));
      return;
    }

    const zoomThumb = event.target.closest("[data-zoom-thumb]");
    if (zoomThumb) {
      setZoomImage(detail, Number(zoomThumb.dataset.zoomThumb || 0));
      return;
    }

    const step = event.target.closest("[data-gallery-step]");
    if (step) {
      const current = Number(detail.querySelector(".detail-main-image")?.dataset.galleryIndex || 0);
      setGalleryImage(detail, current + Number(step.dataset.galleryStep));
      return;
    }

    const thumb = event.target.closest("[data-detail-image]");
    if (!thumb) return;
    setGalleryImage(detail, Number(thumb.dataset.galleryIndex || 0));
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector(".zoom-viewer")) {
      closeZoomViewer();
      return;
    }
    if (event.key === "Escape" && !detail.hidden) closeCarDetail();
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && document.querySelector(".zoom-viewer")) {
      const current = Number(detail.querySelector(".zoom-viewer")?.dataset.zoomIndex || 0);
      setZoomImage(detail, current + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !detail.hidden) {
      const current = Number(detail.querySelector(".detail-main-image")?.dataset.galleryIndex || 0);
      setGalleryImage(detail, current + (event.key === "ArrowRight" ? 1 : -1));
    }
  });

  detail.addEventListener("touchstart", (event) => {
    if (!event.target.closest(".zoom-viewer")) return;
    const touch = event.changedTouches[0];
    zoomTouchStartX = touch.clientX;
    zoomTouchStartY = touch.clientY;
  }, { passive: true });

  detail.addEventListener("touchend", (event) => {
    if (!event.target.closest(".zoom-viewer")) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - zoomTouchStartX;
    const deltaY = touch.clientY - zoomTouchStartY;
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    const current = Number(detail.querySelector(".zoom-viewer")?.dataset.zoomIndex || 0);
    setZoomImage(detail, current + (deltaX < 0 ? 1 : -1));
  }, { passive: true });
}

function bindFilters() {
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item.dataset.filter === activeDivision));
  document.querySelectorAll("[data-status-filter]").forEach((item) => item.classList.toggle("active", item.dataset.statusFilter === activeStatus));

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

function alignHashTarget() {
  const id = window.location.hash.slice(1);
  if (!id || id.startsWith("auto-")) return;
  const target = document.getElementById(id);
  if (!target) return;
  const scrollToTarget = () => {
    const offset = document.querySelector(".site-header")?.offsetHeight || 0;
    const top = target.getBoundingClientRect().top + window.scrollY - offset - 8;
    window.scrollTo({ top, behavior: "auto" });
  };
  requestAnimationFrame(scrollToTarget);
  window.setTimeout(scrollToTarget, 700);
}

function initSite() {
  document.body.classList.add("is-ready");
  if (document.body.classList.contains("selected-page")) {
    activeDivision = "selected";
  }
  if (window.location.hash === "#selected" || window.location.hash === "#motors") {
    activeDivision = window.location.hash.replace("#", "");
  }
  bindMotion();
  bindChromeEffects();
  bindFilters();
  bindCarDetail();
  renderCars();
  alignHashTarget();
  document.querySelectorAll("[data-form]").forEach((form) => form.addEventListener("submit", submitLead));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSite);
} else {
  initSite();
}

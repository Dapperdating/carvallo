# Carvallo Motors

Sito statico pronto per Cloudflare Pages, con catalogo collegabile a Supabase e fallback locale.

## Sviluppo locale

```bash
npm run dev
```

Apri `http://localhost:4173`.

## Supabase

1. Applica `supabase/schema.sql` al progetto Supabase.
2. Inserisci le auto nella tabella `cars`.
3. Carica immagini pubbliche in `car_images` o usa URL esterni.
4. Configura `window.CARVALLO_SUPABASE_URL` e `window.CARVALLO_SUPABASE_ANON_KEY` in `config.js`.

Le tabelle hanno RLS attivo. Le auto pubblicate sono leggibili pubblicamente, i lead sono inseribili pubblicamente, l'admin richiede un utente autenticato presente in `admin_users`.

## Cloudflare Pages

- Framework preset: `None`
- Build command: vuoto
- Output directory: `/`
- Project creato: `carvallo-website`
- Preview domain: `https://carvallo-website.pages.dev`

Quando il dominio sara' su Cloudflare, collega `carvallo-motors.com` al progetto Pages.

Nota: il progetto Pages e' stato creato via Cloudflare API, ma il deploy richiede il collegamento di una repo GitHub o Wrangler/direct upload. In questa macchina `gh`, `npm`, `npx` e `wrangler` non sono disponibili.

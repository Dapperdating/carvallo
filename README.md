# Carvallo Motors

Sito statico pronto per Cloudflare Pages, con catalogo collegabile a Supabase e fallback locale.

## Sviluppo locale

```bash
npm run dev
```

Apri `http://localhost:4173`.

## Supabase

1. Crea o seleziona il progetto Supabase dedicato a Carvallo.
2. Applica `supabase/schema.sql` al progetto Supabase.
3. Configura `window.CARVALLO_SUPABASE_URL` e `window.CARVALLO_SUPABASE_ANON_KEY` in `config.js`.
4. Inserisci nella tabella `admin_users` le email autorizzate a caricare auto.

```sql
insert into public.admin_users (email, role)
values ('nome@carvallo-motors.com', 'owner')
on conflict (email) do update set role = excluded.role;
```

Le tabelle hanno RLS attivo. Le auto pubblicate sono leggibili pubblicamente, i lead sono inseribili pubblicamente, l'admin richiede un utente autenticato con email presente in `admin_users`. Lo schema crea anche il bucket pubblico `car-images` e permette upload, update e delete immagini solo agli admin autorizzati.

## Cloudflare Pages

- Framework preset: `None`
- Build command: vuoto
- Output directory: `/`
- Project creato: `carvallo-website`
- Preview domain: `https://carvallo-website.pages.dev`

Quando il dominio sara' su Cloudflare, collega `carvallo-motors.com` al progetto Pages.

Nota: il progetto Pages e' stato creato via Cloudflare API, ma il deploy richiede il collegamento di una repo GitHub o Wrangler/direct upload. In questa macchina `gh`, `npm`, `npx` e `wrangler` non sono disponibili.

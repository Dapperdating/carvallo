create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  division text not null check (division in ('motors', 'selected')),
  status text not null default 'available' check (status in ('available', 'incoming', 'sold')),
  make text not null,
  model text not null,
  year integer,
  mileage_km integer,
  fuel text,
  transmission text,
  price_label text,
  short_description text,
  description text,
  image_url text,
  featured boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'contact',
  name text not null,
  phone text not null,
  email text,
  message text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cars_touch_updated_at on public.cars;
create trigger cars_touch_updated_at
before update on public.cars
for each row execute function public.touch_updated_at();

alter table public.admin_users enable row level security;
alter table public.cars enable row level security;
alter table public.leads enable row level security;

drop policy if exists "Published cars are public" on public.cars;
create policy "Published cars are public"
on public.cars for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Admins manage cars" on public.cars;
create policy "Admins manage cars"
on public.cars for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = auth.uid()))
with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Public can create leads" on public.leads;
create policy "Public can create leads"
on public.leads for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins read leads" on public.leads;
create policy "Admins read leads"
on public.leads for select
to authenticated
using (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins read admin users" on public.admin_users;
create policy "Admins read admin users"
on public.admin_users for select
to authenticated
using (exists (select 1 from public.admin_users where user_id = auth.uid()));

grant usage on schema public to anon, authenticated;
grant select on public.cars to anon, authenticated;
grant insert on public.leads to anon, authenticated;
grant select, insert, update, delete on public.cars to authenticated;
grant select on public.leads to authenticated;
grant select on public.admin_users to authenticated;

insert into public.cars (slug, division, status, make, model, year, mileage_km, fuel, transmission, price_label, short_description, description, image_url, featured, is_published)
values
('bmw-m4-cs', 'selected', 'available', 'BMW', 'M4 CS', 2024, 0, 'Benzina', 'Automatico', 'Prezzo su richiesta', 'Coupe ad alte prestazioni, impostazione da collezione moderna e presenza scenica.', 'Una sportiva contemporanea scelta per chi cerca un oggetto speciale, non solo un mezzo di trasporto.', 'https://static.wixstatic.com/media/60133d_c9367075e00d478290dabdf4c3a235ec~mv2.jpg/v1/fill/w_1800,h_1200,al_c,q_88,enc_avif,quality_auto/60133d_c9367075e00d478290dabdf4c3a235ec~mv2.jpg', true, true),
('motors-stock-1', 'motors', 'available', 'Carvallo', 'Motors Stock', null, null, 'Selezione usato', 'Variabile', 'Contattaci', 'Auto normali, controllate e pronte per chi cerca una scelta concreta.', 'Carvallo Motors lavora su vetture usate e seminuove con valutazione, ritiro e consulenza rapida.', 'https://static.wixstatic.com/media/60133d_8b8f95be297e4aa09144524df5fcf772~mv2.jpg/v1/fill/w_1800,h_1200,al_c,q_88,enc_avif,quality_auto/60133d_8b8f95be297e4aa09144524df5fcf772~mv2.jpg', true, true)
on conflict (slug) do nothing;

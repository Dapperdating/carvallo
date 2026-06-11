create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  role text not null default 'editor' check (role in ('owner', 'editor')),
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
  gallery_urls text[] not null default '{}',
  source_url text,
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

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
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

drop policy if exists "Admins can see their admin row" on public.admin_users;
create policy "Admins can see their admin row"
on public.admin_users for select
to authenticated
using (lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

create index if not exists admin_users_user_id_idx on public.admin_users (user_id);

drop policy if exists "Published cars are public" on public.cars;
create policy "Published cars are public"
on public.cars for select
to anon
using (is_published = true);

drop policy if exists "Admins manage cars" on public.cars;
drop policy if exists "Admins read all cars" on public.cars;
create policy "Admins read all cars"
on public.cars for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins insert cars" on public.cars;
create policy "Admins insert cars"
on public.cars for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins update cars" on public.cars;
create policy "Admins update cars"
on public.cars for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins delete cars" on public.cars;
create policy "Admins delete cars"
on public.cars for delete
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Public can create leads" on public.leads;
create policy "Public can create leads"
on public.leads for insert
to anon, authenticated
with check (
  char_length(trim(name)) between 2 and 120
  and char_length(trim(phone)) between 5 and 40
  and (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  and (message is null or char_length(message) <= 2000)
);

drop policy if exists "Admins read leads" on public.leads;
create policy "Admins read leads"
on public.leads for select
to authenticated
using (public.current_user_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'car-images',
  'car-images',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads car images" on storage.objects;

drop policy if exists "Admins upload car images" on storage.objects;
create policy "Admins upload car images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'car-images' and public.current_user_is_admin());

drop policy if exists "Admins update car images" on storage.objects;
create policy "Admins update car images"
on storage.objects for update
to authenticated
using (bucket_id = 'car-images' and public.current_user_is_admin())
with check (bucket_id = 'car-images' and public.current_user_is_admin());

drop policy if exists "Admins delete car images" on storage.objects;
create policy "Admins delete car images"
on storage.objects for delete
to authenticated
using (bucket_id = 'car-images' and public.current_user_is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.cars to anon, authenticated;
grant insert on public.leads to anon, authenticated;
grant select, insert, update, delete on public.cars to authenticated;
grant select on public.leads to authenticated;
grant select on public.admin_users to authenticated;

delete from public.admin_users
where lower(email) <> 'main@carvallo-motors.com';

insert into public.admin_users (email, role)
values ('main@carvallo-motors.com', 'owner')
on conflict (email) do update set role = excluded.role;

insert into public.cars (slug, division, status, make, model, year, mileage_km, fuel, transmission, price_label, short_description, description, image_url, source_url, featured, is_published)
values
('ford-fiesta-1-4-trend-automatica', 'motors', 'available', 'Ford', 'Fiesta 1.4 Trend Automatica', null, 32569, 'Benzina', 'Automatico', '8.500,00 euro', 'Unico proprietario, 5 porte, chilometraggio basso e gestione semplice.', 'Importata dal catalogo Wix Carvallo Motors come nuovo arrivo.', 'https://static.wixstatic.com/media/81db15_962cdcd450f848408faa780dae30cbb6~mv2.jpeg/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/81db15_962cdcd450f848408faa780dae30cbb6~mv2.jpeg', 'https://www.carvallo-motors.com/product-page/ford-fiesta-1-4-trend-unico-pro-automatica-soli-32-569km-5-port', true, true),
('jeep-compass-1-4-m-air-longitude', 'motors', 'available', 'Jeep', 'Compass 1.4 M-Air Longitude 140CV', null, null, 'Benzina', 'Manuale', '13.700,00 euro', 'SUV benzina ben accessoriato, pratico e pronto per uso quotidiano.', 'Importata dal catalogo Wix Carvallo Motors come nuovo arrivo.', 'https://static.wixstatic.com/media/81db15_cb115c78d85a4145a7437a63a5868db0~mv2.jpeg/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/81db15_cb115c78d85a4145a7437a63a5868db0~mv2.jpeg', 'https://www.carvallo-motors.com/product-page/jeep-compass-jeep-compass-1-4-m-air-longitude-140cv-ben-accessoriata-benzina', true, true),
('fiat-panda-1-2-easy', 'motors', 'available', 'Fiat', 'Panda 1.2 Easy', null, 16500, 'Benzina', 'Manuale', '8.200,00 euro', 'Pari al nuovo, ideale anche per neopatentati.', 'Importata dal catalogo Wix Carvallo Motors come nuovo arrivo.', 'https://static.wixstatic.com/media/81db15_a70a1ed73df34708bcf9610e061a6d3b~mv2.jpeg/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/81db15_a70a1ed73df34708bcf9610e061a6d3b~mv2.jpeg', 'https://www.carvallo-motors.com/product-page/fiat-panda-easy-1-2', true, true),
('mini-one', 'motors', 'available', 'Mini', 'One', null, null, 'Benzina', 'Manuale', '5.000,00 euro', 'Compatta, distintiva, con prezzo scontato rispetto al listino precedente.', 'Importata dal catalogo Wix Carvallo Motors come nuovo arrivo.', 'https://static.wixstatic.com/media/81db15_c157bae5b2aa49cb93470266878ddd56~mv2.png/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/81db15_c157bae5b2aa49cb93470266878ddd56~mv2.png', 'https://www.carvallo-motors.com/product-page/mini-one', false, true),
('mini-one-5-porte', 'motors', 'sold', 'Mini', 'One 5 Porte', null, null, 'Benzina', 'Manuale', 'Venduta', 'Archivio venduto importato dal catalogo storico Carvallo Motors.', 'Voce archivio Wix: Mini One 5 Porte, esaurita.', 'https://static.wixstatic.com/media/81db15_7a344f17c98a4e4f8c783e80a26b2db0~mv2.png/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/81db15_7a344f17c98a4e4f8c783e80a26b2db0~mv2.png', 'https://www.carvallo-motors.com/product-page/mini-one-5-porte', false, true),
('audi-q3-s-tronic', 'motors', 'sold', 'Audi', 'Q3 S-tronic', null, null, 'Diesel', 'Automatico', 'Venduta', 'Archivio venduto importato dal catalogo storico Carvallo Motors.', 'Voce archivio Wix: Audi Q3 S-tronic, esaurita.', 'https://static.wixstatic.com/media/81db15_d63f507bd635466abf2ca0ec5f35477e~mv2.png/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/81db15_d63f507bd635466abf2ca0ec5f35477e~mv2.png', 'https://www.carvallo-motors.com/product-page/audi-q3-s-tronic', false, true),
('fiat-500x-2015-1-3-mjt-lounge', 'motors', 'sold', 'Fiat', '500X 1.3 MJT Lounge 4x2 95CV', 2015, null, 'Diesel', 'Manuale', 'Venduta', 'Archivio venduto importato dal catalogo storico Carvallo Motors.', 'Voce archivio Wix: Fiat 500X 2015 1.3 MJT Lounge 4x2 95CV, esaurita.', 'https://static.wixstatic.com/media/81db15_add6dcd0e4d448c2ae1efda479e50794~mv2.png/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/81db15_add6dcd0e4d448c2ae1efda479e50794~mv2.png', 'https://www.carvallo-motors.com/product-page/fiat-500x-2015-1-3-mjt-lounge-4x2-95cv', false, true),
('bmw-z4-3-0i-e85-automatica', 'selected', 'sold', 'BMW', 'Z4 3.0i E85 Automatica', null, null, 'Benzina', 'Automatico', 'Venduta', 'Roadster youngtimer importata nell''archivio Selected.', 'Voce archivio Wix: Z4 3.0i E85 Automatica, esaurita.', 'https://static.wixstatic.com/media/60133d_583a7ae029d44664a7bb218f4b669ad0~mv2.jpg/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/60133d_583a7ae029d44664a7bb218f4b669ad0~mv2.jpg', 'https://www.carvallo-motors.com/product-page/z4-3-0i-e85-automatica', false, true),
('toyota-yaris', 'motors', 'sold', 'Toyota', 'Yaris', null, null, 'Benzina', 'Manuale', 'Venduta', 'Archivio venduto importato dal catalogo storico Carvallo Motors.', 'Voce archivio Wix: Toyota Yaris, esaurita.', 'https://static.wixstatic.com/media/60133d_1a5b1a8149a048bb9bc582c9d720126c~mv2.jpeg/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/60133d_1a5b1a8149a048bb9bc582c9d720126c~mv2.jpeg', 'https://www.carvallo-motors.com/product-page/toyota-yaris', false, true),
('mini-cooper-cabrio', 'selected', 'sold', 'Mini', 'Cooper Cabrio', null, null, 'Benzina', 'Manuale', 'Venduta', 'Cabrio compatta importata nell''archivio Selected.', 'Voce archivio Wix: Mini Cooper Cabrio, esaurita.', 'https://static.wixstatic.com/media/60133d_7b300f4ec5a7464a82228549ef47ee03~mv2.jpeg/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/60133d_7b300f4ec5a7464a82228549ef47ee03~mv2.jpeg', 'https://www.carvallo-motors.com/product-page/mini-cooper-cabrio', false, true),
('fiat-panda-archivio', 'selected', 'sold', 'Fiat', 'Panda', null, null, 'Benzina', 'Manuale', 'Venduta', 'Archivio venduto importato dal catalogo storico Carvallo Motors.', 'Voce archivio Wix: Fiat Panda, esaurita.', 'https://static.wixstatic.com/media/60133d_5e8a0342983944fbaca464dc01c727f8~mv2.jpeg/v1/fill/w_900,h_700,al_c,q_85,enc_avif,quality_auto/60133d_5e8a0342983944fbaca464dc01c727f8~mv2.jpeg', 'https://www.carvallo-motors.com/product-page/fiat-panda', false, true)
on conflict (slug) do update set
  division = excluded.division,
  status = excluded.status,
  make = excluded.make,
  model = excluded.model,
  year = excluded.year,
  mileage_km = excluded.mileage_km,
  fuel = excluded.fuel,
  transmission = excluded.transmission,
  price_label = excluded.price_label,
  short_description = excluded.short_description,
  description = excluded.description,
  image_url = excluded.image_url,
  source_url = excluded.source_url,
  featured = excluded.featured,
  is_published = excluded.is_published;

update public.cars
set image_url = '/assets/cars/ford-fiesta/ford-fiesta-01.jpg',
    description = 'Ford Fiesta 1.4 Trend con cambio automatico, unico proprietario e chilometraggio contenuto. Una compatta semplice da gestire, adatta alla citta'' e agli spostamenti quotidiani, con 5 porte e impostazione pratica.',
    gallery_urls = array[
      '/assets/cars/ford-fiesta/ford-fiesta-01.jpg',
      '/assets/cars/ford-fiesta/ford-fiesta-03.jpg',
      '/assets/cars/ford-fiesta/ford-fiesta-05.jpg',
      '/assets/cars/ford-fiesta/ford-fiesta-07.jpg'
    ]
where slug = 'ford-fiesta-1-4-trend-automatica';

update public.cars
set image_url = '/assets/cars/fiat-panda/fiat-panda-01.jpg',
    description = 'Fiat Panda 1.2 Easy benzina con 16.500 km dichiarati, configurazione pratica e costi di gestione contenuti. Ideale per neopatentati, uso urbano e chi cerca una citycar essenziale ma ben tenuta.',
    gallery_urls = array[
      '/assets/cars/fiat-panda/fiat-panda-01.jpg',
      '/assets/cars/fiat-panda/fiat-panda-04.jpg',
      '/assets/cars/fiat-panda/fiat-panda-05.jpg',
      '/assets/cars/fiat-panda/fiat-panda-08.jpg'
    ]
where slug = 'fiat-panda-1-2-easy';

update public.cars
set image_url = '/assets/cars/jeep-compass/jeep-compass-01.jpg',
    description = 'Jeep Compass 1.4 M-Air Longitude 140CV benzina, con cambio manuale e dotazione orientata all''uso quotidiano. SUV comodo, spazioso e versatile, pensato per chi cerca una vettura alta senza rinunciare alla guida semplice.',
    gallery_urls = array[
      '/assets/cars/jeep-compass/jeep-compass-01.jpg',
      '/assets/cars/jeep-compass/jeep-compass-03.jpg',
      '/assets/cars/jeep-compass/jeep-compass-05.jpg',
      '/assets/cars/jeep-compass/jeep-compass-07.jpg'
    ]
where slug = 'jeep-compass-1-4-m-air-longitude';

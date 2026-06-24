alter table public.cars add column if not exists previous_owners integer;
alter table public.cars add column if not exists engine_size text;
alter table public.cars add column if not exists service_history text;
alter table public.cars add column if not exists highlights text;
alter table public.cars add column if not exists gallery_urls text[] not null default '{}';
alter table public.cars add column if not exists source_url text;

update public.cars
set image_url = '/assets/cars/ford-fiesta/ford-fiesta-01.jpg',
    gallery_urls = array[
      '/assets/cars/ford-fiesta/ford-fiesta-01.jpg',
      '/assets/cars/ford-fiesta/ford-fiesta-03.jpg',
      '/assets/cars/ford-fiesta/ford-fiesta-05.jpg',
      '/assets/cars/ford-fiesta/ford-fiesta-07.jpg'
    ],
    short_description = 'Unico proprietario, 5 porte, chilometraggio basso e gestione semplice.',
    description = 'Ford Fiesta 1.4 Trend con cambio automatico, unico proprietario e chilometraggio contenuto. Una compatta semplice da gestire, adatta alla citta'' e agli spostamenti quotidiani, con 5 porte e impostazione pratica.'
where slug = 'ford-fiesta-1-4-trend-automatica';

update public.cars
set image_url = '/assets/cars/fiat-panda/fiat-panda-01.jpg',
    gallery_urls = array[
      '/assets/cars/fiat-panda/fiat-panda-01.jpg',
      '/assets/cars/fiat-panda/fiat-panda-04.jpg',
      '/assets/cars/fiat-panda/fiat-panda-05.jpg',
      '/assets/cars/fiat-panda/fiat-panda-08.jpg'
    ],
    short_description = 'Pari al nuovo, ideale anche per neopatentati.',
    description = 'Fiat Panda 1.2 Easy benzina con 16.500 km dichiarati, configurazione pratica e costi di gestione contenuti. Ideale per neopatentati, uso urbano e chi cerca una citycar essenziale ma ben tenuta.'
where slug = 'fiat-panda-1-2-easy';

update public.cars
set image_url = '/assets/cars/jeep-compass/jeep-compass-01.jpg',
    gallery_urls = array[
      '/assets/cars/jeep-compass/jeep-compass-01.jpg',
      '/assets/cars/jeep-compass/jeep-compass-03.jpg',
      '/assets/cars/jeep-compass/jeep-compass-05.jpg',
      '/assets/cars/jeep-compass/jeep-compass-07.jpg'
    ],
    short_description = 'SUV benzina ben accessoriato, pratico e pronto per uso quotidiano.',
    description = 'Jeep Compass 1.4 M-Air Longitude 140CV benzina, con cambio manuale e dotazione orientata all''uso quotidiano. SUV comodo, spazioso e versatile, pensato per chi cerca una vettura alta senza rinunciare alla guida semplice.'
where slug = 'jeep-compass-1-4-m-air-longitude';

update public.cars
set status = 'sold',
    is_published = false,
    featured = false
where slug in (
  'mini-one',
  'mini-one-5-porte',
  'audi-q3-s-tronic',
  'fiat-500x-2015-1-3-mjt-lounge',
  'bmw-z4-3-0i-e85-automatica',
  'toyota-yaris',
  'mini-cooper-cabrio',
  'fiat-panda-archivio'
);

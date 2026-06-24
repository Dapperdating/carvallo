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
    is_published = true,
    featured = false,
    price_label = 'Venduta',
    gallery_urls = array[image_url]
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

update public.cars set
  short_description = 'Compatta benzina archiviata dal catalogo storico Carvallo Motors.',
  description = 'Mini One benzina con cambio manuale, presente nel catalogo storico Carvallo Motors e ora indicata come venduta. Scheda mantenuta in archivio per documentare le vetture trattate in passato.'
where slug = 'mini-one';

update public.cars set
  short_description = 'Mini One 5 porte archiviata come venduta.',
  description = 'Mini One 5 Porte benzina con cambio manuale, proveniente dal catalogo storico Carvallo Motors. Auto non piu disponibile, mantenuta in archivio come riferimento delle vetture gestite.'
where slug = 'mini-one-5-porte';

update public.cars set
  short_description = 'SUV diesel automatico archiviato come venduto.',
  description = 'Audi Q3 S-tronic diesel con cambio automatico, inserita nello storico Carvallo Motors. La vettura risulta venduta e resta consultabile nella sezione archivio.'
where slug = 'audi-q3-s-tronic';

update public.cars set
  short_description = 'Fiat 500X diesel 2015 archiviata come venduta.',
  description = 'Fiat 500X 1.3 MJT Lounge 4x2 95CV del 2015, cambio manuale e alimentazione diesel. Scheda proveniente dallo storico Carvallo Motors, oggi indicata come venduta.'
where slug = 'fiat-500x-2015-1-3-mjt-lounge';

update public.cars set
  division = 'selected',
  short_description = 'Roadster BMW Z4 E85 archiviata nella selezione Carvallo Selected.',
  description = 'BMW Z4 3.0i E85 con cambio automatico, roadster youngtimer inserita nello storico Carvallo Selected. La vettura risulta venduta e viene mantenuta in archivio per completezza.'
where slug = 'bmw-z4-3-0i-e85-automatica';

update public.cars set
  short_description = 'Toyota Yaris benzina archiviata come venduta.',
  description = 'Toyota Yaris benzina con cambio manuale, proveniente dal catalogo storico Carvallo Motors. Auto venduta e conservata nella sezione archivio.'
where slug = 'toyota-yaris';

update public.cars set
  division = 'selected',
  short_description = 'Mini Cooper Cabrio archiviata nella selezione Carvallo Selected.',
  description = 'Mini Cooper Cabrio benzina con cambio manuale, compatta scoperta proveniente dallo storico Carvallo Selected. La vettura risulta venduta e resta consultabile in archivio.'
where slug = 'mini-cooper-cabrio';

update public.cars set
  division = 'motors',
  short_description = 'Fiat Panda benzina archiviata come venduta.',
  description = 'Fiat Panda benzina con cambio manuale, proveniente dal catalogo storico Carvallo Motors. Auto non piu disponibile, mantenuta in archivio come riferimento.'
where slug = 'fiat-panda-archivio';

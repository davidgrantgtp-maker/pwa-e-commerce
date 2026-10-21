-- =====================================================================
--  MiApp Store · Configuración de tienda + banners
--  Migración idempotente para un proyecto Supabase ya instalado.
--  Ejecutar en SQL Editor -> New query -> pegar todo -> Run.
-- =====================================================================

create or replace function public.tg_set_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

create table if not exists public.configuracion (
  id                 smallint primary key default 1 check (id = 1),
  tienda_nombre      text        not null default 'MiApp Store',
  vendedor_nombre    text        not null default '',
  whatsapp           text        not null default '',
  email              text        not null default '',
  direccion          text        not null default '',
  horario            text        not null default '',
  instagram          text        not null default '',
  envio_costo        numeric(12,2) not null default 1490,
  envio_gratis_desde numeric(12,2) not null default 15000,
  cupon_codigo       text        not null default 'DEMO10',
  cupon_descuento    integer     not null default 10 check (cupon_descuento between 0 and 100),
  actualizado_en     timestamptz not null default now()
);

create table if not exists public.banners (
  id             bigint generated always as identity primary key,
  titulo         text        not null,
  subtitulo      text        not null default '',
  etiqueta       text        not null default '',
  texto_boton    text        not null default '',
  enlace         text        not null default '#catalogo',
  imagen         text        not null default '',
  activo         boolean     not null default true,
  orden          integer     not null default 0,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

drop trigger if exists trg_banners_actualizado on public.banners;
create trigger trg_banners_actualizado
  before update on public.banners
  for each row execute function public.tg_set_actualizado_en();

alter table public.configuracion enable row level security;
alter table public.banners      enable row level security;

drop policy if exists "configuracion lectura publica" on public.configuracion;
create policy "configuracion lectura publica"
  on public.configuracion for select using (true);

drop policy if exists "banners lectura publica" on public.banners;
create policy "banners lectura publica"
  on public.banners for select using (activo = true);

grant select on public.configuracion to anon, authenticated;
grant select on public.banners to anon, authenticated;
grant all privileges on public.configuracion, public.banners to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into public.configuracion (id, tienda_nombre, email, horario)
values (1, 'MiApp Store', 'hola@miapp.store', 'Lun a Vie · 9 a 18h')
on conflict (id) do nothing;

insert into public.banners (titulo, subtitulo, etiqueta, texto_boton, enlace, imagen, activo, orden)
select v.titulo, v.subtitulo, v.etiqueta, v.texto_boton, v.enlace, v.imagen, true, v.orden
from (values
  ('2x1 en cafés', 'Todos los martes, en grano o molido. Stock limitado.', 'OFERTA', 'Aprovechar', '#catalogo', '', 0),
  ('Compra rápida', 'Elegí, confirmá y enviá tu pedido por WhatsApp en 2 minutos.', 'RÁPIDO', 'Comprar ahora', '#catalogo', '', 1),
  ('Envío gratis desde $15.000', 'A todo el país. Retiro en el local sin costo.', 'ENVÍO', 'Ver productos', '#catalogo', '', 2)
) as v(titulo, subtitulo, etiqueta, texto_boton, enlace, imagen, orden)
where not exists (select 1 from public.banners b where b.titulo = v.titulo);

notify pgrst, 'reload schema';

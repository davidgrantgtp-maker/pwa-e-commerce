-- =====================================================================
--  MiApp Store · Esquema para Supabase (Postgres)
-- =====================================================================
--  Cómo aplicarlo:
--   1. Entrá al panel de Supabase del proyecto.
--   2. Menú "SQL Editor" -> "New query".
--   3. Pegá TODO este archivo y ejecutá "Run".
--   4. Listo: al final del archivo se crean el usuario admin y los datos
--      de ejemplo (idempotente). install.php queda como alternativa local.
--
--  El panel de administración usa la service_role key (omite RLS).
--  La tienda usa la anon key y sólo puede leer productos/categorías activos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABLAS
-- ---------------------------------------------------------------------
create table if not exists public.usuarios (
  id            bigint generated always as identity primary key,
  nombre        text        not null,
  email         text        not null unique,
  password_hash text        not null,
  rol           text        not null default 'admin',
  activo        boolean     not null default true,
  creado_en     timestamptz not null default now()
);

create table if not exists public.categorias (
  id        bigint generated always as identity primary key,
  nombre    text        not null unique,
  slug      text        not null unique,
  activo    boolean     not null default true,
  orden     integer     not null default 0,
  creado_en timestamptz not null default now()
);

create table if not exists public.productos (
  id               bigint generated always as identity primary key,
  sku              text,
  nombre           text        not null,
  slug             text        not null unique,
  categoria_id     bigint references public.categorias(id) on delete set null,
  precio           numeric(12,2) not null default 0,
  precio_anterior  numeric(12,2),
  costo            numeric(12,2),
  stock            integer     not null default 0,
  descripcion      text,
  imagen           text,
  etiqueta         text,
  destacado        boolean     not null default false,
  activo           boolean     not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz,
  constraint uq_productos_sku unique (sku)
);

create index if not exists idx_productos_categoria  on public.productos(categoria_id);
create index if not exists idx_productos_activo     on public.productos(activo);
create index if not exists idx_productos_destacado  on public.productos(destacado);

create table if not exists public.importaciones (
  id           bigint generated always as identity primary key,
  archivo      text        not null,
  total        integer     not null default 0,
  creadas      integer     not null default 0,
  actualizadas integer     not null default 0,
  errores      integer     not null default 0,
  usuario_id   bigint references public.usuarios(id) on delete set null,
  creado_en    timestamptz not null default now()
);

create table if not exists public.movimientos (
  id          bigint generated always as identity primary key,
  producto_id bigint references public.productos(id) on delete set null,
  campo       text        not null,
  tipo        text        not null,
  valor       text,
  motivo      text,
  usuario_id  bigint references public.usuarios(id) on delete set null,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_movimientos_producto on public.movimientos(producto_id);

-- ---------------------------------------------------------------------
-- TRIGGER: actualizar actualizado_en en cada UPDATE de productos
-- ---------------------------------------------------------------------
create or replace function public.tg_set_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists trg_productos_actualizado on public.productos;
create trigger trg_productos_actualizado
  before update on public.productos
  for each row execute function public.tg_set_actualizado_en();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.usuarios      enable row level security;
alter table public.categorias    enable row level security;
alter table public.productos     enable row level security;
alter table public.importaciones enable row level security;
alter table public.movimientos   enable row level security;

-- Lectura pública (anon) sólo de catálogo activo.
drop policy if exists "catalogo lectura productos" on public.productos;
create policy "catalogo lectura productos"
  on public.productos for select
  using (activo = true);

drop policy if exists "catalogo lectura categorias" on public.categorias;
create policy "catalogo lectura categorias"
  on public.categorias for select
  using (true);

-- usuarios / importaciones / movimientos: sin políticas => sólo service_role.

-- Permisos explícitos (por si el proyecto no aplicó los privilegios por defecto).
grant select on public.productos to anon, authenticated;
grant select on public.categorias to anon, authenticated;
grant all privileges on public.usuarios, public.categorias, public.productos,
  public.importaciones, public.movimientos to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------
-- FUNCIONES RPC (las usa el panel con service_role)
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns json language sql as $$
  select json_build_object(
    'total_productos',  (select count(*) from public.productos),
    'activos',          (select count(*) from public.productos where activo),
    'agotados',         (select count(*) from public.productos where stock <= 0),
    'bajo_stock',       (select count(*) from public.productos where stock > 0 and stock <= 5),
    'total_categorias', (select count(*) from public.categorias),
    'valor_inventario', (select coalesce(sum(precio * stock), 0) from public.productos)
  );
$$;

create or replace function public.por_categoria()
returns table (nombre text, total bigint) language sql as $$
  select c.nombre, count(p.id)::bigint
  from public.categorias c
  left join public.productos p on p.categoria_id = c.id
  group by c.id, c.nombre, c.orden
  order by c.orden asc, c.nombre asc;
$$;

create or replace function public.stock_critico(p_limit integer default 8)
returns table (id bigint, nombre text, stock integer, sku text) language sql as $$
  select p.id, p.nombre, p.stock, p.sku
  from public.productos p
  where p.stock <= 5
  order by p.stock asc, p.nombre asc
  limit p_limit;
$$;

create or replace function public.categorias_con_conteo()
returns table (id bigint, nombre text, slug text, activo boolean, orden integer, productos bigint, activos bigint)
language sql as $$
  select c.id, c.nombre, c.slug, c.activo, c.orden,
         (select count(*) from public.productos p where p.categoria_id = c.id)::bigint as productos,
         (select count(*) from public.productos p where p.categoria_id = c.id and p.activo)::bigint as activos
  from public.categorias c
  order by c.orden asc, c.nombre asc;
$$;

create or replace function public.ultimos_movimientos(p_limit integer default 6)
returns table (id bigint, producto_id bigint, producto text, campo text, tipo text, valor text, creado_en timestamptz)
language sql as $$
  select m.id, m.producto_id, p.nombre as producto, m.campo, m.tipo, m.valor, m.creado_en
  from public.movimientos m
  left join public.productos p on p.id = m.producto_id
  order by m.id desc
  limit p_limit;
$$;

create or replace function public.ultimas_importaciones(p_limit integer default 5)
returns table (id bigint, archivo text, total integer, creadas integer, actualizadas integer, errores integer, creado_en timestamptz, email text)
language sql as $$
  select i.id, i.archivo, i.total, i.creadas, i.actualizadas, i.errores, i.creado_en, u.email
  from public.importaciones i
  left join public.usuarios u on u.id = i.usuario_id
  order by i.id desc
  limit p_limit;
$$;

-- Actualización masiva atómica: recibe los productos ya calculados y los movimientos.
create or replace function public.aplicar_masivo(p_updates jsonb, p_movs jsonb, p_uid bigint default 0)
returns integer language plpgsql as $$
declare
  item jsonb;
  n integer := 0;
begin
  for item in select * from jsonb_array_elements(p_updates) loop
    update public.productos set
      precio          = (item->>'precio')::numeric,
      precio_anterior = nullif(item->>'precio_anterior', '')::numeric,
      stock           = (item->>'stock')::integer,
      categoria_id    = nullif(item->>'categoria_id', '')::bigint,
      activo          = (item->>'activo')::boolean,
      destacado       = (item->>'destacado')::boolean
    where id = (item->>'id')::bigint;
    n := n + 1;
  end loop;

  if p_movs is not null and jsonb_array_length(p_movs) > 0 then
    insert into public.movimientos (producto_id, campo, tipo, valor, motivo, usuario_id)
    select (m->>'producto_id')::bigint,
           m->>'campo',
           m->>'tipo',
           m->>'valor',
           m->>'motivo',
           case when (m->>'usuario_id') ~ '^[0-9]+$' then (m->>'usuario_id')::bigint else null end
    from jsonb_array_elements(p_movs) m;
  end if;

  return n;
end $$;

-- Las RPC del panel no deben ser ejecutables por anon/authenticated.
revoke execute on function public.dashboard_stats() from public, anon, authenticated;
revoke execute on function public.por_categoria() from public, anon, authenticated;
revoke execute on function public.stock_critico(integer) from public, anon, authenticated;
revoke execute on function public.categorias_con_conteo() from public, anon, authenticated;
revoke execute on function public.ultimos_movimientos(integer) from public, anon, authenticated;
revoke execute on function public.ultimas_importaciones(integer) from public, anon, authenticated;
revoke execute on function public.aplicar_masivo(jsonb, jsonb, bigint) from public, anon, authenticated;

grant execute on function public.dashboard_stats() to service_role;
grant execute on function public.por_categoria() to service_role;
grant execute on function public.stock_critico(integer) to service_role;
grant execute on function public.categorias_con_conteo() to service_role;
grant execute on function public.ultimos_movimientos(integer) to service_role;
grant execute on function public.ultimas_importaciones(integer) to service_role;
grant execute on function public.aplicar_masivo(jsonb, jsonb, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- Semilla idempotente: usuario admin + categorías y productos de ejemplo.
-- Se puede ejecutar varias veces sin duplicar datos.
-- ---------------------------------------------------------------------------
insert into public.usuarios (nombre, email, password_hash, rol, activo)
select 'Administrador', 'admin@miapp.local',
       '$2y$10$isy/vwe4pmBO8.ajoMORyeUfXeGC82jC9iCRI1xLCadSs4lknw4ha',
       'admin', true
where not exists (select 1 from public.usuarios where email = 'admin@miapp.local');

insert into public.categorias (nombre, slug, activo, orden)
select v.nombre, v.slug, true, v.orden
from (values
  ('Cafés', 'cafes', 0),
  ('Bebidas', 'bebidas', 1),
  ('Comida', 'comida', 2),
  ('Accesorios', 'accesorios', 3)
) as v(nombre, slug, orden)
where not exists (select 1 from public.categorias c where c.slug = v.slug);

insert into public.productos
  (sku, nombre, slug, categoria_id, precio, precio_anterior, stock, descripcion, etiqueta, imagen, destacado, activo)
select v.sku, v.nombre, v.slug, c.id, v.precio, v.precio_anterior, v.stock,
       v.descripcion, v.etiqueta, v.imagen, v.destacado, true
from (values
  ('CG-500', 'Café en grano 500 g', 'cafe-en-grano-500-g', 'Cafés', 8500, 9900, 60,
   'Blend de especialidad tostado medio. Notas a chocolate, avellanas y frutas rojas.', 'Más vendido', 'img/cafe-grano.svg', true),
  ('CM-250', 'Café molido 250 g', 'cafe-molido-250-g', 'Cafés', 5200, null, 45,
   'Molienda media para filtro. Origen Colombia, tueste artesanal.', '', '', false),
  ('CB-1000', 'Cold brew 1 L', 'cold-brew-1-l', 'Bebidas', 4800, null, 24,
   'Café extraído en frío durante 18 horas. Suave, dulce y baja acidez.', 'Nuevo', '', true),
  ('ML-001', 'Matcha latte', 'matcha-latte', 'Bebidas', 4200, null, 30,
   'Matcha ceremonial japonés con leche. Frío o caliente.', '', '', false),
  ('MD-6', 'Medialunas x6', 'medialunas-x6', 'Comida', 3600, null, 40,
   'Medialunas de manteca horneadas cada mañana.', 'Recién horneadas', '', true),
  ('TC-KG', 'Torta de chocolate', 'torta-de-chocolate', 'Comida', 7900, null, 12,
   'Bizcochuelo húmedo de cacao con ganache semiamargo. Para 6 personas.', '', '', false),
  ('TZ-300', 'Taza de cerámica', 'taza-de-ceramica', 'Accesorios', 6500, null, 18,
   'Taza de 300 ml hecha a mano. Apta microondas y lavavajillas.', '', '', false),
  ('TM-500', 'Termo 500 ml', 'termo-500-ml', 'Accesorios', 12900, 14900, 15,
   'Termo de acero inoxidable con doble pared. Mantiene 12 horas.', 'Envío gratis', '', true),
  ('PF-600', 'Prensa francesa', 'prensa-francesa', 'Accesorios', 18500, null, 8,
   'Prensa francesa de vidrio borosilicato de 600 ml con filtro de acero.', '', '', false),
  ('CB-DES', 'Combo desayuno', 'combo-desayuno', 'Comida', 14500, 16400, 10,
   'Café en grano 250 g + 6 medialunas + taza de cerámica.', 'Ahorrás $1.900', '', true)
) as v(sku, nombre, slug, categoria, precio, precio_anterior, stock, descripcion, etiqueta, imagen, destacado)
join public.categorias c on c.nombre = v.categoria
where not exists (select 1 from public.productos p where p.slug = v.slug);

-- ---------------------------------------------------------------------------
-- Configuración de la tienda (datos del vendedor) y banners promocionales.
-- ---------------------------------------------------------------------------
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

-- Fuerza a PostgREST a recargar el esquema (tablas y RPC recién creadas).
notify pgrst, 'reload schema';

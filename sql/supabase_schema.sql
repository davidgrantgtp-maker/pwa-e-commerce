-- =====================================================================
--  MiApp Store · Esquema para Supabase (Postgres)
-- =====================================================================
--  Cómo aplicarlo:
--   1. Entrá al panel de Supabase del proyecto.
--   2. Menú "SQL Editor" -> "New query".
--   3. Pegá TODO este archivo y ejecutá "Run".
--   4. Después abrí install.php en el navegador para crear el usuario
--      admin y los datos de ejemplo (se hace vía API, con password_hash).
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

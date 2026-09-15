-- ============================================================================
-- TORNEO EFOOTBALL — Esquema de la base de datos (Supabase / PostgreSQL)
-- ============================================================================
-- Cómo usarlo: en Supabase, abre "SQL Editor", pega TODO este archivo y dale a Run.
-- Se puede ejecutar más de una vez sin romper nada (usa IF NOT EXISTS).
--
-- IMPORTANTE (seguridad): ahora mismo las políticas dejan leer y escribir a
-- cualquiera que tenga la dirección del proyecto. Eso es TEMPORAL, para poder
-- montar la Fase 2 sin login. En la Fase 4 (login con Google) se cambian por
-- políticas basadas en el usuario y su rol (admin / editor / lector).
-- ============================================================================

-- ---------------------------------------------------------------- TORNEOS ---
-- Cada liga que se crea desde la web. Sus ajustes viven en "config" (JSON).
create table if not exists torneos (
  id         text primary key,
  nombre     text not null,
  estado     text not null default 'en_curso',   -- en_curso | finalizado
  config     jsonb not null default '{}'::jsonb, -- puntos, vueltas, clasificados, tipos de gol...
  creado_en  timestamptz not null default now()
);

-- --------------------------------------------------------------- JUGADORES --
-- Los amigos que participan en cada torneo.
create table if not exists jugadores (
  id         text primary key,
  torneo_id  text not null references torneos(id) on delete cascade,
  nombre     text not null,
  emoji      text,
  color      text
);
create index if not exists jugadores_torneo_idx on jugadores(torneo_id);

-- ---------------------------------------------------------------- PARTIDOS --
-- Un partido de liguilla o de eliminatorias. Las estadísticas finas se
-- añadirán en la Fase 6 (lectura de la captura); de momento no hacen falta.
create table if not exists partidos (
  id               text primary key,
  torneo_id        text not null references torneos(id) on delete cascade,
  fase             text not null default 'liga',  -- liga | semifinal | final | tercer_puesto
  jornada          int,
  local_id         text references jugadores(id) on delete set null,
  visitante_id     text references jugadores(id) on delete set null,
  goles_local      int not null default 0,
  goles_visitante  int not null default 0,
  jugado           boolean not null default false,
  fecha            date
);
create index if not exists partidos_torneo_idx on partidos(torneo_id);

-- ------------------------------------------------------------- FUTBOLISTAS --
-- Catálogo de futbolistas del torneo, para el pichichi (Fase 6).
create table if not exists futbolistas (
  id         text primary key,
  torneo_id  text not null references torneos(id) on delete cascade,
  nombre     text not null
);
create index if not exists futbolistas_torneo_idx on futbolistas(torneo_id);

-- ------------------------------------------------------------------- GOLES --
-- El acta, gol a gol (Fase 6: se rellenará desde la captura de estadísticas).
create table if not exists goles (
  id             text primary key,
  partido_id     text not null references partidos(id) on delete cascade,
  lado           text not null,   -- local | visitante
  futbolista_id  text references futbolistas(id) on delete set null,
  minuto         int,
  tipo_id        text
);
create index if not exists goles_partido_idx on goles(partido_id);

-- --------------------------------------------------------------- PERFILES --
-- Quién puede hacer qué (se usará en la Fase 4, con el login de Google).
create table if not exists perfiles (
  user_id     uuid primary key,   -- el id de la cuenta de Google (auth.users)
  rol         text not null default 'lector',  -- admin | editor | lector
  jugador_id  text references jugadores(id) on delete set null,
  creado_en   timestamptz not null default now()
);

-- ============================================================================
-- PERMISOS (RLS)
-- ============================================================================
alter table torneos      enable row level security;
alter table jugadores    enable row level security;
alter table partidos     enable row level security;
alter table futbolistas  enable row level security;
alter table goles        enable row level security;
alter table perfiles     enable row level security;

-- --- FASE 2 (temporal): lectura y escritura abiertas -------------------------
-- TODO FASE 4: sustituir estas políticas por otras que comprueben el usuario
-- (auth.uid()) y su rol en "perfiles". Sin esto, cualquiera con la dirección
-- del proyecto podría escribir. Es aceptable ahora porque la web no es pública.
do $$
declare t text;
begin
  foreach t in array array['torneos','jugadores','partidos','futbolistas','goles','perfiles']
  loop
    execute format('drop policy if exists "acceso_fase2" on %I', t);
    execute format('create policy "acceso_fase2" on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ============================================================================
-- Comprobación: debe devolver las 6 tablas
-- ============================================================================
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('torneos','jugadores','partidos','futbolistas','goles','perfiles')
order by table_name;

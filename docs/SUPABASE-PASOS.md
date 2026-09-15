# ☁️ Pasos para conectar la nube (Supabase) — Fase 2

Guía para crear el proyecto donde vivirán los datos del torneo. Se hace **una sola
vez**. Son unos 10 minutos, la mayor parte esperando.

---

## Paso 1 · Crear la cuenta

1. Entra en **https://supabase.com** y pulsa **"Start your project"**
2. Regístrate con tu email y una contraseña, **o** con **"Continue with GitHub"**
   (más rápido, sin contraseña nueva)

## Paso 2 · Crear el proyecto

1. Pulsa **"New project"** y elige una organización (si te pide crear una, pon
   cualquier nombre, por ejemplo tu nombre)
2. Rellena:
   - **Name:** `Torneo-Efootball`
   - **Database Password:** pulsa *Generate a password* y **guárdala** en un sitio
     seguro (por ejemplo tu gestor de contraseñas). No la necesitamos para la web,
     pero si se pierde hay que resetearla
   - **Region:** la más cercana, **West EU (Ireland)** o **Central EU (Frankfurt)**
3. Pulsa **"Create new project"** y espera 1-2 minutos a que se prepare

## Paso 3 · Crear las tablas

1. En el menú de la izquierda, entra en **SQL Editor**
2. Pulsa **"New query"**
3. Abre el archivo `docs/supabase-esquema.sql` de este proyecto, **copia todo** y
   pégalo ahí
4. Pulsa **Run** (o `Ctrl + Enter`)
5. Abajo debe aparecer una tabla con **6 filas**: `futbolistas`, `goles`, `jugadores`,
   `partidos`, `perfiles`, `torneos` ✅

## Paso 4 · Copiar las dos llaves

1. Abajo a la izquierda, entra en **Project Settings** (la rueda dentada) → **API**
2. Copia estos dos datos:
   - **Project URL** → algo como `https://abcdefgh.supabase.co`
   - **anon public** → un texto largo que empieza por `eyJ...`

   ⚠️ **NO copies la clave `service_role`**: esa es la de administrador y nunca va en
   la web.

## Paso 5 · Pegarlas en la web

Abre `js/config-nube.js` y rellena:

```js
const NUBE_CONFIG = {
  url: 'https://abcdefgh.supabase.co',
  anonKey: 'eyJ...',   // la clave larga
  ...
};
```

## Paso 6 · Comprobar

1. Recarga la web con **F5**
2. Arriba a la derecha debe salir una pastilla **verde**:
   **"☁️ Datos en la nube: todos veis lo mismo"**
3. Apunta un resultado, recarga, y debe seguir ahí

Si sale un aviso rojo, la clave o la URL están mal copiadas (suele ser un espacio o
un trozo de menos).

---

## Detalles importantes

- **Esas dos llaves son públicas a propósito.** La clave `anon` está diseñada para ir
  en el navegador: quien protege los datos son las políticas de la base de datos
  (RLS). Lo que nunca debe salir de Supabase es la clave `service_role`.
- **Ahora mismo las tablas están abiertas** (lectura y escritura para cualquiera con
  la dirección del proyecto). Es temporal: en la **Fase 4** se cambia por el login con
  Google y permisos por rol (admin / editor / lector).
- **Mientras no esté relleno `config-nube.js`**, la web funciona igual pero guardando
  en el navegador de cada uno (modo local).

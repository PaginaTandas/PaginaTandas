# Configurar Supabase (login + datos en la nube)

Usuario y contraseña ya **no van en config.json**. Quedan guardados en Supabase de forma segura.

## Paso 1 — Crear proyecto

1. [supabase.com](https://supabase.com) → cuenta gratis
2. **New project** → nombre `pagina-tandas`
3. Espera a que termine

## Paso 2 — Desactivar confirmación de correo

**Authentication** → **Providers** → **Email** → desactiva **Confirm email** → Save

## Paso 3 — Crear usuario admin

**Authentication** → **Users** → **Add user** → **Create new user**

| Campo | Valor |
|-------|--------|
| Email | `admin@paginatandas.internal` |
| Password | `Poliglota1956` |
| Auto Confirm User | Sí |

En la app escribes solo **`admin`** como usuario.

## Paso 4 — Tabla y seguridad

**SQL Editor** → pega y ejecuta:

```sql
create table if not exists tandas_data (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table tandas_data enable row level security;

drop policy if exists "leer datos" on tandas_data;
drop policy if exists "guardar datos" on tandas_data;
drop policy if exists "actualizar datos" on tandas_data;

create policy "leer datos" on tandas_data
  for select using (auth.role() = 'authenticated');

create policy "guardar datos" on tandas_data
  for insert with check (auth.role() = 'authenticated');

create policy "actualizar datos" on tandas_data
  for update using (auth.role() = 'authenticated');
```

## Paso 5 — config.json

En Supabase: **Project Settings** → **API Keys**

Copia solo estos dos (la app es en el navegador, **no uses la secret key**):

| Campo en Supabase | Campo en config.json |
|-------------------|----------------------|
| Project URL | `sync.url` |
| **Publishable key** (`sb_publishable_...`) | `sync.key` |

**Nunca** pongas `sb_secret_...` en GitHub. Esa clave es solo para servidores.

```json
{
  "sync": {
    "url": "https://ytpnntnuxplinkmwxubs.supabase.co",
    "key": "sb_publishable_..."
  }
}
```

No necesitas instalar `@supabase/server` ni npm. Esta app usa solo el navegador.

Sube a GitHub:

```bash
git add config.json js/
git commit -m "Login y datos en Supabase"
git push
```

## Entrar a la app

- **Usuario:** `admin`
- **Contraseña:** `Poliglota1956`

Desde cualquier dispositivo ves los mismos datos.

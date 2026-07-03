# Mis Tandas

Aplicación web para controlar tandas (pagos quincenales). Optimizada para teléfono.

## Publicar en GitHub Pages

### 1. Preparar

1. Edita `config.json` con tu usuario y contraseña
2. Crea un repo **privado** en GitHub (ej: `mis-tandas`)
3. En la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Publicar Mis Tandas"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/mis-tandas.git
git push -u origin main
```

### 2. Activar GitHub Pages

1. En GitHub: **Settings → Pages**
2. **Source:** Deploy from branch
3. **Branch:** `main` · carpeta `/ (root)`
4. Guardar

En 1–2 minutos tu sitio estará en:

`https://TU-USUARIO.github.io/mis-tandas/`

### 3. Usar en el teléfono

Abre esa URL en Chrome o Safari. Para acceso rápido: menú del navegador → **Agregar a pantalla de inicio**.

---

## Credenciales por defecto

Edita `config.json` antes de subir:

```json
{
  "usuario": "admin",
  "contrasena": "tanda2026"
}
```

La contraseña es visible en el código. Usa repo **privado**.

## Qué hace la app

- Login con usuario y contraseña
- Varias tandas a la vez
- Marcar pagos: **Pagó** / **Falta**
- Turnos compartidos y montos por persona
- Pestañas **Fechas** y **Personas**
- Descargar **PDF** de cada tanda
- Guardado automático en el navegador (doble copia interna)

## Tus datos

Los registros se guardan en el **navegador del dispositivo**, no en la nube.

| Situación | ¿Se pierden? |
|-----------|----------------|
| Cierras el navegador | No |
| Apagas el teléfono | No |
| Cambias de teléfono | Sí |
| Borras caché del sitio | Sí |

Descarga el **PDF** de cada tanda como comprobante. Los cambios se guardan solos al marcar pagos o editar.

## Hospedaje alternativo (recomendado)

**Cloudflare Pages** — gratis, muy estable, conecta el mismo repo de GitHub.

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create → Pages
2. Conectar repo · sin comando de build · salida `/`
3. URL tipo `https://mis-tandas.pages.dev`

## Probar en tu PC (opcional)

```bash
python -m http.server 8080
```

Abre `http://localhost:8080`

## Estructura

```
index.html
config.json
css/style.css
js/app.js, store.js, validate.js, tanda.js, ui.js, utils.js, pdf.js
data/tandas.json
.nojekyll
```

## Crear una tanda

1. Nombre, total por fecha, fecha de inicio
2. Quién cobra cada día y cuánto aporta
3. Resumen — la suma debe igualar el total

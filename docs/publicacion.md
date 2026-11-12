# Publicación en Cloudflare

GitHub Actions publica automáticamente cuando existen dos secretos en el repositorio. Sin ellos,
CI igual corre las pruebas y simplemente omite la publicación.

## Configuración (una sola vez)

1. En Cloudflare, ve a **My Profile → API Tokens → Create Token** y usa la plantilla
   **Edit Cloudflare Workers**. Agrega también los permisos **Account → Cloudflare Pages → Edit** y
   **Account → D1 → Edit** (el registro de errores, ver [errores.md](errores.md)).
2. Copia tu **Account ID** desde el panel de Workers & Pages.
3. En GitHub, ve a **Settings → Secrets and variables → Actions** del repositorio y crea:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

## Qué se publica

| Evento        | Juego web (Pages)                 | Servidor (Worker + Sala) |
| ------------- | --------------------------------- | ------------------------ |
| Push a `main` | Producción                        | Producción               |
| Pull request  | Vista previa con su propio enlace | No se publica            |

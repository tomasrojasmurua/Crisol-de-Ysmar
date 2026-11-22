# Accesos para seguir desde otra cuenta de Claude

La memoria y los hilos de una cuenta de Claude no pasan a otra. Lo que hace falta mover es esto:

## 1. El repositorio (imprescindible)

El código y toda la documentación están en `github.com/tomasrojasmurua/crisol-de-ysmar`.

- **Si la cuenta nueva usa el mismo GitHub (`tomasrojasmurua`):** en la cuenta nueva de Claude,
  conecta GitHub (claude.ai → Ajustes → Conectores → GitHub, o el aviso "Connect GitHub" de Claude
  Code) e instala la app de Claude en el repositorio cuando lo pida. Con eso basta.
- **Si la cuenta nueva usa otro usuario de GitHub:** en GitHub, en el repositorio, Settings →
  Collaborators → Add people, invita a ese usuario con permiso de escritura y acepta la invitación
  desde ese usuario. Después conéctalo en Claude como arriba.
- En un proyecto de Claude, agrega el repositorio en los ajustes del proyecto (Repositorios).

Los secretos de Cloudflare viven en GitHub (Actions), así que publicar y leer la telemetría
siguen funcionando sin hacer nada más.

## 2. Los archivos del proyecto (recomendado)

Las imágenes originales de ChatGPT, los prompts y los scripts de gráficos no están todos en el
repositorio. Descarga desde la cuenta vieja la carpeta `traspaso` de los archivos del proyecto
(o los archivos que te interesen desde la Biblioteca) y súbelos en la cuenta nueva:

- `traspaso/crisol-traspaso-archivos.zip`: prompts de ChatGPT y ElevenLabs, guía de estilo y
  scripts de gráficos (`graficos/`), y la lista de la prueba con amigos. Es liviano.
- Las imágenes grandes (`graficos/fase1`, `graficos/fase2`, `historia/arte`) solo hacen falta para
  rehacer atlas o nuevas escenas de la Historia. Lo que ya usa el juego está en el repositorio
  (`apps/client/public`). Bájalas cuando las necesites.

## 3. Servicios (no se mueven)

Google Cloud (máquina `crisol-sala`) y Cloudflare (Pages, Workers, D1) siguen en tus cuentas.
Claude no necesita entrar: te da comandos para Cloud Shell. Si alguna vez quieres que la cuenta
nueva tenga su propio acceso a Cloudflare, crea otro token en Cloudflare y reemplaza el secreto
`CLOUDFLARE_API_TOKEN` del repositorio.

## 4. Lo que no se puede traer

Los hilos y documentos (artifacts) de la cuenta vieja, como el documento del guion de la Historia,
quedan allá. El guion ya está copiado en el código (`packages/content/src/story.ts` y
`storyText.ts`), así que no hace falta.

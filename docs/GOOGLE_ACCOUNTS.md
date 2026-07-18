# ─── Google Accounts & Firebase — Configuración ───

## Proyectos por cuenta

| Correo | Proyectos |
|--------|-----------|
| `sandovaldiazalexander@gmail.com` | Rescatto, Todo, FemControl, Hermes |
| `tucanalderelajacion@gmail.com` | YoutubeTeam |

## Firebase CLI — Multi-cuenta

### Token actual (principal)
El token de `sandovaldiazalexander@gmail.com` ya está configurado en `.firebase_tokens.json`.

### Generar token para YoutubeTeam

Para que el agente pueda trabajar en YoutubeTeam sin tu ayuda:

1. Abre una terminal
2. Ejecuta:
   ```bash
   cd /ruta/a/YoutubeTeam
   npx firebase login:ci
   ```
3. Se abrirá el navegador. Inicia sesión con **tucanalderelajacion@gmail.com**
4. Copia el token generado
5. Pégalo en `.firebase_tokens.json`:
   ```json
   { "relajacion": "EL_TOKEN_COPIADO" }
   ```

### Cambiar entre cuentas

```bash
source scripts/use-project.sh rescatto    → sandovaldiazalexander@gmail.com
source scripts/use-project.sh youtubeteam → tucanalderelajacion@gmail.com
```

## Google Search Console API

Para que el agente pueda gestionar Search Console sin la web:

1. Ve a https://console.cloud.google.com/apis/credentials
2. Crea un proyecto (ej: "Rescatto-SEO")
3. Habilita **Google Search Console API**
4. Crea una **OAuth Client ID** (Desktop app)
5. Descarga las credenciales como `credentials.json`
6. Colócalas en la raíz del proyecto (`credentials.json` — ya está en .gitignore)

## Recordatorio

Los tokens están en `.firebase_tokens.json` (excluido de git).
Git commits usan `alexandersandoval2011@hotmail.com` (config global).

#!/usr/bin/env bash
# ─── use-project.sh — Cambia entre cuentas de Firebase según el proyecto ───
# 
# Uso:
#   source scripts/use-project.sh [nombre-proyecto]
#
# Proyectos:
#   rescatto    → sandovaldiazalexander@gmail.com (default)
#   todo        → sandovaldiazalexander@gmail.com
#   femcontrol  → sandovaldiazalexander@gmail.com
#   youtubeteam → tucanalderelajacion@gmail.com
#
# Configura FIREBASE_TOKEN, git user, y .firebaserc automáticamente.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Tokens: buscar primero en home (global), luego local
GLOBAL_TOKEN_FILE="$HOME/.firebase_tokens.json"
LOCAL_TOKEN_FILE="$PROJECT_DIR/.firebase_tokens.json"
TOKEN_FILE="$GLOBAL_TOKEN_FILE"
if [ ! -f "$TOKEN_FILE" ] && [ -f "$LOCAL_TOKEN_FILE" ]; then
  TOKEN_FILE="$LOCAL_TOKEN_FILE"
fi

# ─── Tokens ──────────────────────────────────────────────────────────────────
# TOKEN_MAIN → sandovaldiazalexander@gmail.com
# TOKEN_RELAJACION → tucanalderelajacion@gmail.com
# Se cargan desde .firebase_tokens.json (nunca en git)

if [ ! -f "$TOKEN_FILE" ]; then
  echo "❌ $TOKEN_FILE no encontrado."
  echo "Copia .firebase_tokens.example.json y completa los tokens."
  return 1
fi

TOKEN_MAIN=$(python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['main'])" 2>/dev/null || echo "")
TOKEN_RELAJACION=$(python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['relajacion'])" 2>/dev/null || echo "")

case "${1:-}" in
  youtubeteam|yt)
    export FIREBASE_TOKEN="$TOKEN_RELAJACION"
    export GIT_AUTHOR_NAME="Alexander Sandoval"
    export GIT_AUTHOR_EMAIL="tucanalderelajacion@gmail.com"
    export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
    export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
    echo "✅ Proyecto: youtubeteam → tucanalderelajacion@gmail.com"
    ;;
  rescatto|todo|femcontrol|"")
    export FIREBASE_TOKEN="$TOKEN_MAIN"
    export GIT_AUTHOR_NAME="Alexander Sandoval"
    export GIT_AUTHOR_EMAIL="sandovaldiazalexander@gmail.com"
    export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
    export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
    echo "✅ Proyecto: ${1:-default} → sandovaldiazalexander@gmail.com"
    ;;
  *)
    echo "❌ Proyecto desconocido: $1"
    echo "Usa: rescatto, todo, femcontrol, youtubeteam"
    return 1
    ;;
esac

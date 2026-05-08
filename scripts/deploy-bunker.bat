@echo off
SETLOCAL EnableDelayedExpansion

:: --- CONFIGURACIÓN ---
SET PROJECT_ID=rescatto-c8d2b
SET TOKEN=YOUR_FIREBASE_TOKEN_HERE


echo [RESCATTO] Iniciando despliegue del Bunker de Seguridad...
echo [RESCATTO] Proyecto: %PROJECT_ID%

:: 1. Validar Linting en Functions
echo [1/3] Verificando calidad de codigo (lint)...
cd functions
call npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] El linting ha fallado. Corrige los errores antes de desplegar.
    exit /b 1
)
cd ..

:: 2. Despliegue de Reglas de Seguridad (Firestore)
echo [2/3] Desplegando reglas de Firestore...
call npx firebase deploy --only firestore:rules --project %PROJECT_ID% --token %TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Fallo el despliegue de reglas. Continuando con funciones...
)

:: 3. Despliegue de Cloud Functions
echo [3/3] Desplegando Cloud Functions...
call npx firebase deploy --only functions --project %PROJECT_ID% --token %TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] El despliegue de funciones ha fallado.
    exit /b 1
)

echo [EXITO] Despliegue del Bunker completado correctamente.
pause

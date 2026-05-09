@echo off
SETLOCAL EnableDelayedExpansion

:: --- CONFIGURACIÓN ---
SET PROJECT_ID=rescatto-c8d2b

:: Si no existe la variable de entorno FIREBASE_TOKEN, puedes definirla aqui temporalmente
:: pero NO la subas al repositorio.
if "%FIREBASE_TOKEN%"=="" (
    SET TOKEN=YOUR_FIREBASE_TOKEN_HERE
) else (
    SET TOKEN=%FIREBASE_TOKEN%
)

echo [RESCATTO] Iniciando despliegue completo (Frontend + Bunker)...
echo [RESCATTO] Proyecto: %PROJECT_ID%

:: 1. Compilar la Aplicación (Frontend)
echo [1/5] Compilando la aplicacion (build)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] La compilacion ha fallado. Revisa los errores en la consola.
    exit /b 1
)

:: 2. Validar Linting en Functions
echo [2/5] Verificando calidad de codigo en funciones (lint)...
cd functions
call npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] El linting de funciones ha fallado. Corrige los errores antes de desplegar.
    exit /b 1
)
cd ..

:: 3. Despliegue de Reglas de Seguridad (Firestore)
echo [3/5] Desplegando reglas de Firestore...
call npx firebase deploy --only firestore:rules --project %PROJECT_ID% --token %TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Fallo el despliegue de reglas. Continuando...
)

:: 4. Despliegue de Cloud Functions
echo [4/5] Desplegando Cloud Functions...
call npx firebase deploy --only functions --project %PROJECT_ID% --token %TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] El despliegue de funciones ha fallado.
    exit /b 1
)

:: 5. Despliegue de Hosting (Frontend)
echo [5/5] Desplegando Hosting...
call npx firebase deploy --only hosting --project %PROJECT_ID% --token %TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] El despliegue del hosting ha fallado.
    exit /b 1
)

echo [EXITO] Despliegue completo finalizado correctamente.
pause


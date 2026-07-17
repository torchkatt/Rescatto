@echo off
SETLOCAL EnableDelayedExpansion

:: ─── Deploy Script Multi-Entorno ───
:: Uso: deploy.bat [staging|prod]
:: Ejemplo: deploy.bat staging  → deploys a rescatto-staging
::          deploy.bat prod      → deploys a rescatto-c8d2b (producción)

:: ─── Configuración por entorno ───
if /I "%1"=="staging" (
    SET PROJECT_ID=rescatto-staging
    SET ENV_NAME=Staging
    SET CONFIRM_MSG=¿Desplegar en STAGING?
) else if /I "%1"=="prod" (
    SET PROJECT_ID=rescatto-c8d2b
    SET ENV_NAME=Produccion
    SET CONFIRM_MSG=⚠️  ¿Desplegar en PRODUCCION? ⚠️
) else (
    echo Uso: deploy.bat [staging^|prod]
    echo   staging  → Proyecto de pruebas
    echo   prod     → Proyecto de produccion
    exit /b 1
)

:: ─── Verificar FIREBASE_TOKEN ───
if "%FIREBASE_TOKEN%"=="" (
    echo [ERROR] Variable FIREBASE_TOKEN no definida.
    echo Crea un token en: Firebase Console ^> Project Settings ^> Service Accounts ^> Generate new private key
    echo Luego: set FIREBASE_TOKEN=^<tu_token^>
    exit /b 1
)

:: ─── Confirmación ───
echo ═══════════════════════════════════════
echo   RESCATTO - Despliegue a %ENV_NAME%
echo   Proyecto: %PROJECT_ID%
echo   %CONFIRM_MSG%
echo ═══════════════════════════════════════
echo.
if /I "%1"=="prod" (
    echo Presiona Ctrl+C para cancelar, o cualquier tecla para continuar...
    pause >nul
)

:: ─── 1. Build ───
echo [1/5] Compilando aplicacion...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build fallo.
    exit /b 1
)

:: ─── 2. Deploy Firestore Rules ───
echo [2/5] Desplegando reglas Firestore...
call npx firebase deploy --only firestore:rules --project %PROJECT_ID% --token %FIREBASE_TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Reglas fallaron, continuando...
)

:: ─── 3. Deploy Firestore Indexes ───
echo [3/5] Desplegando indices Firestore...
call npx firebase deploy --only firestore:indexes --project %PROJECT_ID% --token %FIREBASE_TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Indices fallaron, continuando...
)

:: ─── 4. Deploy Functions ───
echo [4/5] Desplegando Cloud Functions...
cd functions
call npm install --production >nul 2>&1
cd ..
call npx firebase deploy --only functions --project %PROJECT_ID% --token %FIREBASE_TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Functions fallaron.
    exit /b 1
)

:: ─── 5. Deploy Hosting ───
echo [5/5] Desplegando Hosting...
call npx firebase deploy --only hosting --project %PROJECT_ID% --token %FIREBASE_TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Hosting fallo.
    exit /b 1
)

echo.
echo ✅ [EXITO] Despliegue a %ENV_NAME% completado.
echo    URL: https://%PROJECT_ID%.web.app

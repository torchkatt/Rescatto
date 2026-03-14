# Estrategia de Implementación: Rescatto Móvil con Capacitor

Este documento detalla los pasos para convertir la PWA actual de **Rescatto** en una aplicación nativa para iOS y Android utilizando Capacitor, manteniendo una única base de código y maximizando la velocidad de desarrollo.

---

## 1. Instalación Inicial

Ejecutar en la raíz del proyecto para instalar el núcleo de Capacitor y las plataformas:

```bash
# Instalar dependencias
npm install @capacitor/core @capacitor/cli

# Inicializar configuración
npx cap init Rescatto com.rescatto.app --web-dir dist

# Agregar plataformas nativas
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

---

## 2. Configuración para Vite (Importante)

Dado que Rescatto usa Vite, asegúrate de que el archivo `capacitor.config.ts` tenga la siguiente línea:

```typescript
webDir: 'dist' // Debe coincidir con la carpeta de salida de 'npm run build'
```

---

## 3. Workflow de Desarrollo (Día a Día)

### Opción A: Desarrollo con Live Reload (Recomendado)
Para ver los cambios reflejados en el celular al instante mientras programas:

1. Inicia el servidor de Vite: `npm run dev` (anota la IP, ej: `http://192.168.1.50:5173`).
2. Configura Capacitor para apuntar a esa IP en `capacitor.config.ts`:
   ```typescript
   server: {
     url: 'http://192.168.1.50:5173',
     cleartext: true
   }
   ```
3. Ejecuta: `npx cap copy ios` (o android).
4. Abre el proyecto nativo: `npx cap open ios`.

### Opción B: Sincronización Manual
Cuando quieras probar el rendimiento real o una versión estable:

```bash
npm run build     # Genera la carpeta /dist
npx cap sync      # Sincroniza el build con iOS y Android
npx cap open ios  # Abre Xcode para compilar
```

---

## 4. Consideraciones para el Código Actual

Rescatto ya tiene una arquitectura robusta, pero considera estos puntos:

- **Safe Areas:** Al ser app nativa, debes evitar que el contenido pise la "ceja" (notch) o la barra de gestos inferior.
  - *Tip:* Usa variables CSS de entorno: `padding-top: env(safe-area-inset-top);`
- **Firebase:** El SDK de Firebase que ya usas funcionará sin problemas. Si deseas usar notificaciones push avanzadas o Google Auth nativo, se recomienda instalar los plugins de `@capacitor-community`.
- **Navegación:** Como usas `react-router-dom`, asegúrate de manejar el botón "Atrás" físico en Android mediante el plugin `@capacitor/app`.

---

## 5. Próximos Pasos (Checklist)

1. [ ] Definir el Bundle ID final (ej: `com.rescatto.app`).
2. [ ] Diseñar el icono de la app (1024x1024) y la Splash Screen.
3. [ ] Instalar [Capacitor Assets](https://github.com/ionic-team/capacitor-assets) para generar automáticamente todos los tamaños de iconos.
4. [ ] Probar el flujo de **Wompi** en el navegador del dispositivo móvil nativo.

---

> [!TIP]
> **Actualizaciones sin revisión:** Considera implementar **Capgo** o **Ionic Appflow** en el futuro para enviar parches de errores a los usuarios sin tener que esperar la aprobación de la App Store.

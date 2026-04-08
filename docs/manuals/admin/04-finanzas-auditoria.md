# Finanzas, logs y configuración

## Finanzas globales (SUPER_ADMIN)

En el backoffice → **"Finanzas"**.

### Métricas disponibles

- **Ingresos totales** del período seleccionado
- **Ingresos por negocio:** los negocios con más ventas (top venues)
- **Pedidos completados vs. cancelados**
- **Comisiones cobradas** por Rescatto

### Filtros de período

Puedes ver estadísticas de:
- Hoy
- Esta semana
- Este mes
- Este año

Selecciona el período en el selector de la pantalla de finanzas.

---

## Logs de auditoría (SUPER_ADMIN)

En el backoffice → **"Logs de auditoría"**.

El log registra todas las acciones críticas de la plataforma: creación y eliminación de usuarios, cambios de rol, cancelaciones de pedidos, modificaciones de precios, accesos administrativos y más.

### Filtros del log

- Por tipo de acción
- Por usuario que la realizó
- Por rango de fechas

### Exportar el log

1. Aplica los filtros deseados.
2. Toca **"Exportar CSV"**.
3. El archivo descargado tiene los datos anonimizados: las direcciones IP están enmascaradas y los nombres se reemplazan por iniciales. No incluye información de payloads sensibles.

> El total de entradas del log se muestra con el conteo exacto de la base de datos (no está limitado a 200 como en versiones anteriores).

---

## Configuración de plataforma (SUPER_ADMIN)

En el backoffice → **"Config. Plataforma"**.

Desde aquí puedes configurar los parámetros globales de Rescatto:
- Nombre de la plataforma
- Valores de comisión por defecto
- Mensajes del sistema
- Funcionalidades activadas o desactivadas (feature flags)

Los cambios se guardan en Firestore (`settings/platform`) y se aplican de forma inmediata. Usa el botón **"Restaurar valores por defecto"** si necesitas revertir a la configuración original.

---

## Ventas globales y domicilios (SUPER_ADMIN)

- **Ventas globales** (`/admin/sales`): resumen de todas las transacciones de la plataforma.
- **Domicilios** (`/admin/deliveries`): estado de todas las entregas activas y completadas.

---

## Preguntas frecuentes — Administrador

**¿Cómo le asigno un negocio a un dueño que ya se registró?**

Ve a la sección de usuarios, busca al usuario, abre su perfil y en el campo "Negocio" asigna el negocio correspondiente. Asegúrate también de que su rol sea VENUE_OWNER.

**¿Por qué el log de auditoría muestra entradas que yo no hice?**

El log registra todas las acciones automáticas del sistema también, como la ejecución de Cloud Functions programadas. Estas acciones aparecen asociadas al sistema, no a un usuario humano.

**¿Cómo migro usuarios que tienen el campo venueId antiguo al nuevo venueIds?**

Existe una Cloud Function callable llamada `migrateVenueIdToVenueIds`. Solo un SUPER_ADMIN puede ejecutarla. Llámala una sola vez; es idempotente (puedes llamarla varias veces sin efectos duplicados).

**¿Cuándo se actualizan las métricas de finanzas?**

Las métricas de finanzas se generan en tiempo real a través de la Cloud Function `getFinanceStats`. Cada vez que abres la pantalla de finanzas, la función consulta los datos actualizados.

**¿Cómo restablezco la contraseña de un usuario?**

Rescatto no permite que los admins cambien la contraseña de otros usuarios directamente. El usuario debe usar la función "Olvidé mi contraseña" desde la pantalla de login.

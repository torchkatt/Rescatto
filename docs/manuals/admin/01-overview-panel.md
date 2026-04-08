# El panel de administración

## Acceso

Como administrador, al iniciar sesión eres redirigido automáticamente al **Backoffice** (`/backoffice/dashboard`). Este es el panel central de gestión de toda la plataforma.

---

## Overview — Vista general

La pantalla de inicio del backoffice muestra el estado actual de la plataforma:

- **Métricas clave:** pedidos del día, ingresos, rescates completados, negocios activos.
- **Gráfica de ingresos:** área chart con los ingresos de los últimos 7 días.
- **Alertas activas:** pedidos con problemas, stock en cero, errores recientes.

---

## Navegación del backoffice

El menú lateral del backoffice incluye:

| Sección | Rol mínimo | Descripción |
|---|---|---|
| **Dashboard** | ADMIN | Overview global |
| **Usuarios** | ADMIN | Gestionar cuentas y roles |
| **Negocios** | ADMIN | Registrar y configurar venues |
| **Domiciliarios** | ADMIN | Gestionar drivers |
| **Soporte** | ADMIN | Tickets y consultas |
| **Finanzas** | SUPER_ADMIN | Ingresos globales y por negocio |
| **Comisiones** | SUPER_ADMIN | Configurar porcentajes |
| **Suscripciones** | SUPER_ADMIN | Gestionar planes |
| **Datos bancarios** | SUPER_ADMIN | Configurar cuentas de pago |
| **Logs de auditoría** | SUPER_ADMIN | Registro de acciones críticas |
| **Config. plataforma** | SUPER_ADMIN | Parámetros globales |

---

## Diferencia entre ADMIN y SUPER_ADMIN

- **ADMIN:** puede gestionar usuarios, negocios y domiciliarios. Ideal para operadores del día a día.
- **SUPER_ADMIN:** acceso completo incluyendo configuración financiera, auditoría y parámetros técnicos. Solo para los fundadores o el equipo técnico de Rescatto.

---

## Panel paralelo — Vista admin legacy

Además del backoffice moderno, existe el panel legacy en `/admin`. Este acceso está reservado únicamente para SUPER_ADMIN y contiene funcionalidades que aún no se han migrado al backoffice nuevo. Se irá deprecando gradualmente.

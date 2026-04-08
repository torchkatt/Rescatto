# Gestión de usuarios

## Acceder a la lista de usuarios

En el backoffice → **"Usuarios"**.

Verás la lista de todos los usuarios registrados con su nombre, correo, rol y estado.

---

## Buscar un usuario

Usa la barra de búsqueda para encontrar a un usuario por nombre, correo o rol. El filtro es en tiempo real.

---

## Ver el perfil de un usuario

Toca cualquier usuario para ver su información completa:
- Datos personales
- Rol actual
- Historial de pedidos (si es cliente)
- Negocio asignado (si es dueño o personal de cocina)

---

## Cambiar el rol de un usuario

1. Abre el perfil del usuario.
2. Toca **"Editar rol"**.
3. Selecciona el nuevo rol del menú desplegable.
4. Confirma el cambio.

> **Precaución:** cambiar el rol de un usuario afecta inmediatamente lo que puede ver y hacer en la app. Un usuario que era CUSTOMER y se convierte en VENUE_OWNER, por ejemplo, ya no verá la app de cliente.

### Roles disponibles

| Rol | Nivel de acceso |
|---|---|
| CUSTOMER | App de cliente |
| DRIVER | Panel de domiciliario |
| KITCHEN_STAFF | KDS del negocio asignado |
| VENUE_OWNER | Panel completo del negocio |
| ADMIN | Backoffice (sin configuración técnica) |
| SUPER_ADMIN | Acceso total |

---

## Asignar un usuario a un negocio

Para que un usuario con rol VENUE_OWNER o KITCHEN_STAFF pueda gestionar un negocio, debes asignarlo a ese negocio:

1. Abre el perfil del usuario.
2. En el campo "Negocio", busca y selecciona el negocio correspondiente.
3. Guarda los cambios.

---

## Suspender o banear un usuario

Si un usuario viola las políticas de la plataforma:
1. Abre su perfil.
2. Toca **"Cambiar estado"**.
3. Selecciona "Suspendido" (temporal) o "Baneado" (permanente).
4. El usuario no podrá iniciar sesión hasta que su estado cambie.

---

## Eliminar un usuario

La eliminación de cuentas es irreversible y elimina todos los datos asociados (pedidos, puntos, historial). Solo hazlo si el usuario lo solicitó explícitamente o por obligación legal.

1. Abre el perfil.
2. Toca **"Eliminar cuenta"**.
3. Confirma la acción en el diálogo de confirmación.

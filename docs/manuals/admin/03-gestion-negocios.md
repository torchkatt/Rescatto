# Gestión de negocios

## Ver la lista de negocios

En el backoffice → **"Negocios"**.

Verás todos los negocios registrados en la plataforma con su nombre, ciudad, estado y tipo.

---

## Registrar un negocio nuevo

1. Toca **"+ Nuevo negocio"**.
2. Completa el formulario:

| Campo | Descripción |
|---|---|
| **Nombre** | Nombre del establecimiento |
| **Tipo** | Restaurante, Panadería, Hotel, Supermercado, Cafetería u Otro |
| **Descripción** | Breve descripción del negocio |
| **Dirección** | Dirección física del negocio |
| **Ciudad** | Ciudad donde está ubicado |
| **Latitud / Longitud** | Coordenadas GPS (usa el botón "Geocodificar" para generarlas) |
| **Logo** | Imagen del negocio |
| **Teléfono** | Número de contacto del negocio |
| **Correo de contacto** | Correo del encargado |

3. Toca **"Crear negocio"**.

### Geocodificación automática

Si no tienes las coordenadas GPS del negocio, ingresa la dirección y toca **"Geocodificar"**. El sistema consulta Nominatim (OpenStreetMap) y completa las coordenadas automáticamente. Verifica que el resultado sea correcto antes de guardar.

---

## Editar un negocio existente

1. En la lista de negocios, toca el negocio que quieres modificar.
2. Toca el ícono de edición.
3. Actualiza los campos necesarios.
4. Guarda los cambios.

---

## Estado del negocio

Un negocio puede estar:
- **Activo:** visible para los clientes en la app.
- **Inactivo:** no aparece en los resultados de búsqueda.
- **Suspendido:** bloqueado por incumplimiento de políticas.

---

## Inventario global

En el backoffice → **"Inventario"** (dentro del panel legacy `/admin`), puedes ver:
- Todos los productos de todos los negocios.
- Alertas de stock bajo (3 unidades o menos).
- Paginación de 20 productos por página con botón "Cargar más".

Esto es útil para tener una visión consolidada del estado del inventario en la plataforma.

---

## Categorías

En el backoffice → **"Categorías"**, puedes crear y gestionar las categorías que los negocios usan para clasificar sus productos y que los clientes usan para filtrar su búsqueda.

# Rescatto — Home Cliente (Desktop) Checklist (xl/2xl)

**Wireframe:** `public/mockups/customer-home-desktop-wireframe.svg`

## Breakpoints objetivo
- `xl` (≥ 1280px): layout “real desktop”
- `2xl` (≥ 1536px): más aire, misma estructura

## Layout (medidas recomendadas)
- Wrapper: `max-w-7xl mx-auto px-6`
- Separación entre secciones: `space-y-10` (≈ 40px) o `mb-12`
- Grid hero: `grid grid-cols-12 gap-8`
  - Izquierda: `col-span-8`
  - Derecha: `col-span-4`

## Topbar (sticky)
- Contenedor: `sticky top-0 z-40 bg-white/80 backdrop-blur border-b`
- Contenido:
  - Selector ciudad (izq)
  - Search centrado (ancho fijo en desktop, ej. `w-[640px] max-w-full`)
  - Acciones (der): notificaciones, favoritos, perfil
- Nota: el saludo pasa a secundario (no debe empujar contenido clave hacia abajo).

## Sección “Activos ahora” (prioridad #1)
- Mostrar solo venues: **abierto ahora + con stock**
- En desktop usar **cards grandes** (evitar “mobile cards” pequeñas):
  - ancho: `w-[320px]`–`w-[360px]` si carrusel, o grid 3 columnas
  - KPIs visibles:
    - `Abierto • HH:mm`
    - `X productos` (productCount)
    - `distancia` (si hay ubicación)
- CTA dentro de la card:
  - Primaria: “Ver productos”
  - Secundaria: “Ver negocio”

## Panel derecho (col-span-4)
- Bloque “Impacto” compacto (1 card)
- Bloque “Última llamada” (lista 3–5 items)
- Regla: este panel debe **sumar urgencia** sin competir con “Activos ahora”.

## Productos disponibles (desktop grid)
- Reemplazar carrusel infinito por **grid**:
  - `xl:grid-cols-4` (o `3` si el contenido es muy ancho)
  - Mantener “Destacados/Flash” como carrusel opcional (máximo 6)
- Toolbar:
  - “Orden: Cerca / Descuento / Vence pronto / Tipo”
  - Botón “Ver todos / Explorar” → `/app/explore`

## Negocios cerca
- Evitar banner gigante; preferir:
  - Grid `xl:grid-cols-3` con `VenueCard`, o
  - Split lista+mapa (opcional)

## Estados & detalles “pro”
- Skeleton por sección (no loader global)
- Empty state:
  - “No hay activos ahora” + sugerir quitar filtros / cambiar zona
- Accesibilidad:
  - targets ≥ 44px
  - foco visible en search y chips
- Consistencia:
  - COP (formateo)
  - tiempos: “vence en Xh Ym” o “hasta HH:mm”

## Navegación recomendada
- CTA “Ver todos / Explorar” → `/app/explore` con query params:
  - `sort=distance|discount|endingSoon|recommended`
  - `type=SURPRISE_PACK|SPECIFIC_DISH`
  - `maxKm`, `minDiscount`, `expiresInHours`


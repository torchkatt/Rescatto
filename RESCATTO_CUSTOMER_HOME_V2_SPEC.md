# Rescatto — Especificación para Home Cliente (v2) + Explore (“Ver más productos”)

Esta especificación está diseñada para que un **agente operador** implemente la nueva experiencia de inicio del cliente sin ambigüedades.

**Wireframe (imagen):** `public/mockups/customer-home-explore-wireframe.svg`

---

## 1) Objetivo del producto

En la página principal del cliente (`/app`) se debe:

1. Mostrar **negocios activos** (definición abajo) con:
   - Estado **abierto** + **hora de cierre** (visible)
   - **Productos disponibles** (contador de productos activos; opcional: unidades totales)
2. Mostrar **productos disponibles** (activos) en secciones/filas de descubrimiento.
3. Permitir **ver más productos** que cumplan simultáneamente con varias características:
   - **Distancia**
   - **Descuento**
   - **Vence pronto**
   - **Tipo** (Pack sorpresa vs Plato específico)

---

## 2) Definiciones (reglas de negocio)

### 2.1 Producto disponible (Producto Activo)
Un producto es **disponible** si:
- `quantity > 0`
- `availableUntil > now`

Implementación recomendada: usar `isProductAvailable(product)` ya existente (`utils/productAvailability.ts`).

### 2.2 Negocio activo (Venue Activo)
Un negocio es **activo** si cumple:
- **Abierto ahora** (ver regla 2.3)
- Tiene **≥ 1 producto activo** (derivado de `venueProductCountMap.get(venueId) > 0` o `venueStockMap.has(venueId)`).

### 2.3 Abierto ahora (heurística actual)
Hoy el modelo solo tiene `closingTime` (HH:mm). Para v2:
- Mantener la heurística actual (similar a `VenueCard.isOpen()`), pero **documentar limitación** (no soporta horarios complejos).
- **Mejora recomendada** (si el operador la puede implementar rápido): manejar cierres “post-medianoche” con heurística:
  - Si `closingTime` < 06:00 y `now` ≥ 18:00 → considerar cierre al día siguiente.

> Nota: la solución real (futura) es modelar `operatingHours` por día; fuera de alcance v2.

---

## 3) UX / IA de la Home (prioridad de contenido)

### 3.1 Orden de secciones (Home)
1. Header sticky: ubicación + notificaciones
2. Saludo + subtítulo
3. Search bar
4. Chips de categorías (opcional, no bloqueante)
5. **Sección “Activos ahora”** (la más importante)
6. **Sección “Productos disponibles”** (filas de descubrimiento)
7. Grid “Todos los lugares” (opcional, más abajo)

### 3.2 Sección “Activos ahora”
Formato recomendado: carrusel horizontal o grid compacto.

Cada card debe mostrar:
- Nombre
- Badge **“Abierto hasta HH:mm”**
- Badge/label **“X productos disponibles”** (mínimo)
- Distancia (si hay ubicación)

Interacción:
- Tap → `VenueDetail` (`/app/venue/:id`)
- CTA “Ver todo” (opcional) → lleva a lista filtrada de venues activos (puede ser el mismo grid con filtro activo).

### 3.3 Sección “Productos disponibles” (filas)
Crear 4 filas (o 3 si se quiere simplificar), todas con CTA **“Ver más”**:

1) **Cerca de ti**  
- Fuente: productos activos + distancia al venue  
- Orden: distancia asc  
- CTA “Ver más” → Explore con `sort=distance`

2) **Más descuento**  
- Fuente: productos activos  
- Orden: `discountPct desc`  
- CTA “Ver más” → Explore con `sort=discount`

3) **Vence pronto**  
- Fuente: productos activos  
- Orden: `availableUntil asc`  
- CTA “Ver más” → Explore con `sort=endingSoon` y `expiresInHours=2|4` (definir default)

4) **Tipo (Packs / Platos)**  
- UX sugerida: un toggle arriba (Pack/Plato) y la fila se ajusta  
- CTA “Ver más” → Explore con `type=SURPRISE_PACK|SPECIFIC_DISH`

---

## 4) Pantalla Explore (“Ver más productos”)

### 4.1 Ruta
Agregar una ruta nueva (sugerencia):
- `GET /app/explore`

### 4.2 Filtros combinables (los 4 pedidos)
**Filtros UI:**
- Distancia: slider (ej. 0.5–10 km) o chips (1, 2.5, 5, 10 km)
- Descuento mínimo: slider (0–80%)
- Vence pronto: chips (≤ 1h, ≤ 2h, ≤ 4h, hoy)
- Tipo: chips (Pack, Plato, Ambos)

**Regla importante:**
- Por defecto, mostrar productos **activos** y de **venues activos** (abierto + stock) para mantener coherencia con “Activos ahora”.

### 4.3 Ordenamientos
Soportar (mínimo):
- Recomendado (score)
- Distancia
- Descuento
- Vence pronto

**Score recomendado (simple y explícito):**
Normalizar en 0–1:
- `distanceScore = 1 - clamp(distanceKm / maxKm)`
- `discountScore = clamp(discountPct / 80)`
- `expiryScore = 1 - clamp(hoursLeft / 6)` (más cerca a 0h = mejor)

Peso (ajustable):
- `score = 0.45*discountScore + 0.35*expiryScore + 0.20*distanceScore`

### 4.4 Estados vacíos
Si no hay resultados:
- Mostrar mensaje + botón “Limpiar filtros”.

Si no hay permisos de ubicación:
- Distancia se oculta o se deshabilita + banner “Activa ubicación para ordenar por cercanía”.

---

## 5) Estrategia de datos (mínimo viable v2)

### 5.1 Fuentes existentes (reusar)
Ya existen:
- `venueService.getAllVenues(city?)`
- `venueService.getStockCountByVenue()` → `stockMap`, `productCountMap`
- `productService.getAllActiveProducts(city?)`
- `calculateDistance()`
- `isProductAvailable()`

### 5.2 Join Producto ↔ Venue (necesario para distancia y “venue abierto”)
En Home y Explore:
- Construir `venuesById: Map<string, Venue>` una sola vez.
- Para cada producto: obtener su venue con `venuesById.get(product.venueId)`.

### 5.3 Performance (alertas para el operador)
`getAllActiveProducts(city)` puede crecer mucho. Para v2, opciones:

**Opción A (rápida):** mantener, pero agregar:
- límite de pool (p. ej. 200–400) + “ver más” carga incremental en UI

**Opción B (mejor, requiere índices):** query por `availableUntil > now` + `limit` (y filtrar stock en cliente).

> En cualquier caso: cachear en memoria / React Query para evitar múltiples lecturas.

---

## 6) Cambios UI por archivo (guía para el operador)

### 6.1 `pages/customer/Home.tsx`
Implementar:
- `activeVenuesNow = venues.filter(openNow && productCount>0)` ordenado por distancia si hay ubicación.
- Render nuevo bloque “Activos ahora”.
- Asegurar que `VenueCard` reciba:
  - `totalStock={venueStockMap.get(id)}`
  - `productCount={venueProductCountMap.get(id)}`
  - `soonestExpiry={venueExpiryMap.get(id)}`
  - `hasDynamicPricing={dynamicVenueIds.has(id)}`
- Discovery rows: conectar los CTAs “Ver más” para navegar a `/app/explore` con query params.

### 6.2 Nueva página `pages/customer/Explore.tsx` (o similar)
Implementar:
- Leer query params para preaplicar filtros y sort.
- Cargar pool: `venues + activeProducts`.
- Filtrar por:
  - producto activo
  - venue activo (abierto + stock)
  - distancia / descuento / vence pronto / tipo
- Ordenar por el sort actual.
- Render grid / lista con skeleton y empty states.

### 6.3 `App.tsx`
Agregar route:
- `/app/explore` → `Explore`

### 6.4 Componentes sugeridos (si el operador quiere modularizar)
- `components/customer/home/ActiveVenuesRow.tsx`
- `components/customer/explore/FiltersBar.tsx`
- `components/customer/explore/ProductGrid.tsx`

---

## 7) Criterios de aceptación (Definition of Done)

1. Home muestra una sección “Activos ahora” y cada card muestra:
   - “Abierto hasta HH:mm”
   - “X productos disponibles”
2. “Activos ahora” solo incluye venues **abiertos** y **con stock** (producto activo).
3. Home muestra productos disponibles (al menos 3 filas) y cada fila tiene CTA “Ver más”.
4. Explore permite combinar filtros (distancia + descuento + vence pronto + tipo) y ordena correctamente.
5. Explore soporta estado sin ubicación (distancia deshabilitada/oculta sin romper UX).
6. No se introducen N+1 queries por venue; el join se hace con mapa local.

---

## 8) Fuera de alcance (para no desviarse)
- Horarios completos por día (`operatingHours`) y “abre a las…”
- Búsqueda full-text real (Algolia/Meilisearch)
- Geoqueries con geohash / indexes geoespaciales
- Recomendador ML / preferencias persistentes


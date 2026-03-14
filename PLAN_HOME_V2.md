# Plan de Acción — Home Cliente v2 (DEFINITIVO)

> **Para el agente operario:** Lee TODO antes de escribir código. Cada paso indica archivo, línea, y código exacto.
> **Fecha:** 2026-03-13

---

## Estado actual (qué YA está hecho)

Estos cambios ya están aplicados en el código. NO los rehace:

| Item | Archivo | Estado |
|---|---|---|
| `isVenueOpen()` centralizado | `utils/venueAvailability.ts` | ✅ Creado y funciona |
| VenueCard usa `isVenueOpen` | `components/customer/venue/VenueCard.tsx:10,82` | ✅ Refactorizado |
| `ActiveVenueCard` componente | `components/customer/home/ActiveVenueCard.tsx` | ✅ Creado |
| `ProductSmallCard` | `components/customer/home/ProductSmallCard.tsx` | ✅ Listo |
| `ProductDiscoveryRow` | `components/customer/home/ProductDiscoveryRow.tsx` | ✅ Listo (con `onSeeAll`) |
| `limit(300)` en getAllActiveProducts | `services/productService.ts:228` | ✅ Aplicado |
| Índice Firestore `quantity+city` | `firestore.indexes.json` | ✅ Agregado (FALTA deploy) |
| VenueCard recibe props completos | `pages/customer/Home.tsx:427-435` | ✅ `totalStock`, `productCount`, `soonestExpiry`, `hasDynamicPricing` |
| useMemos de discovery | `pages/customer/Home.tsx:160-238` | ✅ `activeVenuesNow`, `endingSoonProducts`, `bestDiscountProducts`, `nearbyProducts`, `surprisePackProducts` |
| i18n keys básicas | `i18n.ts` | ✅ `active_now`, `ending_soon`, `best_discounts`, `surprise_packs`, `products_available`, `open_until`, `closed_now` |

---

## Nueva estructura de la Home (layout objetivo)

```
┌─────────────────────────────────┐
│ 📍 Bucaramanga ▾      🔍  🔔   │  Header compacto
│                                 │
│ Hola, Cliente!                  │
│ Rescata algo delicioso 🌱      │
│                                 │
│ 🔥3 días · x1.5 ·····  120💎  │  Streak pill compacto
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │  🏆 DEAL DESTACADO          │ │  Hero: mejor producto
│ │  Pack Sorpresa — Sushi 83   │ │  con mayor descuento
│ │  -60%  $12.000   ⏰ 1h 23m │ │  + que vence pronto
│ │  [Rescatar ahora]           │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ 🔥 Finalizan pronto    Ver más │
│ ┌────┐ ┌────┐ ┌────┐ >>>      │  Productos ≤4h
│ │⏰2h│ │⏰1h│ │⏰30m│          │  de expirar
│ └────┘ └────┘ └────┘           │
├─────────────────────────────────┤
│ ● Activos ahora        Ver más │
│ ┌──────────┐ ┌──────────┐      │  Negocios abiertos
│ │ Sushi 83 │ │ Curry H  │      │  con stock
│ │ 5 prods  │ │ 3 prods  │      │
│ │ →23:59   │ │ →22:00   │      │
│ └──────────┘ └──────────┘      │
├─────────────────────────────────┤
│ 🛒 Productos            Ver más│
│ ┌────┐ ┌────┐ ┌────┐ >>>      │  Todos los productos
│ │prod│ │prod│ │prod│           │  activos (score)
│ └────┘ └────┘ └────┘           │
├─────────────────────────────────┤
│ 📍 Negocios cerca               │
│ ┌─────────────────────────────┐ │
│ │ ● Sushi Master — Abierto    │ │  Grid vertical
│ │   5 productos · hasta 23:59 │ │  TODOS: abiertos
│ ├─────────────────────────────┤ │  primero, luego
│ │ ○ La Baguette — Cerrado     │ │  cerrados en gris
│ │   Abre mañana 07:00         │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## PASO 1 — Header: quitar search bar inline, compactar gamification

**Archivo:** `pages/customer/Home.tsx`

### 1.1 Reemplazar search bar por ícono en header

El search bar actual (líneas 314-337) ocupa mucho espacio vertical. Reemplazarlo con un botón de búsqueda en el header que abre el `SearchOverlay` ya existente.

**Buscar** el header actual (línea ~251-266):
```tsx
<div className="flex items-center justify-between mb-6">
    <button onClick={() => setShowLocationSelector(true)} ...>
        ...Bucaramanga...
    </button>
    <div className="flex items-center gap-3">
        <NotificationDisplay />
    </div>
</div>
```

**Reemplazar con:**
```tsx
<div className="flex items-center justify-between mb-4">
    <button
        onClick={() => setShowLocationSelector(true)}
        className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100/50 group active:scale-95 transition-all"
    >
        <MapPin size={16} className="text-emerald-500" />
        <span className="text-sm font-black text-emerald-800 truncate max-w-[150px]">
            {city || 'Downtown'}
        </span>
        <ChevronDown size={14} className="text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
    </button>

    <div className="flex items-center gap-2">
        <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2.5 rounded-full bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
        >
            <Search size={20} />
        </button>
        <NotificationDisplay />
    </div>
</div>
```

### 1.2 Eliminar search bar inline completo

**Eliminar** todo el bloque `{/* Unified Search Bar */}` (líneas ~314-337 actuales).

### 1.3 Eliminar chips de categorías

**Eliminar** todo el bloque `{/* Modern Categories Bar */}` (líneas ~340-354 actuales).

**Eliminar** de los states: `selectedCategory`, `selectedDietaryTags`, `showOnlyActive` (ya no se usan).

**Simplificar** `filteredVenues` para que no dependa de `selectedCategory`:
```typescript
const filteredVenues = useMemo(() => sortedVenues.filter(venue => {
    const matchesSearch = searchQuery
        ? venue.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
    return matchesSearch;
}), [sortedVenues, searchQuery]);
```

### 1.4 Compactar banner de gamificación

**Reemplazar** el banner grande actual (líneas ~278-311) con una pill compacta:

```tsx
{user && !user.isGuest && (
    <div
        onClick={() => navigate('/app/impact')}
        className="mb-4 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl px-4 py-3 text-white cursor-pointer active:scale-[0.98] transition-all"
    >
        <div className="flex items-center gap-2.5">
            <Flame
                size={18}
                className={`${(user.streak?.current || 0) >= 3 ? 'text-yellow-300' : 'text-white/80'}`}
            />
            <span className="text-sm font-black">{user.streak?.current || 0} {t('streak_days')}</span>
            <span className="bg-yellow-400/90 text-yellow-900 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                x{user.streak?.multiplier?.toFixed(1) || '1.0'}
            </span>
        </div>
        <div className="flex items-center gap-1.5">
            <span className="text-sm font-black">{(user.impact?.points || 0).toLocaleString('es-CO')}</span>
            <span className="text-yellow-300 text-xs">💎</span>
        </div>
    </div>
)}
```

### 1.5 Limpiar imports y estados no usados

**Eliminar imports** que ya no se usan tras los cambios anteriores:
- `CategoriesBar` (si estaba importado)
- `FeaturedDealCard`
- `Logo` (si no se usa en otro sitio)
- `FlashDealsSection` (si no se usa)
- Iconos no usados: `User`, `LogOut`, `Heart`, `Leaf`, `TrendingUp`, `RefreshCw`, `Bell`, `Star`, `MessageCircle` (verificar uno a uno)

**Eliminar estados** no usados:
- `selectedCategory` + `setSelectedCategory`
- `selectedDietaryTags` + `setSelectedDietaryTags`
- `showOnlyActive` + `setShowOnlyActive`
- `showUserMenu` + `setShowUserMenu` + `userMenuRef`
- `isSupportChatOpen` + `setIsSupportChatOpen`

**Eliminar** el `useEffect` de `handleClickOutside` (líneas 105-117) que era para el menú de usuario.

**Eliminar** `handleLogout` (líneas 129-139) — ya no hay menú de usuario en Home.

**Eliminar** la función `searchInputRef` y el `useEffect` de `focus-rescatto-search` (líneas 120-127) — la búsqueda ahora usa el overlay.

**Eliminar** el useMemo `hotDealsVenues` si todavía existe.

**Eliminar** el import de `ChatWindow` si no se usa directamente.

---

## PASO 2 — Componente Hero Deal

**Archivo:** `components/customer/home/HeroDealCard.tsx` (CREAR)

Este componente muestra EL MEJOR producto disponible: el que tiene mayor combinación de descuento alto + vence pronto.

### 2.1 Props

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../../types';
import { Clock, Zap, ArrowRight } from 'lucide-react';
import { Countdown } from '../common/Countdown';
import { useTranslation } from 'react-i18next';

interface HeroDealCardProps {
    product: Product;
    venueName: string;
    discountPct: number; // 0-100
}
```

### 2.2 Lógica para seleccionar el hero deal (en Home.tsx)

Agregar un `useMemo` en Home.tsx:

```typescript
const heroDeal = useMemo(() => {
    if (allActiveProducts.length === 0) return null;
    const now = Date.now();
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    let best: { product: Product; score: number; discountPct: number } | null = null;

    for (const p of allActiveProducts) {
        const venue = venuesById.get(p.venueId);
        if (!venue || !isVenueOpen(venue)) continue;
        if (p.originalPrice <= 0) continue;

        const price = p.dynamicDiscountedPrice || p.discountedPrice;
        const discountPct = ((p.originalPrice - price) / p.originalPrice);
        const msLeft = new Date(p.availableUntil).getTime() - now;
        if (msLeft <= 0 || msLeft > SIX_HOURS) continue; // solo productos que vencen en ≤6h

        const urgencyScore = 1 - (msLeft / SIX_HOURS); // más urgente = más score
        const score = discountPct * 0.6 + urgencyScore * 0.4;

        if (!best || score > best.score) {
            best = { product: p, score, discountPct: Math.round(discountPct * 100) };
        }
    }

    return best;
}, [allActiveProducts, venuesById]);
```

### 2.3 Diseño del componente

```tsx
export const HeroDealCard: React.FC<HeroDealCardProps> = ({ product, venueName, discountPct }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const effectivePrice = product.dynamicDiscountedPrice || product.discountedPrice;

    return (
        <div
            onClick={() => navigate(`/app/venue/${product.venueId}`)}
            className="mx-6 mb-8 relative rounded-[1.5rem] overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-xl shadow-emerald-200/30"
        >
            {/* Background Image */}
            <div className="relative h-52">
                <img
                    src={product.imageUrl || `https://picsum.photos/seed/${product.id}/800/400`}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

                {/* Discount badge top-left */}
                <div className="absolute top-4 left-4 bg-emerald-500 text-white text-sm font-black px-3 py-1.5 rounded-xl shadow-lg">
                    -{discountPct}%
                </div>

                {/* Countdown top-right */}
                <div className="absolute top-4 right-4">
                    <Countdown targetTime={product.availableUntil} showIcon />
                </div>

                {/* Content overlay bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">{venueName}</p>
                    <h3 className="text-white text-xl font-black leading-tight mb-3">{product.name}</h3>

                    <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">
                                ${effectivePrice.toLocaleString('es-CO')}
                            </span>
                            <span className="text-sm font-bold text-white/50 line-through">
                                ${product.originalPrice.toLocaleString('es-CO')}
                            </span>
                        </div>
                        <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg flex items-center gap-1.5 active:scale-95 transition-all">
                            {t('rescue_now')} <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
```

### 2.4 Renderizar en Home.tsx

Colocar DESPUÉS del saludo + streak pill, ANTES de "Finalizan pronto":

```tsx
{heroDeal && (
    <HeroDealCard
        product={heroDeal.product}
        venueName={venueNamesMap.get(heroDeal.product.venueId) || ''}
        discountPct={heroDeal.discountPct}
    />
)}
```

---

## PASO 3 — Reorganizar secciones del `<main>`

**Archivo:** `pages/customer/Home.tsx`

El `<main>` actual tiene este orden:
1. Active Now (ActiveVenueCard)
2. 4x ProductDiscoveryRow (nearby, best discount, ending soon, surprise packs)
3. All Places Grid (VenueCard)

**Nuevo orden:**

```tsx
<main className="max-w-7xl mx-auto">

    {/* 1. Hero Deal */}
    {heroDeal && (
        <HeroDealCard
            product={heroDeal.product}
            venueName={venueNamesMap.get(heroDeal.product.venueId) || ''}
            discountPct={heroDeal.discountPct}
        />
    )}

    {/* 2. Finalizan pronto (productos urgentes ≤4h) */}
    <ProductDiscoveryRow
        title={t('ending_soon')}
        products={endingSoonProducts}
        venueNames={venueNamesMap}
        icon={Clock}
        iconColor="text-red-500"
        onSeeAll={() => navigate('/app/explore?sort=endingSoon')}
    />

    {/* 3. Activos ahora (negocios abiertos con stock) */}
    {activeVenuesNow.length > 0 && (
        <section className="mb-10">
            <div className="px-6 flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">
                        {t('active_now')}
                    </h2>
                </div>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-6 pb-4">
                {activeVenuesNow.slice(0, 10).map(venue => (
                    <ActiveVenueCard
                        key={venue.id}
                        venue={venue}
                        productCount={venueProductCountMap.get(venue.id)}
                        userLocation={hasUserLocation ? { lat: latitude!, lng: longitude! } : undefined}
                    />
                ))}
            </div>
        </section>
    )}

    {/* 4. Productos disponibles (todos, ordenados por score/descuento) */}
    <ProductDiscoveryRow
        title={t('available_products')}
        products={bestDiscountProducts}
        venueNames={venueNamesMap}
        icon={ShoppingBag}
        iconColor="text-emerald-500"
        onSeeAll={() => navigate('/app/explore?sort=recommended')}
    />

    {/* 5. Negocios cerca (TODOS: abiertos primero, cerrados después) */}
    <section className="px-6 pb-28">
        <div className="flex items-center gap-2 mb-5">
            <MapPin size={22} className="text-gray-700" />
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
                {t('nearby_venues')}
            </h2>
        </div>

        {allVenuesSorted.length > 0 ? (
            <div className="space-y-4">
                {allVenuesSorted.map(venue => {
                    const open = isVenueOpen(venue);
                    return (
                        <VenueCard
                            key={venue.id}
                            venue={venue}
                            userLocation={hasUserLocation ? { lat: latitude!, lng: longitude! } : undefined}
                            ratingStats={venueRatingMap.get(venue.id)}
                            totalStock={venueStockMap.get(venue.id)}
                            productCount={venueProductCountMap.get(venue.id)}
                            soonestExpiry={venueExpiryMap.get(venue.id)}
                            hasDynamicPricing={dynamicVenueIds.has(venue.id)}
                        />
                    );
                })}
            </div>
        ) : (
            <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <Search size={24} className="text-gray-400" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">{t('no_places_title')}</h3>
                <p className="text-gray-500 max-w-sm mx-auto">{t('no_places_desc')}</p>
            </div>
        )}
    </section>
</main>
```

**ELIMINAR** las secciones que ya no aplican:
- Las 4 `ProductDiscoveryRow` actuales (nearby_gems, best_discounts, ending_soon, surprise_packs) → reemplazar con las 2 de arriba (ending_soon + available_products)
- El grid "All Places" actual → reemplazar con la nueva sección "Negocios cerca"

---

## PASO 4 — Venues: abiertos primero + cerrados con estilo dimmed

### 4.1 Nuevo useMemo `allVenuesSorted`

```typescript
// Todos los venues: abiertos primero (por distancia), cerrados después (por distancia)
const allVenuesSorted = useMemo(() => {
    const open: Venue[] = [];
    const closed: Venue[] = [];
    sortedVenues.forEach(v => {
        if (isVenueOpen(v) && venueStockMap.has(v.id)) {
            open.push(v);
        } else {
            closed.push(v);
        }
    });
    return [...open, ...closed];
}, [sortedVenues, venueStockMap]);
```

### 4.2 Modificar `VenueCard` para soportar modo "cerrado"

**Archivo:** `components/customer/venue/VenueCard.tsx`

El VenueCard ya muestra "Cerrado ahora" cuando `isVenueOpen` es false (línea 210-213). Pero visualmente se ve igual que un venue abierto.

**Agregar** un wrapper condicional de opacidad:

Buscar la línea del `<Card>` (~línea 84):
```tsx
<Card
    className="group relative flex flex-col h-full transition-all duration-300 transform hover:!scale-105 hover:!shadow-2xl hover:z-10 border border-transparent hover:border-emerald-500/30 overflow-hidden"
```

Reemplazar con:
```tsx
<Card
    className={`group relative flex flex-col h-full transition-all duration-300 transform hover:!scale-105 hover:!shadow-2xl hover:z-10 border border-transparent hover:border-emerald-500/30 overflow-hidden ${!openStatus ? 'opacity-60 grayscale-[30%]' : ''}`}
```

Esto hace que venues cerrados se vean ligeramente apagados sin romper la legibilidad.

### 4.3 Texto "Cerrado" mejorado

El VenueCard ya muestra `t('closed_now')`. Para mejorar: en un futuro cuando exista `openingTime`, se podría mostrar "Abre a las HH:mm". Por ahora, `closed_now` es suficiente.

**Nota para futuro:** si se agrega `openingTime` al modelo `Venue`, cambiar el texto de `closed_now` a algo como `t('opens_at', { time: venue.openingTime })`. Fuera de alcance de este plan.

---

## PASO 5 — Eliminar componentes obsoletos

### 5.1 Eliminar `FeaturedDealCard.tsx`

**Archivo a eliminar:** `components/customer/home/FeaturedDealCard.tsx`

Este componente tiene datos 100% hardcoded y queda reemplazado por `HeroDealCard`.

**Eliminar** su import de `Home.tsx` (línea 8):
```typescript
// ELIMINAR esta línea:
import { FeaturedDealCard } from '../../components/customer/home/FeaturedDealCard';
```

### 5.2 Eliminar useMemo `hotDealsVenues`

Si aún existe en Home.tsx, eliminar:
```typescript
// ELIMINAR (ya no está en el código actual según la lectura, pero verificar)
const hotDealsVenues = useMemo(() => { ... }, [...]);
```

---

## PASO 6 — Crear página Explore

**Archivo:** `pages/customer/Explore.tsx` (CREAR)

### 6.1 Funcionalidad

```
1. Leer query params: sort, type, minDiscount, maxDistance, expiresInHours
2. Cargar datos: getAllVenues(city) + getAllActiveProducts(city) + getStockCountByVenue()
3. Construir venuesById map (local, no N+1 queries)
4. Filtrar productos:
   a. isProductAvailable (double-check)
   b. Venue abierto (isVenueOpen) + con stock
   c. Distancia ≤ maxDistance (si hay ubicación y filtro activo)
   d. Descuento ≥ minDiscount (si filtro activo)
   e. Vence en ≤ expiresInHours (si filtro activo)
   f. Tipo == type (si filtro activo: SURPRISE_PACK | SPECIFIC_DISH)
5. Ordenar:
   - "distance": distancia asc (requiere ubicación)
   - "discount": % descuento desc
   - "endingSoon": availableUntil asc
   - "recommended" (default): score compuesto
6. Render: filtros sticky top + grid 2-col mobile / 3-col desktop
```

### 6.2 Score de recomendación

```typescript
const computeScore = (product: Product, venue: Venue, lat?: number, lng?: number): number => {
    const price = product.dynamicDiscountedPrice || product.discountedPrice;
    const discountPct = product.originalPrice > 0
        ? (product.originalPrice - price) / product.originalPrice : 0;
    const discountScore = Math.min(discountPct / 0.8, 1);

    const hoursLeft = (new Date(product.availableUntil).getTime() - Date.now()) / (3600000);
    const expiryScore = 1 - Math.min(Math.max(hoursLeft, 0) / 6, 1);

    if (lat != null && lng != null) {
        const dist = calculateDistance(lat, lng, venue.latitude, venue.longitude) ?? 10;
        const distScore = 1 - Math.min(dist / 10, 1);
        return 0.45 * discountScore + 0.35 * expiryScore + 0.20 * distScore;
    }
    return 0.55 * discountScore + 0.45 * expiryScore;
};
```

### 6.3 UI de filtros

Barra sticky top debajo del header con scroll horizontal de chips:

```
[Distancia ▾] [Descuento ▾] [Vence en ▾] [Tipo ▾] [Limpiar]
```

Cada uno abre chips seleccionables:
- **Distancia:** `1km` `2.5km` `5km` `10km` (disabled sin ubicación → mostrar banner amarillo)
- **Descuento:** `≥20%` `≥40%` `≥60%`
- **Vence en:** `≤1h` `≤2h` `≤4h` `Hoy`
- **Tipo:** `Packs` `Platos` `Todos`

### 6.4 Grid de resultados

Usar `ProductSmallCard` en grid:
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-6 pb-28">
    {filteredProducts.map(p => (
        <ProductSmallCard
            key={p.id}
            product={p}
            venueName={venuesById.get(p.venueId)?.name}
        />
    ))}
</div>
```

### 6.5 Empty state

```tsx
<div className="text-center py-16 px-6">
    <Search size={48} className="text-gray-300 mx-auto mb-4" />
    <h3 className="text-xl font-black text-gray-900 mb-2">{t('no_results')}</h3>
    <p className="text-gray-500 mb-6">{t('try_adjusting_filters')}</p>
    <button onClick={clearFilters} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black">
        {t('clear_filters')}
    </button>
</div>
```

---

## PASO 7 — Registrar ruta en App.tsx

**Archivo:** `App.tsx`

### 7.1 Agregar lazy import

Junto a los otros lazy imports de customer (buscar `const CustomerHome = lazy(...)`):
```typescript
const Explore = lazy(() => import('./pages/customer/Explore'));
```

### 7.2 Agregar ruta

Dentro de `<Route path="/app" element={<CustomerLayout />}>` (línea ~380), agregar después de `<Route index element={<CustomerHome />} />`:

```tsx
<Route path="explore" element={<Explore />} />
```

No necesita `ProtectedRoute` — accesible para todos los autenticados.

---

## PASO 8 — Traducciones i18n

**Archivo:** `i18n.ts`

### Claves que YA EXISTEN (NO duplicar):
`active_now`, `ending_soon`, `best_discounts`, `surprise_packs`, `products_available`, `open_until`, `closed_now`, `see_all`, `nearby_gems`

### Claves NUEVAS a agregar:

**Español (dentro de `es.translation`):**
```
"rescue_now": "Rescatar ahora",
"available_products": "Productos",
"nearby_venues": "Negocios cerca",
"no_results": "Sin resultados",
"try_adjusting_filters": "Intenta ajustar los filtros para encontrar lo que buscas",
"clear_filters": "Limpiar filtros",
"enable_location_for_distance": "Activa tu ubicación para ordenar por cercanía",
"explore_title": "Explorar productos",
"filter_distance": "Distancia",
"filter_discount": "Descuento",
"filter_expires": "Vence en",
"filter_type": "Tipo",
"sort_recommended": "Recomendado",
"sort_distance": "Distancia",
"sort_discount": "Descuento",
"sort_ending_soon": "Vence pronto",
"type_packs": "Packs",
"type_dishes": "Platos",
"type_all": "Todos",
"hero_featured": "Destacado"
```

**Inglés (dentro de `en.translation`):**
```
"rescue_now": "Rescue now",
"available_products": "Products",
"nearby_venues": "Venues near you",
"no_results": "No results",
"try_adjusting_filters": "Try adjusting the filters to find what you're looking for",
"clear_filters": "Clear filters",
"enable_location_for_distance": "Enable location to sort by distance",
"explore_title": "Explore products",
"filter_distance": "Distance",
"filter_discount": "Discount",
"filter_expires": "Expires in",
"filter_type": "Type",
"sort_recommended": "Recommended",
"sort_distance": "Distance",
"sort_discount": "Discount",
"sort_ending_soon": "Ending soon",
"type_packs": "Packs",
"type_dishes": "Dishes",
"type_all": "All",
"hero_featured": "Featured"
```

---

## PASO 9 — Deploy de índice Firestore

```bash
firebase deploy --only firestore:indexes
```

El índice `products: quantity ASC + city ASC` ya está en `firestore.indexes.json`. Tarda 2-5 min en construirse.

---

## Orden de ejecución

```
PARALELO:
├── Paso 8: Traducciones i18n
├── Paso 9: Deploy índice Firestore
└── Paso 2: Crear HeroDealCard.tsx

SECUENCIAL (después del paralelo):
1. Paso 1: Refactorizar header de Home.tsx (search icon, compactar gamification, eliminar categories)
2. Paso 5: Eliminar FeaturedDealCard + imports muertos
3. Paso 3: Reorganizar secciones del <main> (hero → ending soon → active → products → venues)
4. Paso 4: allVenuesSorted + VenueCard dimmed para cerrados
5. Paso 6: Crear Explore.tsx
6. Paso 7: Registrar ruta en App.tsx
```

---

## Archivos afectados (resumen final)

| Archivo | Acción |
|---|---|
| `components/customer/home/HeroDealCard.tsx` | **CREAR** |
| `pages/customer/Explore.tsx` | **CREAR** |
| `pages/customer/Home.tsx` | **EDITAR** (header, secciones, eliminar bloques) |
| `components/customer/venue/VenueCard.tsx` | **EDITAR** (agregar clase dimmed para cerrados) |
| `components/customer/home/FeaturedDealCard.tsx` | **ELIMINAR** |
| `App.tsx` | **EDITAR** (lazy import + ruta) |
| `i18n.ts` | **EDITAR** (agregar claves nuevas) |

| Archivo | NO TOCAR |
|---|---|
| `utils/venueAvailability.ts` | ✅ Ya listo |
| `components/customer/home/ActiveVenueCard.tsx` | ✅ Ya listo |
| `components/customer/home/ProductDiscoveryRow.tsx` | ✅ Ya listo |
| `components/customer/home/ProductSmallCard.tsx` | ✅ Ya listo |
| `services/productService.ts` | ✅ Ya tiene limit(300) |
| `firestore.indexes.json` | ✅ Ya tiene el índice |

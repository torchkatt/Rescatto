# 🚀 Guía SEO — Rescatto

## 1. Google Search Console

### Paso 1: Registro
1. Ve a https://search.google.com/search-console
2. Inicia sesión con tu cuenta Google (TorchKatt Group)
3. Añade propiedad: `https://rescatto-c8d2b.web.app`
4. Elige método de verificación: **Meta tag**

### Paso 2: Verificación por Meta Tag
1. Google te dará un meta tag como:
   ```html
   <meta name="google-site-verification" content="XXXXXXXXXXX" />
   ```
2. Agrega ese meta tag en `index.html` dentro del `<head>`, justo después de los meta charset y viewport.

### Paso 3: Verificación por archivo (alternativa)
1. Google te dará un archivo como `googleXXXXXXX.html`
2. Cópialo a `public/googleXXXXXXX.html`
3. Haz deploy: `firebase deploy --only hosting`
4. Verifica en Search Console

### Paso 4: Enviar Sitemap
1. En Search Console, ve a **Sitemaps**
2. Ingresa: `https://rescatto-c8d2b.web.app/sitemap.xml`
3. Haz clic en **Enviar**
4. Verifica que aparezca como "Success"

### Paso 5: Inspeccionar URLs
1. Ve a **URL Inspection**
2. Ingresa: `https://rescatto-c8d2b.web.app/`
3. Haz clic en **Request Indexing**
4. Repite con: `/explore`, `/help`

---

## 2. Performance (Core Web Vitals)

### Lighthouse
```bash
cd Rescatto
npx vite build
npx lighthouse https://rescatto-c8d2b.web.app --view
```

### Objetivos
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

---

## 3. Redes Sociales

### Publicaciones recomendadas (primer mes)

**Semana 1 — Lanzamiento**
> 🚀 Rescatto ya está en vivo! El marketplace inteligente que transforma tu inventario en ganancias. Pagos seguros con Wompi, AI Chat, analytics en tiempo real. ¡Únete! https://rescatto-c8d2b.web.app

**Semana 2 — Vendedores**
> 🏪 ¿Eres vendedor? Con Rescatto puedes crear tu tienda online en minutos. Productos, servicios, digital — todo desde un solo lugar. Sin complicaciones. https://rescatto-c8d2b.web.app

**Semana 3 — Compradores**
> 🛍️ Encuentra lo que necesitas en Rescatto. Desde tecnología hasta servicios profesionales. Paga seguro con Wompi. ¡Explora! https://rescatto-c8d2b.web.app

**Semana 4 — Seller Pass**
> 💎 Vende más con Seller Pass. Comisión reducida al 5%, analytics avanzados, listings destacados. Plan desde $49.900/mes. https://rescatto-c8d2b.web.app

### Hashtags
```
#Rescatto #MarketplaceColombia #VendeOnline #Wompi #Emprendimiento #Ecommerce #Tecnologia #Servicios
```

### Plataformas
- **LinkedIn**: TorchKatt Group SAS — contenido B2B para vendedores
- **Instagram**: Visual — productos, servicios, casos de uso
- **Twitter/X**: Actualizaciones, lanzamientos, tips

---

## 4. Backlinks (off-page SEO)

### Estrategia
1. **Directorios de empresas colombianas** — registrar Rescatto
2. **Medium / Blog** — escribir artículos sobre marketplace en Colombia
3. **Comunidades WhatsApp / Telegram** — compartir con grupos de emprendedores
4. **Google My Business** — crear perfil de TorchKatt Group SAS
5. **Prensa local** — contactar medios tech colombianos

### Directorios gratuitos
| Directorio | URL |
|------------|-----|
| Google My Business | https://business.google.com |
| LinkedIn Company | https://linkedin.com |
| Facebook Business | https://business.facebook.com |
| Instagram Business | https://instagram.com |
| Twitter/X | https://twitter.com |

---

## 5. Monitoreo

### Herramientas
| Herramienta | Propósito |
|-------------|-----------|
| Google Search Console | Indexación, queries, errores |
| Google Analytics 4 | Tráfico, usuarios, conversiones |
| Sentry | Errores de frontend (ya configurado) |
| Firebase Console | Uso de Firestore, Auth, Functions |

### KPIs iniciales
- **Impresiones en Google**: > 1,000/mes al mes 3
- **Clics orgánicos**: > 50/mes al mes 3
- **Error rate**: < 1% en Sentry
- **Velocidad**: Lighthouse > 80 en todas las métricas
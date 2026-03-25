export const POSTGRES_DDL_SCRIPT = `-- Extensiones Requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Tabla de Roles (Enum en DB o Tabla Lookup)
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'VENUE_OWNER', 'KITCHEN_STAFF', 'CUSTOMER');

-- 2. Tabla de Comercios (Venues)
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL, -- PostGIS
    operating_hours JSONB NOT NULL, 
    commission_rate DECIMAL(5, 2) DEFAULT 20.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Usuarios (Autenticación)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Nullable si usa OAuth (Google)
    full_name VARCHAR(255),
    role user_role DEFAULT 'CUSTOMER',
    venue_id UUID REFERENCES venues(id) ON DELETE SET NULL, -- Null para Customers/Admins
    auth_provider VARCHAR(50) DEFAULT 'EMAIL', -- 'EMAIL', 'GOOGLE', 'APPLE'
    provider_id VARCHAR(255), -- ID externo de Google/Apple
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Productos
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('SURPRISE_PACK', 'SPECIFIC_DISH')),
    original_price DECIMAL(10, 2) NOT NULL,
    discounted_price DECIMAL(10, 2) NOT NULL,
    quantity_available INT NOT NULL CHECK (quantity_available >= 0),
    available_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_dynamic_pricing BOOLEAN DEFAULT false
);

-- 5. Tabla de Órdenes
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    venue_id UUID REFERENCES venues(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    pickup_code VARCHAR(6) NOT NULL,
    pickup_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for Performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_venue_status ON orders(venue_id, status);
`;

export const BACKEND_LOGIC_SCRIPT = `import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { Order, OrderStatus } from './order.entity';
import { Product } from '../products/product.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  // Creación de orden transaccional para evitar Race Conditions (Sobreventa)
  async createOrder(userId: string, productId: string, quantity: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // LOCK PESSIMISTIC: Bloquea la fila del producto hasta que termine la transacción
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' }, 
      });

      if (!product || product.quantity_available < quantity) {
        throw new BadRequestException('Stock insuficiente o producto no disponible');
      }

      // Validar expiración
      if (new Date() > product.available_until) {
        throw new BadRequestException('El tiempo de venta ha finalizado');
      }

      // Decrementar stock
      product.quantity_available -= quantity;
      await queryRunner.manager.save(product);

      // Crear Orden
      const order = new Order();
      order.user_id = userId;
      order.product = product;
      order.status = OrderStatus.PENDING; // Esperando webhook de pago
      order.pickup_deadline = product.available_until;
      
      // Cálculo financiero (separar dinero del comercio vs app)
      const total = product.discounted_price * quantity;
      order.app_commission_amount = total * 0.20; // 20% Hardcoded por ahora
      order.venue_payout_amount = total - order.app_commission_amount;

      const savedOrder = await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();
      return savedOrder;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Cron Job: Marca automáticamente como 'MISSED' si no se recogió a tiempo
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleMissedPickups() {
    this.logger.debug('Checking for missed pickups...');
    
    const missedOrders = await this.orderRepo.find({
      where: {
        status: OrderStatus.READY,
        pickup_deadline: LessThan(new Date()),
      },
    });

    for (const order of missedOrders) {
      order.status = OrderStatus.MISSED;
      // Política: NO hay reembolso automático en Missed (Responsabilidad del usuario)
      await this.orderRepo.save(order);
      // Notificación enviada a través de Firebase Cloud Functions (index.js -> handleMissedPickups)
    }
  }
}`;

export const LEGAL_STRATEGY_MARKDOWN = `
## A. Términos y Condiciones (Cláusulas Críticas)
*   **Mandato de Gestión:** Legalmente, Rescatto actúa como un "Mandatario" del usuario para comprar comida y del restaurante para cobrarla. No somos dueños del inventario.
*   **Exención Bromatológica:** "El COMERCIO certifica que los alimentos cumplen la normativa sanitaria local (Invima/Secretaría Salud). Rescatto es un intermediario digital y no manipula, transporta ni garantiza el estado biológico de los alimentos."
*   **Política de No-Show:** Si el usuario no recoge antes del pickup_deadline, el producto se desecha o dona. No hay reembolso (El producto pereció por culpa del usuario).

## B. Estructura Financiera (Impuestos LatAm)
*   **Ingresos para Terceros:** No facturar el 100% al usuario final a nombre de Rescatto. Eso generaría IVA sobre el total.
*   **Modelo Dispersión:** Usar Pasarela de Pagos (Stripe Connect / Wompi Split).
    *   El usuario paga $100.
    *   La pasarela envía $80 directo al Restaurante.
    *   La pasarela envía $20 a Rescatto.
*   **Facturación:** Rescatto solo emite factura electrónica por los $20 (Comisión tecnológica + IVA servicio). El restaurante es responsable de facturar los $100 al usuario si este lo exige.

## C. Estrategia MVP (2 Meses)

### Mes 1: Core Loop
*   App Cliente: Feed, Mapa, Pago Básico.
*   App Aliado (Web): Subir Stock, Validar Código Pickup.
*   Backend: Órdenes, Cron de Expiración.

### Mes 2: Growth & Trust
*   Dynamic Pricing (Regla simple de tiempo).
*   Push Notifications (Recordatorios).
*   Pack Sorpresa vs Plato Específico.
`;

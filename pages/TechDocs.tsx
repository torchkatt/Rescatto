import React, { useState } from 'react';
import { BookOpen, Shield, Store, CreditCard, ChevronDown, ChevronRight } from 'lucide-react';

interface DocSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const DocSection: React.FC<DocSectionProps> = ({ title, icon, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600">
            {icon}
          </div>
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        </div>
        {isOpen ? <ChevronDown className="text-gray-500" /> : <ChevronRight className="text-gray-500" />}
      </button>
      {isOpen && (
        <div className="p-6 border-t border-gray-200 text-gray-700 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

const TechDocs: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documentación de la Plataforma</h1>
          <p className="text-gray-500 mt-2">Guía técnica y operativa para administradores de Rescatto.</p>
        </div>
        <div className="flex space-x-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-2 rounded-md text-sm font-medium bg-emerald-50 text-emerald-700 shadow-sm flex items-center">
            <BookOpen size={16} className="mr-2" />
            Versión 1.2
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <DocSection title="1. Arquitectura de Roles y Permisos" icon={<Shield size={20} />}>
          <p>
            Rescatto utiliza un sistema de Control de Acceso Basado en Roles (RBAC) combinado con asignación a sedes (Venues).
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Super Admin:</strong> Acceso global a todas las sedes, configuración financiera, creación de nuevos roles y eliminación definitiva de usuarios.</li>
            <li><strong>Admin:</strong> Administra múltiples sedes asignadas. Puede crear usuarios por debajo de su jerarquía (ej. Staff, Drivers) dentro de sus sedes.</li>
            <li><strong>Venue Owner (Dueño de Sede):</strong> Control local de un restaurante específico. Puede modificar horarios, menús, ver pedidos rebotados y gestionar finanzas de esa sede.</li>
            <li><strong>Kitchen Staff (Personal):</strong> Acceso restringido únicamente al KDS (Kitchen Display System) para aceptar y preparar pedidos.</li>
            <li><strong>Driver:</strong> Acceso a la vista móvil de entregas. Solo visualiza órdenes asignadas en estado DISPATCHED.</li>
          </ul>
        </DocSection>

        <DocSection title="2. Gestión de Negocios (Venues)" icon={<Store size={20} />}>
          <p>
            Cada entidad comercial en Rescatto se denomina <strong>Sede (Venue)</strong>. Los productos y órdenes están atados directamente a una Sede.
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Configuración de Domicilios:</strong> La sede debe habilitar `deliveryConfig`. Si no se habilita, la plataforma asume que solo opera modalidad &ldquo;Pick-up&rdquo;.</li>
            <li><strong>Theming (Marcas Blancas):</strong> El `brandColor` y `logoUrl` almacenados en cada sede alimentan dinámicamente el `ThemeContext`, cambiando el esquema de colores cuando un usuario asociado inicia sesión.</li>
            <li><strong>Horarios:</strong> El `closingTime` se evalúa estrictamente para el cierre de caja y los reportes diarios de corte.</li>
          </ul>
        </DocSection>

        <DocSection title="3. Pagos e Integración Wompi" icon={<CreditCard size={20} />}>
          <p>
            El flujo financiero principal de Rescatto funciona a través de <strong>Wompi</strong> usando el Web Widget integrado en React.
          </p>
          <h4 className="font-bold text-gray-900 mt-4 mb-2">Flujo de Compra</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>El usuario confirma su carrito, calculando totales, descuentos por puntos (redeemId) y la tarifa de envío si aplica.</li>
            <li>Al pulsar Pagar, el Widget de Wompi se renderiza inyectando la referencia única del pedido (`generateOrderReference()`).</li>
            <li>Si el pago es aprobado por la pasarela, el Widget lanza un evento `transaction.updated` o cierra con éxito.</li>
            <li>El Frontend captura el estado APROBADO e invoca la Cloud Function `createOrder` con la metadata de pago asimétrica.</li>
            <li>El backend (App de Firebase Functions) asegura el decremento exacto del inventario y notifica en tiempo real al KDS de la sede conectada.</li>
          </ol>
        </DocSection>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between text-sm text-gray-500">
        <p>Actualizado: {new Date().toLocaleDateString()}</p>
        <p>Rescatto Technologies</p>
      </div>
    </div>
  );
};

export default TechDocs;
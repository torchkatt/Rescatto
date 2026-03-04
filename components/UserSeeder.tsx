import React, { useState } from 'react';
import { SeederService } from '../services/SeederService';
import { UserRole } from '../types';
import { Button } from './customer/common/Button';
import { dataService } from '../services/dataService';
import { logger } from '../utils/logger';

export const UserSeeder: React.FC = () => {
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleClear = async () => {
        setLoading(true);
        setStatus('🗑️ Limpiando base de datos...\n');
        try {
            await SeederService.clearDatabase();
            setStatus(prev => prev + '✅ Base de datos limpia.\n');
        } catch (error: any) {
            setStatus(prev => prev + `❌ Error al limpiar: ${error.message}\n`);
        } finally {
            setLoading(false);
        }
    };

    const handleSeedAll = async () => {
        setLoading(true);
        setStatus('🚀 Iniciando proceso de seeding completo...\n');

        // Optional: Auto-clear before seed? No, let user decide.
        // await handleClear(); 

        try {
            // 1. Create Venues
            setStatus(prev => prev + 'Creating 10 Venues... ');
            const venues = await SeederService.seedVenues(10);
            setStatus(prev => prev + `✅ Created ${venues.length} venues.\n`);

            // 2. Create Venue Owners (NEW)
            setStatus(prev => prev + 'Creating Venue Owners... ');
            await SeederService.seedVenueOwners(venues);
            setStatus(prev => prev + '✅ Venue Owners created.\n');

            // 3. Create Products for each Venue
            setStatus(prev => prev + 'Creating Categories and Products for Venues... \n');
            const productsMap: { [key: string]: any[] } = {};
            for (const venue of venues) {
                // NEW: Create Categories first
                const categories = await SeederService.seedCategories(venue.id);
                setStatus(prev => prev + `  - Created ${categories.length} categories for ${venue.name}\n`);

                // Pass categories to seedProducts
                await SeederService.seedProducts(venue.id, categories, 10);

                // Quick fetch to store for order generation
                const prods = await dataService.getProducts(venue.id);
                productsMap[venue.id] = prods;
                setStatus(prev => prev + `  - Added 10 products to ${venue.name}\n`);
            }

            // 3. Create Customers (Batch)
            setStatus(prev => prev + 'Creating 5 Test Customers... ');
            const customers = await SeederService.seedUsers(5, UserRole.CUSTOMER);
            setStatus(prev => prev + `✅ Created ${customers.length} customers.\n`);

            // 4. Create Random Orders
            setStatus(prev => prev + 'Generating Random Orders... ');
            const orders = await SeederService.seedOrders(customers, venues, productsMap, 5); // Increased to 5 per customer
            setStatus(prev => prev + `✅ Created ${orders.length} orders.\n`);

            // 5. Generate Ratings
            setStatus(prev => prev + 'Generating Ratings... ');
            await SeederService.seedRatings(orders);
            setStatus(prev => prev + '✅ Ratings generated.\n');

            // 6. Generate Chats
            setStatus(prev => prev + 'Generating Chats... ');
            await SeederService.seedChats(orders);
            setStatus(prev => prev + '✅ Chats generated.\n');

            // 7. Generate Donation Centers
            setStatus(prev => prev + 'Generating Donation Centers... ');
            await SeederService.seedDonationCenters();
            setStatus(prev => prev + '✅ Donation Centers generated.\n');

            setStatus(prev => prev + '\n✨ SEEDING COMPLETADO EXITOSAMENTE ✨');

        } catch (error: any) {
            logger.error(error);
            setStatus(prev => prev + `\n❌ ERROR: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-4 font-poppins text-emerald-800">Generador de Datos de Prueba</h1>
            <p className="mb-6 text-gray-600">
                Esta herramienta generará todo lo necesario para probar la app:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>10 Restaurantes (Venues) con categorías reales</li>
                    <li>10 Productos por restaurante asociados a su categoría</li>
                    <li>5 Usuarios clientes nuevos</li>
                    <li>Pedidos de prueba (Historial)</li>
                    <li>Centros de Donación (Albergues, Asilos)</li>
                </ul>
            </p>

            <div className="bg-slate-900 text-green-400 p-4 rounded-lg mb-6 whitespace-pre-wrap font-mono text-xs min-h-[300px] shadow-inner overflow-y-auto max-h-[500px]">
                {status || '> Sistema listo. Esperando comando...'}
            </div>

            <div className="flex flex-wrap gap-4">
                <Button
                    onClick={handleClear}
                    isLoading={loading}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 text-white border-red-800"
                >
                    LIMPIAR BD
                </Button>
                <Button onClick={handleSeedAll} isLoading={loading} disabled={loading}>
                    GENERAR DATOS COMPLETOS
                </Button>
                <Button
                    onClick={async () => {
                        setLoading(true);
                        setStatus('📦 Sembrando Centros de Donación...\n');
                        try {
                            await SeederService.seedDonationCenters();
                            setStatus(prev => prev + '✅ Centros de Donación creados.\n');
                        } catch (e: any) {
                            setStatus(prev => prev + `❌ Error: ${e.message}\n`);
                        } finally {
                            setLoading(false);
                        }
                    }}
                    isLoading={loading}
                    disabled={loading}
                    variant="outline"
                >
                    Sembrar Centros Donación
                </Button>
            </div>
        </div>
    );
};

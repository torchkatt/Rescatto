import React, { useState } from 'react';
import { initializeFirestore, checkIfDataExists } from '../services/initializeFirestore';

export const FirestoreSetup: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [dataStatus, setDataStatus] = useState<any>(null);

    const handleCheckData = async () => {
        setLoading(true);
        try {
            const status = await checkIfDataExists();
            setDataStatus(status);
            if (status.hasVenues && status.hasProducts) {
                setMessage(`✅ Base de datos ya tiene datos: ${status.venueCount} venues, ${status.productCount} productos`);
            } else {
                setMessage('⚠️ Base de datos vacía. Haz clic en "Inicializar" para poblarla.');
            }
        } catch (error: any) {
            setMessage(`❌ Error: ${error.message}`);
        }
        setLoading(false);
    };

    const handleInitialize = async () => {
        setLoading(true);
        setMessage('🔄 Inicializando Firestore...');
        try {
            await initializeFirestore();
            setMessage('🎉 ¡Firestore inicializado exitosamente! Recarga la página para ver los datos.');
            await handleCheckData();
        } catch (error: any) {
            setMessage(`❌ Error: ${error.message}`);
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
                🔥 Configuración de Firestore
            </h2>

            <div className="mb-6">
                <p className="text-gray-600 mb-4">
                    Usa esta herramienta para inicializar tu base de datos Firestore con datos de ejemplo.
                </p>

                {message && (
                    <div className={`p-4 rounded-md mb-4 ${message.includes('✅') || message.includes('🎉')
                            ? 'bg-green-50 text-green-800'
                            : message.includes('❌')
                                ? 'bg-red-50 text-red-800'
                                : 'bg-yellow-50 text-yellow-800'
                        }`}>
                        {message}
                    </div>
                )}

                {dataStatus && (
                    <div className="bg-blue-50 p-4 rounded-md mb-4">
                        <h3 className="font-semibold text-blue-900 mb-2">Estado de la Base de Datos:</h3>
                        <ul className="text-blue-800 space-y-1">
                            <li>• Venues: {dataStatus.venueCount}</li>
                            <li>• Productos: {dataStatus.productCount}</li>
                        </ul>
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={handleCheckData}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Verificar Datos
                </button>

                <button
                    onClick={handleInitialize}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Inicializando...' : 'Inicializar Firestore'}
                </button>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-md">
                <h3 className="font-semibold text-gray-800 mb-2">📝 ¿Qué hace esto?</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Crea un venue por defecto (Restaurante Rescatto)</li>
                    <li>• Agrega 5 productos de ejemplo (platos, postres, panadería)</li>
                    <li>• Crea 3 órdenes de ejemplo con diferentes estados</li>
                </ul>
            </div>
        </div>
    );
};

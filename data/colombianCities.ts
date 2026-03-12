export interface ColombianCity {
    name: string;
    department: string;
    lat: number;
    lng: number;
}

export const COLOMBIAN_CITIES: ColombianCity[] = [
    // Amazonas
    { name: 'Leticia', department: 'Amazonas', lat: -4.2153, lng: -69.9406 },
    // Antioquia
    { name: 'Medellín', department: 'Antioquia', lat: 6.2442, lng: -75.5812 },
    { name: 'Bello', department: 'Antioquia', lat: 6.3369, lng: -75.5564 },
    { name: 'Itagüí', department: 'Antioquia', lat: 6.1845, lng: -75.5990 },
    { name: 'Envigado', department: 'Antioquia', lat: 6.1651, lng: -75.5873 },
    { name: 'Rionegro', department: 'Antioquia', lat: 6.1546, lng: -75.3741 },
    { name: 'Apartadó', department: 'Antioquia', lat: 7.8839, lng: -76.6270 },
    { name: 'Turbo', department: 'Antioquia', lat: 8.0983, lng: -76.7273 },
    { name: 'Caucasia', department: 'Antioquia', lat: 7.9888, lng: -75.1975 },
    { name: 'Copacabana', department: 'Antioquia', lat: 6.3481, lng: -75.5076 },
    { name: 'La Estrella', department: 'Antioquia', lat: 6.1563, lng: -75.6424 },
    { name: 'Sabaneta', department: 'Antioquia', lat: 6.1510, lng: -75.6178 },
    { name: 'Caldas', department: 'Antioquia', lat: 6.0940, lng: -75.6369 },
    // Arauca
    { name: 'Arauca', department: 'Arauca', lat: 7.0847, lng: -70.7590 },
    // Atlántico
    { name: 'Barranquilla', department: 'Atlántico', lat: 10.9685, lng: -74.7813 },
    { name: 'Soledad', department: 'Atlántico', lat: 10.9179, lng: -74.7684 },
    { name: 'Malambo', department: 'Atlántico', lat: 10.8582, lng: -74.7748 },
    { name: 'Sabanalarga', department: 'Atlántico', lat: 10.6274, lng: -74.9227 },
    // Bolívar
    { name: 'Cartagena', department: 'Bolívar', lat: 10.3910, lng: -75.4794 },
    { name: 'Magangué', department: 'Bolívar', lat: 9.2411, lng: -74.7548 },
    { name: 'El Carmen de Bolívar', department: 'Bolívar', lat: 9.7173, lng: -75.1194 },
    // Boyacá
    { name: 'Tunja', department: 'Boyacá', lat: 5.5353, lng: -73.3678 },
    { name: 'Duitama', department: 'Boyacá', lat: 5.8277, lng: -73.0278 },
    { name: 'Sogamoso', department: 'Boyacá', lat: 5.7193, lng: -72.9355 },
    { name: 'Chiquinquirá', department: 'Boyacá', lat: 5.6159, lng: -73.8196 },
    // Caldas
    { name: 'Manizales', department: 'Caldas', lat: 5.0703, lng: -75.5138 },
    { name: 'La Dorada', department: 'Caldas', lat: 5.4504, lng: -74.6692 },
    { name: 'Chinchiná', department: 'Caldas', lat: 4.9807, lng: -75.6054 },
    // Caquetá
    { name: 'Florencia', department: 'Caquetá', lat: 1.6144, lng: -75.6062 },
    // Casanare
    { name: 'Yopal', department: 'Casanare', lat: 5.3378, lng: -72.3956 },
    // Cauca
    { name: 'Popayán', department: 'Cauca', lat: 2.4419, lng: -76.6060 },
    { name: 'Santander de Quilichao', department: 'Cauca', lat: 3.0117, lng: -76.4838 },
    // Cesar
    { name: 'Valledupar', department: 'Cesar', lat: 10.4631, lng: -73.2532 },
    { name: 'Aguachica', department: 'Cesar', lat: 8.3082, lng: -73.6213 },
    // Chocó
    { name: 'Quibdó', department: 'Chocó', lat: 5.6919, lng: -76.6583 },
    // Córdoba
    { name: 'Montería', department: 'Córdoba', lat: 8.7574, lng: -75.8851 },
    { name: 'Lorica', department: 'Córdoba', lat: 9.2417, lng: -75.8131 },
    { name: 'Sahagún', department: 'Córdoba', lat: 8.9499, lng: -75.4448 },
    // Cundinamarca
    { name: 'Bogotá', department: 'Cundinamarca', lat: 4.7110, lng: -74.0721 },
    { name: 'Soacha', department: 'Cundinamarca', lat: 4.5793, lng: -74.2175 },
    { name: 'Facatativá', department: 'Cundinamarca', lat: 4.8155, lng: -74.3553 },
    { name: 'Zipaquirá', department: 'Cundinamarca', lat: 5.0226, lng: -74.0057 },
    { name: 'Fusagasugá', department: 'Cundinamarca', lat: 4.3380, lng: -74.3641 },
    { name: 'Chía', department: 'Cundinamarca', lat: 4.8627, lng: -74.0589 },
    { name: 'Mosquera', department: 'Cundinamarca', lat: 4.7063, lng: -74.2300 },
    { name: 'Madrid', department: 'Cundinamarca', lat: 4.7336, lng: -74.2652 },
    { name: 'Girardot', department: 'Cundinamarca', lat: 4.3026, lng: -74.8028 },
    { name: 'Funza', department: 'Cundinamarca', lat: 4.7155, lng: -74.2118 },
    // Guainía
    { name: 'Inírida', department: 'Guainía', lat: 3.8653, lng: -67.9238 },
    // Guaviare
    { name: 'San José del Guaviare', department: 'Guaviare', lat: 2.5684, lng: -72.6416 },
    // Huila
    { name: 'Neiva', department: 'Huila', lat: 2.9273, lng: -75.2820 },
    { name: 'Pitalito', department: 'Huila', lat: 1.8551, lng: -76.0497 },
    { name: 'Garzón', department: 'Huila', lat: 2.1993, lng: -75.6262 },
    // La Guajira
    { name: 'Riohacha', department: 'La Guajira', lat: 11.5444, lng: -72.9072 },
    { name: 'Maicao', department: 'La Guajira', lat: 11.3819, lng: -72.2437 },
    // Magdalena
    { name: 'Santa Marta', department: 'Magdalena', lat: 11.2408, lng: -74.1990 },
    { name: 'Ciénaga', department: 'Magdalena', lat: 11.0058, lng: -74.2506 },
    // Meta
    { name: 'Villavicencio', department: 'Meta', lat: 4.1534, lng: -73.6351 },
    { name: 'Acacías', department: 'Meta', lat: 3.9887, lng: -73.7604 },
    // Nariño
    { name: 'Pasto', department: 'Nariño', lat: 1.2136, lng: -77.2811 },
    { name: 'Ipiales', department: 'Nariño', lat: 0.8291, lng: -77.6440 },
    { name: 'Tumaco', department: 'Nariño', lat: 1.7987, lng: -78.7563 },
    // Norte de Santander
    { name: 'Cúcuta', department: 'Norte de Santander', lat: 7.8939, lng: -72.5078 },
    { name: 'Ocaña', department: 'Norte de Santander', lat: 8.2353, lng: -73.3596 },
    { name: 'Pamplona', department: 'Norte de Santander', lat: 7.3804, lng: -72.6509 },
    // Putumayo
    { name: 'Mocoa', department: 'Putumayo', lat: 1.1522, lng: -76.6483 },
    // Quindío
    { name: 'Armenia', department: 'Quindío', lat: 4.5339, lng: -75.6811 },
    { name: 'Calarcá', department: 'Quindío', lat: 4.5351, lng: -75.6443 },
    // Risaralda
    { name: 'Pereira', department: 'Risaralda', lat: 4.8133, lng: -75.6961 },
    { name: 'Dosquebradas', department: 'Risaralda', lat: 4.8399, lng: -75.6659 },
    // San Andrés y Providencia
    { name: 'San Andrés', department: 'San Andrés y Providencia', lat: 12.5847, lng: -81.7006 },
    // Santander
    { name: 'Bucaramanga', department: 'Santander', lat: 7.1193, lng: -73.1227 },
    { name: 'Floridablanca', department: 'Santander', lat: 7.0639, lng: -73.0898 },
    { name: 'Girón', department: 'Santander', lat: 7.0750, lng: -73.1670 },
    { name: 'Piedecuesta', department: 'Santander', lat: 6.9883, lng: -73.0499 },
    { name: 'Barrancabermeja', department: 'Santander', lat: 7.0648, lng: -73.8542 },
    { name: 'San Gil', department: 'Santander', lat: 6.5571, lng: -73.1340 },
    { name: 'Socorro', department: 'Santander', lat: 6.4640, lng: -73.2648 },
    // Sucre
    { name: 'Sincelejo', department: 'Sucre', lat: 9.3047, lng: -75.3978 },
    { name: 'Corozal', department: 'Sucre', lat: 9.3219, lng: -75.2979 },
    // Tolima
    { name: 'Ibagué', department: 'Tolima', lat: 4.4389, lng: -75.2322 },
    { name: 'Espinal', department: 'Tolima', lat: 4.1532, lng: -74.8867 },
    { name: 'Honda', department: 'Tolima', lat: 5.2031, lng: -74.7448 },
    // Valle del Cauca
    { name: 'Cali', department: 'Valle del Cauca', lat: 3.4516, lng: -76.5320 },
    { name: 'Buenaventura', department: 'Valle del Cauca', lat: 3.8801, lng: -77.0311 },
    { name: 'Palmira', department: 'Valle del Cauca', lat: 3.5394, lng: -76.3033 },
    { name: 'Tuluá', department: 'Valle del Cauca', lat: 4.0848, lng: -76.1978 },
    { name: 'Buga', department: 'Valle del Cauca', lat: 3.9001, lng: -76.2992 },
    { name: 'Cartago', department: 'Valle del Cauca', lat: 4.7454, lng: -75.9115 },
    { name: 'Yumbo', department: 'Valle del Cauca', lat: 3.5877, lng: -76.4951 },
    { name: 'Jamundí', department: 'Valle del Cauca', lat: 3.2629, lng: -76.5381 },
    // Vaupés
    { name: 'Mitú', department: 'Vaupés', lat: 1.1983, lng: -70.1737 },
    // Vichada
    { name: 'Puerto Carreño', department: 'Vichada', lat: 6.1888, lng: -67.4861 },
];

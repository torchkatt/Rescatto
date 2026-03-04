import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { AuditLog } from '../types';

// Simple in-memory cache for IP to avoid spamming the API
let cachedIp: string | null = null;

export const loggerService = {
    logAction: async (
        action: string,
        performedBy: string,
        targetId?: string,
        targetCollection?: string,
        details?: any
    ) => {
        try {
            // 1. Get IP if not cached
            if (!cachedIp) {
                try {
                    const res = await fetch('https://api.ipify.org?format=json');
                    if (res.ok) {
                        const data = await res.json();
                        cachedIp = data.ip;
                    }
                } catch (e) {
                    console.warn('Could not fetch IP for audit log');
                }
            }

            // 2. Prepare Metadata
            const userAgent = navigator.userAgent;
            const isMobile = /Mobile|Android|iPhone/i.test(userAgent);

            const logEntry: Omit<AuditLog, 'id'> = {
                action,
                performedBy,
                targetId,
                targetCollection,
                details,
                timestamp: new Date().toISOString(),
                metadata: {
                    ip: cachedIp || 'Unknown',
                    userAgent,
                    device: isMobile ? 'Mobile' : 'Desktop',
                    location: 'Unknown' // Ideally would come from IP Geolocation API (requires key)
                }
            };

            await addDoc(collection(db, 'audit_logs'), logEntry);
        } catch (error) {
            console.error('Error logging action:', error);
            // We don't want to break the app if logging fails, but we should know about it
        }
    },

    // Function to get logs could go here (for the viewer)
    // For now we just implement writing
};

import { useState, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: any) => void;
}

/**
 * Custom hook to handle operations with exponential backoff retries.
 * Useful for critical network calls like placing orders or processing payments.
 */
export function useRetry() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const executeWithRetry = useCallback(async <T>(
        fn: () => Promise<T>,
        options: RetryOptions = {}
    ): Promise<T> => {
        const {
            maxRetries = 3,
            initialDelay = 1000,
            backoffFactor = 2,
            onRetry
        } = options;

        setLoading(true);
        setError(null);

        let lastError: any;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                setLoading(false);
                return result;
            } catch (err: any) {
                lastError = err;
                
                if (attempt < maxRetries) {
                    const delay = initialDelay * Math.pow(backoffFactor, attempt);
                    const jitter = Math.random() * 200; // Add small jitter
                    
                    logger.warn(`Operation failed. Retrying in ${Math.round(delay + jitter)}ms... (Attempt ${attempt + 1}/${maxRetries})`, err);
                    
                    if (onRetry) onRetry(attempt + 1, err);
                    
                    await new Promise(resolve => setTimeout(resolve, delay + jitter));
                }
            }
        }

        setError(lastError);
        setLoading(false);
        throw lastError;
    }, []);

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    return { executeWithRetry, loading, error, cancel };
}

export default useRetry;

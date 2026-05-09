import { useState, useCallback, useRef, useEffect } from 'react';
import {
    getDocs,
    QueryConstraint,
    Query,
    DocumentData,
    QueryDocumentSnapshot,
    startAfter,
    limit,
} from 'firebase/firestore';

interface UsePaginatedQueryOptions<T> {
    pageSize?: number;
    transform?: (doc: QueryDocumentSnapshot<DocumentData>) => T;
}

interface UsePaginatedQueryResult<T> {
    data: T[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    refresh: () => Promise<void>;
}

/**
 * Hook genérico de paginación por cursor para Firestore.
 *
 * @param buildQuery  Función que recibe constraints extra (startAfter, limit ya inyectados)
 *                    y retorna un Query. No incluir limit/startAfter en el buildQuery base.
 * @param options     pageSize (default 20), transform (doc → T)
 *
 * @example
 * const { data, loading, hasMore, loadMore } = usePaginatedQuery(
 *   (extra) => query(collection(db, 'orders'), where('userId', '==', uid), orderBy('createdAt', 'desc'), ...extra),
 *   { pageSize: 10, transform: (doc) => ({ id: doc.id, ...doc.data() } as Order) }
 * );
 */
export function usePaginatedQuery<T = DocumentData & { id: string }>(
    buildQuery: (extraConstraints: QueryConstraint[]) => Query,
    options: UsePaginatedQueryOptions<T> = {}
): UsePaginatedQueryResult<T> {
    const { pageSize = 20, transform } = options;

    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
    const abortRef = useRef(false);
    const optionsRef = useRef(options);
    
    // Sincronizar options sin disparar re-renders innecesarios
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    const defaultTransform = (doc: QueryDocumentSnapshot<DocumentData>): T =>
        ({ id: doc.id, ...doc.data() } as unknown as T);

    const fetchPage = useCallback(
        async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
            const currentOptions = optionsRef.current;
            const toItem = currentOptions.transform ?? defaultTransform;
            const pSize = currentOptions.pageSize ?? pageSize;

            const extra: QueryConstraint[] = [limit(pSize)];
            if (cursor) extra.push(startAfter(cursor));
            const snap = await getDocs(buildQuery(extra));
            const items = snap.docs.map(toItem);
            lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
            return { items, exhausted: snap.docs.length < pSize };
        },
        [buildQuery, pageSize]
    );

    const refresh = useCallback(async () => {
        if (loading && !isFirstRun.current) return;
        isFirstRun.current = false;
        
        abortRef.current = false;
        lastDocRef.current = null;
        setLoading(true);
        setHasMore(true);
        try {
            const result = await fetchPage(null);
            if (abortRef.current) return;
            setData(result.items);
            setHasMore(!result.exhausted);
        } catch (err) {
            console.error('[usePaginatedQuery] Refresh error:', err);
            // No re-lanzamos para evitar que el loop de React explote, 
            // el usuario verá que dejó de cargar.
        } finally {
            if (!abortRef.current) setLoading(false);
        }
    }, [fetchPage, loading]);

    const isFirstRun = useRef(true);

    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            const result = await fetchPage(lastDocRef.current);
            if (abortRef.current) return;
            setData(prev => [...prev, ...result.items]);
            setHasMore(!result.exhausted);
        } catch (err) {
            console.error('[usePaginatedQuery] LoadMore error:', err);
        } finally {
            if (!abortRef.current) setLoadingMore(false);
        }
    }, [hasMore, loadingMore, fetchPage]);

    // Carga inicial y recarga cuando cambia buildQuery (p.ej. al cambiar filtros)
    useEffect(() => {
        refresh();
        return () => { abortRef.current = true; };
    }, [refresh]);

    return { data, loading, loadingMore, hasMore, loadMore, refresh };
}

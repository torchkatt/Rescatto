import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface PaginatedResult<T> {
    data: T[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
}

interface UseAdminTableOptions<T> {
    /** Función que fetcha una página de datos. Recibe (pageSize, cursor, searchTerm) */
    fetchFn: (
        pageSize: number,
        cursor: any | null,
        searchTerm: string
    ) => Promise<PaginatedResult<T>>;
    /** Función que devuelve el total de registros. Recibe (searchTerm) */
    countFn?: (searchTerm: string) => Promise<number>;
    initialPageSize?: number;
    searchDebounceMs?: number;
    dependencies?: any[];
}

interface UseAdminTableReturn<T> {
    // Data
    data: T[];
    totalItems: number;
    // Pagination
    currentPage: number;
    pageSize: number;
    // State
    isLoading: boolean;
    isSearching: boolean;
    // Search
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    // Handlers para DataTable
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    // Manual refresh
    reload: () => void;
    // Internal state updates (for optimistic updates or manual changes)
    setData: React.Dispatch<React.SetStateAction<T[]>>;
    hasMore: boolean;
}

export function useAdminTable<T>({
    fetchFn,
    countFn,
    initialPageSize = 20,
    searchDebounceMs = 500,
    dependencies = []
}: UseAdminTableOptions<T>): UseAdminTableReturn<T> {
    const [data, setData] = useState<T[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [searchTerm, setSearchTermState] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [pageCursors, setPageCursors] = useState<Record<number, any | null>>({});
    const [hasMore, setHasMore] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstRun = useRef(true);

    const loadPage = useCallback(async (page: number, size: number, term: string, cursors: Record<number, any>) => {
        const isSearch = term.length > 0;
        // Solo mostrar skeleton si no estamos buscando (la búsqueda tiene su propio spinner inline)
        if (!isSearch) setIsLoading(true);

        try {
            // Fetch count on page 1 only if no search is active
            if (page === 1 && countFn && !isSearch) {
                const count = await countFn(term);
                setTotalItems(count);
            }

            const cursor = page > 1 ? (cursors[page] ?? null) : null;
            const result = await fetchFn(size, cursor, term);

            setData(result.data);

            // If search mode, totalItems is just the length of returned data
            if (isSearch) {
                setTotalItems(result.data.length);
            }

            // Store cursor for next page
            if (result.hasMore && result.lastDoc) {
                setPageCursors(prev => ({ ...prev, [page + 1]: result.lastDoc }));
            }

            setHasMore(result.hasMore);
            setCurrentPage(page);
        } catch (err) {
            console.error('[useAdminTable] Error loading page:', err);
        } finally {
            setIsLoading(false);
            setIsSearching(false);
        }
    }, [fetchFn, countFn]);

    // Initial load and dependency changes
    useEffect(() => {
        setPageCursors({});
        loadPage(1, pageSize, searchTerm, {});
    }, [pageSize, ...dependencies || []]); // eslint-disable-line react-hooks/exhaustive-deps

    const setSearchTerm = useCallback((term: string) => {
        setSearchTermState(term);
        if (term) setIsSearching(true);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPageCursors({});
            loadPage(1, pageSize, term, {});
        }, term ? searchDebounceMs : 0); // No delay if clearing search
    }, [loadPage, pageSize, searchDebounceMs]);

    const onPageChange = useCallback((page: number) => {
        loadPage(page, pageSize, searchTerm, pageCursors);
    }, [loadPage, pageSize, searchTerm, pageCursors]);

    const onPageSizeChange = useCallback((size: number) => {
        setPageSize(size);
        setPageCursors({});
        loadPage(1, size, searchTerm, {});
    }, [loadPage, searchTerm]);

    const reload = useCallback(() => {
        setPageCursors({});
        loadPage(currentPage, pageSize, searchTerm, pageCursors);
    }, [loadPage, currentPage, pageSize, searchTerm, pageCursors]);

    return {
        data,
        totalItems,
        currentPage,
        pageSize,
        isLoading,
        isSearching,
        searchTerm,
        setSearchTerm,
        onPageChange,
        onPageSizeChange,
        reload,
        setData,
        hasMore
    };
}

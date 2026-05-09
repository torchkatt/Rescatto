/**
 * searchUtils.ts
 * 
 * Utilidades reutilizables para búsqueda en memoria sobre arrays de datos.
 * Elimina la repetición del patrón de filtrado en los métodos paginados de servicios.
 */

/** Forma estándar de retorno para resultados paginados */
export interface PaginatedSearchResult<T> {
    data: T[];
    lastDoc: any | null;
    hasMore: boolean;
}

/**
 * Filtra un array de objetos `T` por un término de búsqueda,
 * buscando en los campos especificados de forma dinámica y type-safe.
 *
 * @param items - Array de elementos a filtrar
 * @param searchTerm - Término de búsqueda (puede estar vacío)
 * @param fields - Campos del tipo T en los que se buscará (type-safe con keyof T)
 * @returns Resultado paginado estándar con `lastDoc: null` y `hasMore: false`
 *
 * @example
 * const result = inMemorySearch(allDrivers, 'alex', ['fullName', 'email', 'city', 'id']);
 * // Returns: { data: [...], lastDoc: null, hasMore: false }
 */
export function inMemorySearch<T extends Record<string, any>>(
    items: T[],
    searchTerm: string,
    fields: (keyof T)[]
): PaginatedSearchResult<T> {
    const lowTerm = searchTerm.toLowerCase().trim();

    const filtered = lowTerm
        ? items.filter(item =>
            fields.some(field => {
                const value = item[field];
                return value != null && String(value).toLowerCase().includes(lowTerm);
            })
        )
        : items;

    return { data: filtered, lastDoc: null, hasMore: false };
}

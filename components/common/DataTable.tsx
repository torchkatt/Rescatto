import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, X, Download } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

export interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    render?: (value: any, item: T) => React.ReactNode;
    sortable?: boolean;
    sortKey?: string;
    className?: string;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    searchTerm?: string;
    onSearchChange?: (val: string) => void;
    placeholder?: string;
    pageSizeOptions?: number[];
    initialPageSize?: number;
    onRowClick?: (item: T) => void;
    selectable?: boolean;
    selectedIds?: Set<string>;
    onSelectToggle?: (id: string) => void;
    onSelectAll?: () => void;
    isItemSelectable?: (item: T) => boolean;
    idAccessor?: keyof T;
    isLoading?: boolean;
    className?: string;
    // Server-side pagination props
    manualPagination?: boolean;
    totalItems?: number;
    currentPage?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    isSearching?: boolean;
    headerSlot?: React.ReactNode;
    exportable?: boolean;
    exportFilename?: string;
    exportTransformer?: (item: T) => Record<string, any>;
}

export function DataTable<T extends { [key: string]: any }>({
    data,
    columns,
    searchTerm = '',
    onSearchChange,
    placeholder = 'Buscar...',
    pageSizeOptions = [10, 20, 30, 40, 50],
    initialPageSize = 20,
    onRowClick,
    selectable = false,
    selectedIds = new Set(),
    onSelectToggle,
    onSelectAll,
    isItemSelectable = () => true,
    idAccessor = 'id' as keyof T,
    isLoading = false,
    className = '',
    manualPagination = false,
    totalItems = 0,
    currentPage: externalPage,
    onPageChange,
    onPageSizeChange,
    isSearching = false,
    headerSlot,
    exportable = false,
    exportFilename = 'export',
    exportTransformer
}: DataTableProps<T>) {
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [localPage, setLocalPage] = useState(1);
    
    // Sync internal pageSize state with initialPageSize prop when it changes from outside
    React.useEffect(() => {
        setPageSize(initialPageSize);
    }, [initialPageSize]);
    
    const currentPage = manualPagination ? (externalPage || 1) : localPage;
    const setCurrentPage = manualPagination ? (onPageChange || (() => {})) : setLocalPage;
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
        if (manualPagination && onPageSizeChange) {
            onPageSizeChange(newSize);
        }
    };

    // 1. Filtering (Client-side omni-search)
    const filteredData = useMemo(() => {
        if (manualPagination) return data; // Server already filtered
        if (!searchTerm) return data;
        const lowSearch = searchTerm.toLowerCase();
        
        return data.filter(item => {
            // Check all values in the object for a match
            return Object.values(item).some(val => {
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(lowSearch);
            });
        });
    }, [data, searchTerm, manualPagination]);

    // 2. Sorting
    const sortedData = useMemo(() => {
        if (!sortConfig) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortConfig]);

    // 3. Pagination
    const totalPages = Math.max(1, Math.ceil((manualPagination ? totalItems : sortedData.length) / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedData = manualPagination 
        ? sortedData 
        : sortedData.slice((safePage - 1) * pageSize, safePage * pageSize);

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                return null;
            }
            return { key, direction: 'asc' };
        });
    };

    const getPageNumbers = () => {
        const delta = 2;
        const pages: (number | '...')[] = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= safePage - delta && i <= safePage + delta)) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }
        return pages;
    };

    const selectableItemsInPage = paginatedData.filter(isItemSelectable);
    const allSelectedInPage = selectableItemsInPage.length > 0 && 
        selectableItemsInPage.every(item => selectedIds.has(item[idAccessor]));

    const handleExport = () => {
        const dataToExport = manualPagination ? data : filteredData;
        
        // Auto-derive exportable columns from Column[]
        const exportableCols = columns.filter(
            col => typeof col.accessor === 'string' && col.header
        );

        if (exportableCols.length === 0) return;
        
        const headers = exportableCols.map(c => c.header).join(',');
        const rows = dataToExport.map(item => {
            // Use exportTransformer if exists, otherwise use raw item
            const transformed = exportTransformer ? exportTransformer(item) : item;
            return exportableCols.map(col => {
                const key = col.accessor as string;
                const val = transformed[key];
                // Escape quotes and wrap in quotes if contains comma or newline
                const str = String(val ?? '').replace(/"/g, '""');
                return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
            }).join(',');
        });
        
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${exportFilename}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-50 overflow-hidden flex flex-col ${className}`}>
            {/* Header / Search Area */}
            <div className="p-4 border-b border-gray-50 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 max-w-md focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                        {isSearching ? (
                            <div className="shrink-0 w-[18px] h-[18px] border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Search className="text-gray-400 shrink-0" size={18} />
                        )}
                        <input
                            type="text"
                            placeholder={placeholder}
                            className="flex-1 outline-none text-gray-700 bg-transparent text-sm"
                            value={searchTerm}
                            onChange={(e) => {
                                onSearchChange?.(e.target.value);
                                if (!manualPagination) {
                                    setCurrentPage(1);
                                }
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => {
                                    onSearchChange?.('');
                                    if (!manualPagination) {
                                        setCurrentPage(1);
                                    }
                                }}
                                className="p-1 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                                title="Limpiar búsqueda"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Mostrar:</span>
                        <select 
                            value={pageSize} 
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))} 
                            className="text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 cursor-pointer hover:border-emerald-400 transition-colors outline-none"
                        >
                            {pageSizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {exportable && (
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-white border border-gray-200 rounded-lg hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95"
                            title="Exportar datos visibles a CSV"
                        >
                            <Download size={14} />
                            CSV
                        </button>
                    )}

                    <div className="text-xs font-medium text-gray-400 whitespace-nowrap flex items-center gap-2">
                        {(() => {
                            const total = manualPagination ? totalItems : filteredData.length;
                            const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
                            const end = manualPagination 
                                ? Math.min(safePage * pageSize, totalItems) 
                                : Math.min(safePage * pageSize, filteredData.length);
                            return total === 0 
                                ? 'Sin resultados' 
                                : `Mostrando ${start}-${end} de ${total}`;
                        })()}
                        {searchTerm && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold uppercase tracking-wider">
                                Filtrado
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Slot para filtros externos del módulo */}
            {headerSlot && (
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/30">
                    {headerSlot}
                </div>
            )}

            {/* Table Area */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            {selectable && (
                                <th className="px-6 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={allSelectedInPage}
                                        onChange={onSelectAll}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer transition-all"
                                    />
                                </th>
                            )}
                            {columns.map((col, idx) => {
                                const sortKey = col.sortKey || (typeof col.accessor === 'string' ? col.accessor as string : '');
                                const isSorted = sortConfig?.key === sortKey;
                                
                                return (
                                    <th 
                                        key={idx} 
                                        className={`px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest ${col.sortable ? 'cursor-pointer hover:text-emerald-600 transition-colors' : ''} ${col.className || ''}`}
                                        onClick={() => col.sortable && sortKey && handleSort(sortKey)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {col.header}
                                            {col.sortable && sortKey && (
                                                <div className="flex flex-col shrink-0">
                                                    <ChevronUp size={10} className={`${isSorted && sortConfig?.direction === 'asc' ? 'text-emerald-600' : 'text-gray-300'}`} />
                                                    <ChevronDown size={10} className={`${isSorted && sortConfig?.direction === 'desc' ? 'text-emerald-600' : 'text-gray-300'}`} />
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {selectable && <td className="px-6 py-4"><div className="h-4 w-4 bg-gray-100 rounded"></div></td>}
                                    {columns.map((_, idx) => (
                                        <td key={idx} className="px-6 py-4"><div className="h-4 bg-gray-50 rounded w-full"></div></td>
                                    ))}
                                </tr>
                            ))
                        ) : paginatedData.length > 0 ? (
                            paginatedData.map((item, rowIndex) => (
                                <tr 
                                    key={item[idAccessor] || rowIndex} 
                                    className={`group hover:bg-emerald-50/30 transition-colors cursor-pointer ${selectedIds.has(item[idAccessor]) ? 'bg-emerald-50/50' : ''}`}
                                    onClick={() => onRowClick?.(item)}
                                >
                                    {selectable && (
                                        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(item[idAccessor])}
                                                onChange={() => onSelectToggle?.(item[idAccessor])}
                                                disabled={!isItemSelectable(item)}
                                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                            />
                                        </td>
                                    )}
                                    {columns.map((col, colIdx) => (
                                        <td key={colIdx} className={`px-6 py-4 text-sm text-gray-600 font-medium ${col.className || ''}`}>
                                            {col.render
                                                ? col.render(typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor], item)
                                                : typeof col.accessor === 'function'
                                                    ? col.accessor(item)
                                                    : (item[col.accessor] ?? '-')}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-6 py-12">
                                    <EmptyState
                                        icon={<Search size={48} />}
                                        title={searchTerm ? `No se encontraron resultados para "${searchTerm}"` : 'No hay datos disponibles'}
                                        description={searchTerm ? 'Prueba ajustando los filtros o el término de búsqueda' : 'No hay información para mostrar en este momento'}
                                        action={searchTerm ? {
                                            label: 'Limpiar búsqueda',
                                            onClick: () => onSearchChange?.(''),
                                            variant: 'outline'
                                        } : undefined}
                                        size="md"
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="p-4 border-t bg-gray-50/50 flex items-center justify-between">
                    <div className="hidden sm:block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Página {safePage} de {totalPages}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={safePage === 1}
                            className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                            disabled={safePage === 1}
                            className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center gap-1 mx-2">
                            {getPageNumbers().map((p, i) => (
                                p === '...' ? (
                                    <span key={i} className="px-2 text-gray-400">...</span>
                                ) : (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(p as number)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${safePage === p 
                                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                                            : 'hover:bg-white text-gray-500'}`}
                                    >
                                        {p}
                                    </button>
                                )
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                            disabled={safePage === totalPages}
                            className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={safePage === totalPages}
                            className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

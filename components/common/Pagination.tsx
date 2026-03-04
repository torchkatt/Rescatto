import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    className = ''
}) => {
    if (totalPages <= 1) return null;

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    // Logic to show a window of pages can be added here for very large page counts
    // For now, simple list is fine or a small window logic

    return (
        <div className={`flex items-center justify-center space-x-2 mt-6 ${className}`}>
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
            >
                <ChevronLeft size={20} className="text-gray-600" />
            </button>

            <div className="flex items-center space-x-1">
                {pages.map(page => {
                    // Simple windowing logic
                    if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                        return (
                            <button
                                key={page}
                                onClick={() => onPageChange(page)}
                                className={`w-10 h-10 rounded-lg font-medium transition-colors ${currentPage === page
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200'
                                    }`}
                            >
                                {page}
                            </button>
                        );
                    } else if (
                        page === currentPage - 2 ||
                        page === currentPage + 2
                    ) {
                        return <span key={page} className="text-gray-400">...</span>;
                    }
                    return null;
                })}
            </div>

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
            >
                <ChevronRight size={20} className="text-gray-600" />
            </button>
        </div>
    );
};

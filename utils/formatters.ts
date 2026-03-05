const copNumberFormatter = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
});

export const formatCOP = (value: number): string => {
    const safeValue = Number.isFinite(value) ? value : 0;
    return `$${copNumberFormatter.format(Math.round(safeValue))}`;
};

export const formatKgCO2 = (value: number): string => {
    const safeValue = Number.isFinite(value) ? value : 0;
    const rounded = Math.round(safeValue * 10) / 10;
    return `${rounded.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg de CO₂`;
};

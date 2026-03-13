import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCOP } from '../utils/formatters';

export const reportService = {
  generateVenueFinancialPDF: (data: any, venueName: string) => {
    const doc = new jsPDF();
    const { summary, period } = data;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald-500
    doc.text('RESCATTO - Reporte Financiero', 20, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 116, 139); // Gray-500
    doc.text(`Sede: ${venueName}`, 20, 30);
    doc.text(`Periodo: ${period.label}`, 20, 38);

    // Summary Cards Section
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 48, 170, 40, 3, 3, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('RESUMEN DEL MES', 25, 58);

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(`Ventas Brutas: ${formatCOP(summary.grossSales)}`, 25, 70);
    doc.setTextColor(16, 185, 129);
    doc.text(`Ganancia Neta: ${formatCOP(summary.netEarnings)}`, 25, 80);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Órdenes: ${summary.totalOrders}`, 120, 70);
    doc.text(`Comisiones: ${formatCOP(summary.platformFees)}`, 120, 80);

    // Impact Section
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(20, 95, 170, 30, 3, 3, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFontSize(12);
    doc.text('IMPACTO AMBIENTAL Y SOCIAL', 25, 105);
    doc.setFontSize(10);
    doc.text(`CO2 Salvado: ${summary.co2Saved.toFixed(2)}kg`, 25, 115);
    doc.text(`Ahorro para Clientes: ${formatCOP(summary.moneySavedForCustomers)}`, 100, 115);

    // Details Table
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.text('Detalle de Órdenes Completadas', 20, 140);

    const tableRows = data.orders.map((o: any) => [
      o.id.substring(0, 8),
      new Date(o.createdAt).toLocaleDateString(),
      o.customerName,
      formatCOP(o.totalAmount),
      formatCOP(o.venueEarnings)
    ]);

    autoTable(doc, {
      startY: 145,
      head: [['ID', 'Fecha', 'Cliente', 'Total', 'Ganancia']],
      body: tableRows,
      headStyles: { fillColor: [16, 185, 129] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 20, right: 20 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Generado por Rescatto Business - ${new Date().toLocaleString()}`,
        20,
        doc.internal.pageSize.height - 10
      );
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.width - 40,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`Rescatto_Reporte_${venueName}_${period.year}_${period.month + 1}.pdf`);
  }
};

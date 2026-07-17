import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { sellerService } from '../../services/sellerService';
import { useAdminTable } from '../../hooks/useAdminTable';
import { Seller, SellerType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { DataTable } from '../../components/common/DataTable';
import { formatCOP } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import {
  Store,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  MapPin,
  ShoppingBag,
  DollarSign,
  Eye,
  ToggleLeft,
  ToggleRight,
  Tag,
} from 'lucide-react';
import { getCountFromServer, collection } from 'firebase/firestore';
import { db } from '../../services/firebase';

type FilterTab = 'all' | 'food' | 'retail' | 'service' | 'individual';

const TYPE_LABELS: Record<SellerType, string> = {
  [SellerType.FOOD]: 'Comida',
  [SellerType.RETAIL]: 'Retail',
  [SellerType.SERVICE]: 'Servicio',
  [SellerType.INDIVIDUAL]: 'Individual',
};

const TYPE_COLORS: Record<SellerType, string> = {
  [SellerType.FOOD]: 'bg-orange-50 text-orange-700 border-orange-100',
  [SellerType.RETAIL]: 'bg-blue-50 text-blue-700 border-blue-100',
  [SellerType.SERVICE]: 'bg-purple-50 text-purple-700 border-purple-100',
  [SellerType.INDIVIDUAL]: 'bg-teal-50 text-teal-700 border-teal-100',
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  free: 'Gratis',
  seller_pass_monthly: 'Pass Mensual',
  seller_pass_annual: 'Pass Anual',
};

const SUBSCRIPTION_COLORS: Record<string, string> = {
  free: 'bg-gray-50 text-gray-600 border-gray-100',
  seller_pass_monthly: 'bg-amber-50 text-amber-700 border-amber-100',
  seller_pass_annual: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

export const SellersManager: React.FC = () => {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const searchResultsRef = React.useRef<Seller[]>([]);

  const table = useAdminTable<Seller>({
    fetchFn: async (size, cursor, term) => {
      // If searching, use sellerService.search (loads up to 100, filter client-side)
      if (term) {
        let data = searchResultsRef.current;
        // Only re-fetch if cursor is null (first page or new search)
        if (cursor === null || cursor === undefined) {
          const results = await sellerService.search(term);
          data = filterTab === 'all'
            ? results
            : results.filter(s => s.type === filterTab);
          searchResultsRef.current = data;
        }
        // Client-side pagination for search results
        const start = cursor ? parseInt(String(cursor), 10) : 0;
        const page = data.slice(start, start + size);
        return {
          data: page,
          lastDoc: (start + size < data.length ? String(start + size) : null) as any,
          hasMore: start + size < data.length,
        };
      }

      // Normal pagination via Firestore cursor
      searchResultsRef.current = [];
      const result = await sellerService.getPage(undefined, cursor, size);

      let data = result.sellers;
      if (filterTab !== 'all') {
        data = data.filter(s => s.type === filterTab);
      }

      return {
        data,
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
      };
    },
    countFn: async (term) => {
      try {
        if (term) {
          const results = await sellerService.search(term);
          return filterTab === 'all'
            ? results.length
            : results.filter(s => s.type === filterTab).length;
        }
        const snap = await getCountFromServer(collection(db, 'sellers'));
        return snap.data().count;
      } catch {
        return 0;
      }
    },
    initialPageSize: 20,
    dependencies: [filterTab],
  });

  const summary = useMemo(() => {
    const active = table.data.filter(s => s.isActive);
    const inactive = table.data.filter(s => !s.isActive);
    const totalTransactions = table.data.reduce((sum, s) => sum + (s.stats?.totalTransactions || 0), 0);
    const totalRevenue = table.data.reduce((sum, s) => sum + (s.stats?.totalRevenue || 0), 0);
    return { active: active.length, inactive: inactive.length, totalTransactions, totalRevenue };
  }, [table.data]);

  const handleToggleActive = async (seller: Seller) => {
    const newState = !seller.isActive;
    const confirmed = await confirm({
      title: newState ? 'Activar vendedor' : 'Desactivar vendedor',
      message: newState
        ? `¿Activar a ${seller.name}? Sus productos volverán a estar visibles.`
        : `¿Desactivar a ${seller.name}? Sus productos dejarán de mostrarse.`,
      confirmLabel: newState ? 'Activar' : 'Desactivar',
      variant: newState ? 'info' : 'warning',
    });
    if (!confirmed) return;

    try {
      await sellerService.update(seller.id, { isActive: newState });
      toast.success(newState ? 'Vendedor activado' : 'Vendedor desactivado');
      table.setData(prev =>
        prev.map(s => (s.id === seller.id ? { ...s, isActive: newState } : s))
      );
    } catch (err) {
      logger.error('Error toggling seller active state:', err);
      toast.error('Error al actualizar el estado del vendedor');
    }
  };

  const handleEdit = (seller: Seller) => {
    // Navigate to seller detail/edit page — using venues as fallback route
    navigate(`/admin/sellers/${seller.id}`);
  };

  if (table.isLoading && table.data.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
            <Store className="text-indigo-600" size={28} />
            Vendedores
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Administra los vendedores del marketplace
          </p>
        </div>
        <button
          onClick={() => table.reload()}
          disabled={table.isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: table.data.length, icon: <Store size={16} />, color: 'bg-gray-100 text-gray-700' },
          { label: 'Activos', value: summary.active, icon: <CheckCircle size={16} />, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Inactivos', value: summary.inactive, icon: <XCircle size={16} />, color: 'bg-red-50 text-red-700' },
          { label: 'Transacciones', value: summary.totalTransactions, icon: <ShoppingBag size={16} />, color: 'bg-purple-50 text-purple-700' },
          { label: 'Ingresos', value: formatCOP(summary.totalRevenue), icon: <DollarSign size={16} />, color: 'bg-amber-50 text-amber-700' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl p-3 ${stat.color} border border-current/10`}>
            <div className="flex items-center gap-1.5 mb-1 opacity-70">
              {stat.icon}
              <span className="text-[10px] font-bold uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className="text-lg font-extrabold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="search"
            placeholder="Buscar por nombre, ciudad..."
            value={table.searchTerm}
            onChange={e => table.setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'food', 'retail', 'service', 'individual'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                filterTab === tab
                  ? 'bg-gray-900 text-white border-gray-900 shadow-xl scale-105 z-10'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm'
              }`}
            >
              {tab === 'all' ? 'Todos' : TYPE_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-6 shadow-2xl border border-gray-100">
        <DataTable
          columns={[
            {
              header: 'Vendedor',
              accessor: 'name' as keyof Seller,
              sortable: true,
              render: (value: string, seller: Seller) => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden shadow-lg shadow-indigo-500/20">
                    {seller.logo ? (
                      <img src={seller.logo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      value?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900">{value}</span>
                    <span className="text-[10px] text-gray-400 font-medium truncate max-w-[160px]">
                      {seller.ownerId}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              header: 'Tipo',
              accessor: 'type' as keyof Seller,
              sortable: true,
              render: (value: SellerType) => (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${TYPE_COLORS[value] || 'bg-gray-50 text-gray-600 border-gray-100'}`}
                >
                  <Tag size={12} />
                  {TYPE_LABELS[value] || value}
                </span>
              ),
            },
            {
              header: 'Ciudad',
              accessor: 'location' as keyof Seller,
              className: 'hidden sm:table-cell',
              render: (_: any, seller: Seller) => (
                <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                  <MapPin size={14} className="text-gray-400 shrink-0" />
                  <span>{seller.location?.city || '—'}</span>
                </div>
              ),
            },
            {
              header: 'Suscripción',
              accessor: 'subscription' as keyof Seller,
              sortable: true,
              className: 'hidden md:table-cell',
              render: (value: string) => (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${SUBSCRIPTION_COLORS[value] || 'bg-gray-50 text-gray-600 border-gray-100'}`}
                >
                  {SUBSCRIPTION_LABELS[value] || value}
                </span>
              ),
            },
            {
              header: 'Estado',
              accessor: 'isActive' as keyof Seller,
              sortable: true,
              render: (value: boolean) =>
                value ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    <CheckCircle size={12} />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-widest border border-red-100">
                    <XCircle size={12} />
                    Inactivo
                  </span>
                ),
            },
            {
              header: 'Transacc.',
              accessor: 'stats' as keyof Seller,
              sortable: true,
              className: 'text-right',
              render: (_: any, seller: Seller) => (
                <span className="font-black text-gray-700">
                  {seller.stats?.totalTransactions ?? 0}
                </span>
              ),
            },
            {
              header: 'Acciones',
              accessor: 'id' as keyof Seller,
              className: 'text-right',
              render: (id: string, seller: Seller) => (
                <div className="flex justify-end gap-1">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleEdit(seller);
                    }}
                    className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"
                    title="Editar"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleToggleActive(seller);
                    }}
                    className={`p-2.5 rounded-xl transition-all active:scale-90 ${
                      seller.isActive
                        ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={seller.isActive ? 'Desactivar' : 'Activar'}
                  >
                    {seller.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                </div>
              ),
            },
          ]}
          data={table.data}
          placeholder="Buscar por nombre, ciudad..."
          initialPageSize={table.pageSize}
          manualPagination
          totalItems={table.totalItems}
          currentPage={table.currentPage}
          onPageChange={table.onPageChange}
          onPageSizeChange={table.onPageSizeChange}
          searchTerm={table.searchTerm}
          onSearchChange={table.setSearchTerm}
          isSearching={table.isSearching}
          isLoading={table.isLoading}
          onRowClick={seller => handleEdit(seller)}
          exportable
          exportFilename="rescatto_vendedores"
          exportTransformer={(s: Seller) => ({
            name: s.name || '',
            type: TYPE_LABELS[s.type] || s.type,
            ownerId: s.ownerId || '',
            city: s.location?.city || '',
            subscription: SUBSCRIPTION_LABELS[s.subscription] || s.subscription,
            isActive: s.isActive ? 'Activo' : 'Inactivo',
            totalTransactions: s.stats?.totalTransactions ?? 0,
            totalRevenue: s.stats?.totalRevenue ?? 0,
          })}
        />
      </div>
    </div>
  );
};

export default SellersManager;

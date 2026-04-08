import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
    collection, query, orderBy, getDocs, limit, startAfter,
    DocumentSnapshot, Unsubscribe
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Chat, Message, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { sendMessage, markMessagesAsRead, deleteChat, subscribeToChatMessages } from '../../services/chatService';
import { useConfirm } from '../../context/ConfirmContext';
import { logger } from '../../utils/logger';
import {
    MessageSquare, Search, Send, Trash2, RefreshCw,
    Users, Truck, Store, ShieldCheck, Circle, X,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import MobileDrawer from '../../components/common/MobileDrawer';

// ── helpers ────────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 20, 50];

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    'customer-venue':  { label: 'Cliente ↔ Negocio', icon: <Store size={13} />,       color: 'bg-blue-100 text-blue-700' },
    'customer-driver': { label: 'Cliente ↔ Driver',  icon: <Truck size={13} />,       color: 'bg-amber-100 text-amber-700' },
    'venue-driver':    { label: 'Negocio ↔ Driver',  icon: <Users size={13} />,       color: 'bg-purple-100 text-purple-700' },
    'admin-support':   { label: 'Soporte Admin',      icon: <ShieldCheck size={13} />, color: 'bg-emerald-100 text-emerald-700' },
};

function chatTitle(chat: Chat): string {
    const names = Object.values(chat.participantNames);
    return names.join(' · ') || 'Conversación';
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

// ── Component ──────────────────────────────────────────────────────────────────
export const SupportManager: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();

    // ── Chats data ─────────────────────────────────────────────────────────────
    const [chats, setChats] = useState<Chat[]>([]);
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDocs, setLastDocs] = useState<Record<number, DocumentSnapshot>>({});

    // ── Pagination state ───────────────────────────────────────────────────────
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // ── Chat panel state ───────────────────────────────────────────────────────
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [mobileShowChat, setMobileShowChat] = useState(false);

    // ── Filters ────────────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const unsubMsgsRef   = useRef<Unsubscribe | null>(null);

    // ── Load chats (cursor-based from Firestore) ───────────────────────────────
    const loadChats = useCallback(async (initial = false, size = pageSize) => {
        if (initial) {
            setLoadingChats(true);
            setChats([]);
            setLastDocs({});
            setHasMore(true);
            setCurrentPage(1);
        } else {
            setLoadingMore(true);
        }

        try {
            const currentLastDoc = initial ? null : lastDocs[currentPage - 1];
            
            let q = query(
                collection(db, 'chats'),
                orderBy('updatedAt', 'desc'),
                limit(size)
            );
            
            if (!initial && currentLastDoc) {
                q = query(
                    collection(db, 'chats'),
                    orderBy('updatedAt', 'desc'),
                    startAfter(currentLastDoc),
                    limit(size)
                );
            }
            
            const snap = await getDocs(q);
            const newChats = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Chat[];

            if (initial) {
                setChats(newChats);
            } else {
                setChats(prev => {
                    const existingIds = new Set(prev.map(c => c.id));
                    return [...prev, ...newChats.filter(c => !existingIds.has(c.id))];
                });
            }

            if (snap.docs.length > 0) {
                setLastDocs(prev => ({
                    ...prev,
                    [initial ? 1 : currentPage]: snap.docs[snap.docs.length - 1]
                }));
            }
            
            setHasMore(snap.docs.length === size);
        } catch (err) {
            logger.error('Error cargando chats de soporte:', err);
            toast.error('Error al cargar conversaciones');
        } finally {
            setLoadingChats(false);
            setLoadingMore(false);
        }
    }, [lastDocs, currentPage, pageSize]);

    useEffect(() => { loadChats(true); }, []);

    // ── Messages subscription ──────────────────────────────────────────────────
    useEffect(() => {
        if (unsubMsgsRef.current) { unsubMsgsRef.current(); unsubMsgsRef.current = null; }
        if (!selectedChat) { setMessages([]); return; }
        setLoadingMessages(true);
        unsubMsgsRef.current = subscribeToChatMessages(selectedChat.id, msgs => {
            setMessages(msgs);
            setLoadingMessages(false);
            if (user) markMessagesAsRead(selectedChat.id, user.id).catch(() => {});
        });
        return () => { if (unsubMsgsRef.current) unsubMsgsRef.current(); };
    }, [selectedChat?.id]);

    // Auto-scroll al último mensaje
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Derived data ───────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = chats;
        if (filterType !== 'all') list = list.filter(c => c.type === filterType);
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(c =>
                Object.values(c.participantNames).some(n => n.toLowerCase().includes(q)) ||
                c.metadata?.customerName?.toLowerCase().includes(q) ||
                c.metadata?.venueName?.toLowerCase().includes(q) ||
                c.metadata?.driverName?.toLowerCase().includes(q) ||
                c.orderId?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [chats, filterType, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const needsMoreData = hasMore && safePage === totalPages && filtered.length > 0 && filtered.length % pageSize === 0;

    const stats = useMemo(() => ({
        total: chats.length,
        unread: chats.filter(c => !c.lastMessage.read && c.lastMessage.senderId !== user?.id && c.lastMessage.senderId !== '').length,
        byType: Object.fromEntries(Object.keys(TYPE_LABELS).map(t => [t, chats.filter(c => c.type === t).length])),
    }), [chats, user?.id]);

    const goToPage = async (page: number) => {
        const target = Math.max(1, Math.min(page, totalPages));
        if (needsMoreData && target === totalPages) {
            await loadChats(false);
        }
        setCurrentPage(target);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        loadChats(true, size);
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

    // ── Actions ────────────────────────────────────────────────────────────────
    const handleSend = async () => {
        if (!selectedChat || !newMessage.trim() || !user) return;
        setSending(true);
        try {
            await sendMessage(selectedChat.id, user.id, user.fullName || 'Soporte', UserRole.SUPER_ADMIN, newMessage.trim());
            setNewMessage('');
        } catch (err) {
            logger.error('Error enviando mensaje:', err);
            toast.error('Error al enviar el mensaje');
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (chat: Chat) => {
        const confirmed = await confirm({
            title: 'Eliminar conversación',
            message: `¿Eliminar esta conversación con ${chatTitle(chat)}? Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            variant: 'danger',
        });
        if (!confirmed) return;
        try {
            await deleteChat(chat.id);
            if (selectedChat?.id === chat.id) { setSelectedChat(null); setMobileShowChat(false); }
            setChats(prev => prev.filter(c => c.id !== chat.id));
            toast.success('Conversación eliminada');
        } catch (err) {
            logger.error('Error eliminando chat:', err);
            toast.error('Error al eliminar la conversación');
        }
    };

    const selectChat = (chat: Chat) => {
        setSelectedChat(chat);
        setMobileShowChat(true);
    };

    const handleSearch = (v: string) => { setSearchTerm(v); setCurrentPage(1); };
    const handleFilter = (t: string) => { setFilterType(t); setCurrentPage(1); };

    const ChatPanelContent = () => {
        if (!selectedChat) return null;
        return (
            <div className="flex flex-col h-full bg-white">
                {/* Chat header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate text-sm">{chatTitle(selectedChat)}</p>
                            {selectedChat.orderId && (
                                <p className="text-xs text-gray-400">Pedido #{selectedChat.orderId.slice(-6).toUpperCase()}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${TYPE_LABELS[selectedChat.type]?.color}`}>
                            {TYPE_LABELS[selectedChat.type]?.icon}
                            {TYPE_LABELS[selectedChat.type]?.label}
                        </span>
                        <button
                            onClick={() => handleDelete(selectedChat)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors ml-1"
                            title="Eliminar conversación"
                        >
                            <Trash2 size={15} />
                        </button>
                        <button className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" onClick={() => setMobileShowChat(false)}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Mensajes */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/30 min-h-0">
                    {loadingMessages ? (
                        <div className="flex justify-center items-center h-32">
                            <RefreshCw size={20} className="animate-spin text-gray-400" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-8">Sin mensajes aún</div>
                    ) : messages.map(msg => {
                        const isMsgFromMe = msg.senderId === user?.id;
                        const isSystem = msg.type === 'system' || msg.senderId === 'system';
                        if (isSystem) return (
                            <div key={msg.id} className="flex justify-center">
                                <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.text}</span>
                            </div>
                        );
                        return (
                            <div key={msg.id} className={`flex ${isMsgFromMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMsgFromMe ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                                    {!isMsgFromMe && <p className="text-[10px] font-bold mb-0.5 opacity-60">{msg.senderName}</p>}
                                    <p className="text-sm leading-relaxed">{msg.text}</p>
                                    <div className="flex items-center justify-end gap-1 mt-1">
                                        <p className={`text-[10px] ${isMsgFromMe ? 'text-white/60' : 'text-gray-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {isMsgFromMe && msg.read && <Circle size={4} className="fill-white/60 text-white/60" />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Escribe un mensaje como soporte..."
                            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-gray-50"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!newMessage.trim() || sending}
                            className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-all active:scale-95 shrink-0"
                            aria-label="Enviar"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4 overflow-x-hidden min-h-screen pb-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                    <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
                        <MessageSquare className="text-emerald-500" size={28} />
                        Gestión de Soporte
                    </h1>
                    <p className="text-gray-400 text-sm mt-0.5">
                        {stats.total}{hasMore ? '+' : ''} conversaciones activas
                        {stats.unread > 0 && <> · <span className="font-bold text-red-500">{stats.unread} sin leer</span></>}
                    </p>
                </div>
                <button
                    onClick={() => loadChats(true)}
                    disabled={loadingChats}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all self-start shrink-0 shadow-sm"
                >
                    <RefreshCw size={14} className={loadingChats ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Dashboard Stats / Info Banner */}
            <div className="bg-emerald-900/40 border border-emerald-800/50 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 shadow-inner">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Centro de Soporte</p>
                        <h3 className="text-lg font-bold text-white">Consola de Administración</h3>
                    </div>
                </div>
                <div className="flex gap-2">
                    {Object.entries(TYPE_LABELS).map(([type, meta]) => (
                        <div key={type} className={`px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2 ${meta.color.replace('bg-', 'bg-opacity-10 bg-')}`}>
                            <span className="text-xs font-bold whitespace-nowrap text-white">{meta.label}</span>
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-black text-white">{stats.byType[type] ?? 0}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-6 items-start">
                {/* Main Content (Table) */}
                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        
                        {/* Table Controls */}
                        <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white w-full sm:w-64 shadow-sm">
                                    <Search className="text-gray-400 shrink-0" size={16} />
                                    <input
                                        type="search"
                                        placeholder="Buscar participante, pedido..."
                                        value={searchTerm}
                                        onChange={e => handleSearch(e.target.value)}
                                        className="w-full outline-none text-gray-700 bg-transparent text-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-gray-500 font-bold">Filas:</span>
                                    <select 
                                        value={pageSize} 
                                        onChange={e => handlePageSizeChange(Number(e.target.value))}
                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                                    >
                                        {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            {/* Filter Chips */}
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() => handleFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all border ${filterType === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Todos
                                </button>
                                {Object.entries(TYPE_LABELS).map(([type, meta]) => (
                                    <button
                                        key={type}
                                        onClick={() => handleFilter(type)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all border ${filterType === type ? 'bg-gray-900 text-white border-gray-900' : `border-transparent ${meta.color} hover:opacity-80`}`}
                                    >
                                        {meta.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Mobile List View */}
                        <div className="block lg:hidden divide-y divide-gray-50">
                            {paginated.map(chat => (
                                <div 
                                    key={chat.id} 
                                    onClick={() => selectChat(chat)}
                                    className={`p-4 active:bg-gray-50 transition-colors ${selectedChat?.id === chat.id ? 'bg-emerald-50/50' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            {!chat.lastMessage.read && chat.lastMessage.senderId !== user?.id && <Circle size={8} className="fill-red-500 text-red-500" />}
                                            <p className={`text-sm font-bold ${!chat.lastMessage.read && chat.lastMessage.senderId !== user?.id ? 'text-gray-900' : 'text-gray-700'}`}>
                                                {chatTitle(chat)}
                                            </p>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-medium">{timeAgo(chat.updatedAt)}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate mb-2">{chat.lastMessage.text || 'Sin mensajes'}</p>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${TYPE_LABELS[chat.type]?.color}`}>
                                            {TYPE_LABELS[chat.type]?.label}
                                        </span>
                                        {chat.orderId && <span className="text-[10px] text-gray-400">#{chat.orderId.slice(-6).toUpperCase()}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase text-gray-400 font-black tracking-widest">
                                        <th className="p-4">Conversación</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Pedido</th>
                                        <th className="p-4">Último Mensaje</th>
                                        <th className="p-4">Actividad</th>
                                        <th className="p-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loadingChats ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center">
                                                <RefreshCw size={32} className="animate-spin text-gray-200 mx-auto" />
                                            </td>
                                        </tr>
                                    ) : paginated.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-gray-400">
                                                <MessageSquare size={48} className="mx-auto mb-3 opacity-10" />
                                                <p className="font-bold">No se encontraron conversaciones</p>
                                            </td>
                                        </tr>
                                    ) : paginated.map(chat => {
                                        const meta = TYPE_LABELS[chat.type] || TYPE_LABELS['admin-support'];
                                        const isUnread = !chat.lastMessage.read && chat.lastMessage.senderId !== user?.id && chat.lastMessage.senderId !== '';
                                        return (
                                            <tr 
                                                key={chat.id}
                                                onClick={() => selectChat(chat)}
                                                className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedChat?.id === chat.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''}`}
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${meta.color}`}>
                                                            {chatTitle(chat).charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`text-sm truncate ${isUnread ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                                                                {chatTitle(chat)}
                                                            </p>
                                                            {isUnread && (
                                                                <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
                                                                    <Circle size={6} className="fill-current" /> Sin leer
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black ${meta.color}`}>
                                                        {meta.icon}
                                                        {meta.label}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {chat.orderId ? (
                                                        <span className="text-xs font-mono font-bold text-gray-500">#{chat.orderId.slice(-6).toUpperCase()}</span>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                                        {chat.lastMessage.text || <span className="italic opacity-50">Sin contenido</span>}
                                                    </p>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-[11px] text-gray-400 font-bold">{timeAgo(chat.updatedAt)}</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(chat); }}
                                                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        {!loadingChats && filtered.length > 0 && (
                            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
                                <p className="text-xs text-gray-400 font-bold">
                                    {loadingMore ? 'Cargando más...' : (
                                        <>Mostrando <span className="text-gray-700">{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}</span> de <span className="text-gray-700">{filtered.length}{hasMore ? '+' : ''}</span> conversaciones</>
                                    )}
                                </p>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => goToPage(1)} disabled={safePage === 1 || loadingMore} className="p-2 rounded-xl text-gray-400 hover:bg-white hover:text-emerald-600 border border-transparent hover:border-gray-200 disabled:opacity-20 transition-all"><ChevronsLeft size={16} /></button>
                                    <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1 || loadingMore} className="p-2 rounded-xl text-gray-400 hover:bg-white hover:text-emerald-600 border border-transparent hover:border-gray-200 disabled:opacity-20 transition-all"><ChevronLeft size={16} /></button>
                                    
                                    <div className="flex items-center px-1">
                                        {getPageNumbers().map((page, idx) => (
                                            page === '...' ? (
                                                <span key={`dots-${idx}`} className="px-2 text-gray-300 text-sm">...</span>
                                            ) : (
                                                <button 
                                                    key={page} 
                                                    onClick={() => goToPage(page as number)}
                                                    className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${safePage === page ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-500 hover:bg-white hover:border-gray-200'}`}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        ))}
                                    </div>

                                    <button onClick={() => goToPage(safePage + 1)} disabled={(safePage >= totalPages && !hasMore) || loadingMore} className="p-2 rounded-xl text-gray-400 hover:bg-white hover:text-emerald-600 border border-transparent hover:border-gray-200 disabled:opacity-20 transition-all"><ChevronRight size={16} /></button>
                                    <button onClick={() => goToPage(totalPages)} disabled={(safePage >= totalPages && !hasMore) || loadingMore} className="p-2 rounded-xl text-gray-400 hover:bg-white hover:text-emerald-600 border border-transparent hover:border-gray-200 disabled:opacity-20 transition-all"><ChevronsRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Preview (Chat Desktop) */}
                <div className="hidden lg:block w-[450px] shrink-0 sticky top-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-gray-900 rounded-t-2xl p-3 text-white text-center text-[10px] font-black tracking-[0.2em] uppercase">
                        VISTA DE CONVERSACIÓN
                    </div>
                    <div className="bg-white rounded-b-2xl border border-gray-200 shadow-2xl overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}>
                        {selectedChat ? (
                            <ChatPanelContent />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50/50 p-12 text-center">
                                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                                    <MessageSquare size={32} className="opacity-20" />
                                </div>
                                <h4 className="font-black text-gray-400 text-sm uppercase tracking-wider mb-2">Bandeja de Entrada</h4>
                                <p className="text-xs font-bold leading-relaxed">Selecciona una conversación de la tabla para ver el historial y responder</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Chat Drawer */}
            <MobileDrawer
                isOpen={mobileShowChat && !!selectedChat}
                onClose={() => setMobileShowChat(false)}
                title="Soporte"
            >
                <div className="h-[80vh]">
                    <ChatPanelContent />
                </div>
            </MobileDrawer>
        </div>
    );
};

export default SupportManager;

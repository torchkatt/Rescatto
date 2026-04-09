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
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Inbox
} from 'lucide-react';
import MobileDrawer from '../../components/common/MobileDrawer';

// ── helpers ────────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 20, 50];

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    'customer-venue':  { label: 'Negocio', icon: <Store size={12} />,       color: 'text-blue-700',    bgColor: 'bg-blue-50' },
    'customer-driver': { label: 'Driver',  icon: <Truck size={12} />,       color: 'text-amber-700',   bgColor: 'bg-amber-50' },
    'venue-driver':    { label: 'Logística',  icon: <Users size={12} />,       color: 'text-purple-700',  bgColor: 'bg-purple-50' },
    'admin-support':   { label: 'Admin',      icon: <ShieldCheck size={12} />, color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
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
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm shrink-0">
                    <div className="min-w-0">
                        <p className="font-black text-gray-900 truncate text-sm">{chatTitle(selectedChat)}</p>
                        {selectedChat.orderId && (
                            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-0.5">Pedido #{selectedChat.orderId.slice(-6)}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleDelete(selectedChat)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
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
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/30 min-h-0">
                    {loadingMessages ? (
                        <div className="flex justify-center items-center h-32">
                            <RefreshCw size={24} className="animate-spin text-emerald-500/20" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 opacity-40">
                            <MessageSquare size={32} />
                            <p className="text-xs font-bold uppercase tracking-widest">Sin mensajes</p>
                        </div>
                    ) : messages.map(msg => {
                        const isMsgFromMe = msg.senderId === user?.id;
                        const isSystem = msg.type === 'system' || msg.senderId === 'system';
                        if (isSystem) return (
                            <div key={msg.id} className="flex justify-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white shadow-sm border border-gray-100 px-3 py-1 rounded-full">{msg.text}</span>
                            </div>
                        );
                        return (
                            <div key={msg.id} className={`flex ${isMsgFromMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${isMsgFromMe ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'}`}>
                                    {!isMsgFromMe && <p className="text-[10px] font-black mb-1 opacity-50 uppercase tracking-tighter">{msg.senderName}</p>}
                                    <p className="text-sm leading-relaxed">{msg.text}</p>
                                    <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                        <p className={`text-[9px] font-bold ${isMsgFromMe ? 'text-white/60' : 'text-gray-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {isMsgFromMe && (
                                            <Circle size={4} className={`${msg.read ? 'fill-white/80' : 'text-white/20'} transition-all`} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-4 border-t border-gray-100 bg-white shrink-0">
                    <div className="flex gap-2">
                        <textarea
                            rows={1}
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Responde como soporte central..."
                            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-gray-50 resize-none transition-all scrollbar-hide"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!newMessage.trim() || sending}
                            className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 transition-all active:scale-95 shadow-md shadow-emerald-200 shrink-0"
                            aria-label="Enviar"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4 overflow-x-hidden min-h-screen pb-10">

            {/* Header Section Compact */}
            <div className="flex items-center justify-between shrink-0 mt-2 bg-emerald-900/40 border border-emerald-500/20 rounded-2xl p-4 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20">
                        <MessageSquare className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight leading-none mb-1">Consola de Soporte</h1>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] flex items-center gap-1.5">
                            <Circle size={6} className="fill-emerald-400 animate-pulse" />
                            Global Hub · {stats.total} activos
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {stats.unread > 0 && (
                        <div className="hidden sm:flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl transition-all">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{stats.unread} Pendientes</span>
                        </div>
                    )}
                    <button
                        onClick={() => loadChats(true)}
                        disabled={loadingChats}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-500 bg-white/5 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/10 hover:border-emerald-500/40 disabled:opacity-50 transition-all active:scale-95"
                    >
                        <RefreshCw size={14} className={loadingChats ? 'animate-spin' : ''} />
                        Refrescar
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start flex-1 min-h-0">
                {/* Main Content (Table) */}
                <div className="flex-1 w-full min-w-0">
                    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-210px)] min-h-[500px]">
                        
                        {/* Table Controls - Refined Layout */}
                        <div className="p-4 bg-gray-50/80 border-b border-gray-100">
                            <div className="flex flex-col xl:flex-row gap-4 justify-between items-center">
                                {/* Search & Rows */}
                                <div className="flex items-center gap-3 w-full xl:w-auto">
                                    <div className="relative group flex-1 sm:w-80 sm:flex-none">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
                                        <input
                                            type="search"
                                            placeholder="Buscar participante, pedido..."
                                            value={searchTerm}
                                            onChange={e => handleSearch(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white shadow-sm transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
                                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Filas</span>
                                        <select 
                                            value={pageSize} 
                                            onChange={e => handlePageSizeChange(Number(e.target.value))}
                                            className="text-sm font-black bg-transparent text-emerald-600 outline-none cursor-pointer"
                                        >
                                            {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                </div>
                                
                                {/* Filter Chips - Horizontal Scrollable */}
                                <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto scrollbar-hide pb-1">
                                    <button
                                        onClick={() => handleFilter('all')}
                                        className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${filterType === 'all' ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-200' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        Todos
                                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${filterType === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            {stats.total}
                                        </span>
                                    </button>
                                    {Object.entries(TYPE_LABELS).map(([type, meta]) => (
                                        <button
                                            key={type}
                                            onClick={() => handleFilter(type)}
                                            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${filterType === type ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-200' : `border-transparent ${meta.bgColor} ${meta.color} hover:brightness-95`}`}
                                        >
                                            {meta.label}
                                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${filterType === type ? 'bg-white/20 text-white' : 'bg-current/10 opacity-70'}`}>
                                                {stats.byType[type] ?? 0}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* DESKTOP TABLE */}
                        <div className="flex-1 overflow-auto scrollbar-hide hidden lg:block">
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-gray-50/95 backdrop-blur-md border-b border-gray-200">
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 w-[35%]">Participantes</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center w-[15%]">Categoría</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center w-[12%]">Pedido</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 w-[20%]">Último Mensaje</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right w-[10%]">Actividad</th>
                                        <th className="p-4 w-[8%]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loadingChats ? (
                                        <tr>
                                            <td colSpan={6} className="p-20 text-center">
                                                <RefreshCw size={40} className="animate-spin text-emerald-500/10 mx-auto" />
                                            </td>
                                        </tr>
                                    ) : paginated.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-20 text-center">
                                                <div className="flex flex-col items-center justify-center gap-4 text-gray-300">
                                                    <Inbox size={64} strokeWidth={1} />
                                                    <p className="font-black uppercase tracking-[0.2em] text-sm">Sin coincidencias</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginated.map(chat => {
                                        const meta = TYPE_LABELS[chat.type] || TYPE_LABELS['admin-support'];
                                        const isUnread = !chat.lastMessage.read && chat.lastMessage.senderId !== user?.id && chat.lastMessage.senderId !== '';
                                        return (
                                            <tr 
                                                key={chat.id}
                                                onClick={() => selectChat(chat)}
                                                className={`group hover:bg-gray-50/80 transition-all cursor-pointer ${selectedChat?.id === chat.id ? 'bg-emerald-50/60' : ''}`}
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shadow-sm group-hover:scale-105 transition-transform ${meta.bgColor} ${meta.color}`}>
                                                            {chatTitle(chat).charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className={`text-sm truncate max-w-[280px] ${isUnread ? 'font-black text-gray-900 underline decoration-red-500/30' : 'font-bold text-gray-700'}`}>
                                                                    {chatTitle(chat)}
                                                                </p>
                                                                {isUnread && <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-200 shrink-0" />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter ${meta.bgColor} ${meta.color} border border-transparent group-hover:border-current/10 transition-colors`}>
                                                        {meta.icon} {meta.label}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {chat.orderId ? (
                                                        <span className="text-xs font-black text-gray-400 bg-gray-100/50 px-2 py-1 rounded-lg">#{chat.orderId.slice(-6)}</span>
                                                    ) : (
                                                        <span className="text-gray-200">—</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-xs text-gray-500 truncate max-w-[180px] font-medium leading-tight">
                                                        {chat.lastMessage.text || <span className="italic text-gray-300 font-normal">Vacío</span>}
                                                    </p>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="text-[11px] font-black text-gray-400 tabular-nums">{timeAgo(chat.updatedAt)}</span>
                                                </td>
                                                <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => handleDelete(chat)}
                                                        className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
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

                        {/* MOBILE LIST */}
                        <div className="block lg:hidden overflow-y-auto flex-1 divide-y divide-gray-50 scrollbar-hide">
                            {paginated.map(chat => (
                                <div 
                                    key={chat.id} 
                                    onClick={() => selectChat(chat)}
                                    className={`p-4 active:bg-gray-100 transition-colors ${selectedChat?.id === chat.id ? 'bg-emerald-50' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${TYPE_LABELS[chat.type]?.bgColor} ${TYPE_LABELS[chat.type]?.color}`}>
                                                {chatTitle(chat).charAt(0)}
                                            </div>
                                            <p className={`text-sm ${!chat.lastMessage.read && chat.lastMessage.senderId !== user?.id ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                                                {chatTitle(chat)}
                                            </p>
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase">{timeAgo(chat.updatedAt)}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 font-medium truncate mb-3 ml-11">{chat.lastMessage.text || 'Sin mensajes'}</p>
                                    <div className="flex items-center gap-2 ml-11">
                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${TYPE_LABELS[chat.type]?.bgColor} ${TYPE_LABELS[chat.type]?.color}`}>
                                            {TYPE_LABELS[chat.type]?.label}
                                        </span>
                                        {chat.orderId && <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">#{chat.orderId.slice(-6)}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Footer - Refined */}
                        {!loadingChats && filtered.length > 0 && (
                            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50 shrink-0">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white border border-gray-100 px-3 py-1.5 rounded-xl shadow-sm">
                                    {loadingMore ? 'Sincronizando...' : (
                                        <>Items <span className="text-emerald-600">{(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)}</span> de {filtered.length}{hasMore ? '+' : ''}</>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                                    <button onClick={() => goToPage(1)} disabled={safePage === 1 || loadingMore} className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-emerald-600 disabled:opacity-20 transition-all"><ChevronsLeft size={16} /></button>
                                    <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1 || loadingMore} className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-emerald-600 disabled:opacity-20 transition-all"><ChevronLeft size={16} /></button>
                                    
                                    <div className="flex items-center px-1">
                                        {getPageNumbers().map((page, idx) => (
                                            page === '...' ? (
                                                <span key={`dots-${idx}`} className="px-2 text-gray-300 text-xs font-bold italic">..</span>
                                            ) : (
                                                <button 
                                                    key={page} 
                                                    onClick={() => goToPage(page as number)}
                                                    className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${safePage === page ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 scale-110' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        ))}
                                    </div>

                                    <button onClick={() => goToPage(safePage + 1)} disabled={(safePage >= totalPages && !hasMore) || loadingMore} className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-emerald-600 disabled:opacity-20 transition-all"><ChevronRight size={16} /></button>
                                    <button onClick={() => goToPage(totalPages)} disabled={(safePage >= totalPages && !hasMore) || loadingMore} className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-emerald-600 disabled:opacity-20 transition-all"><ChevronsRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Preview (Chat Desktop) - Synchronized Height */}
                <div className="hidden lg:block w-[420px] shrink-0 sticky top-4 animate-in slide-in-from-right-8 duration-500">
                    <div className="bg-gray-900 shadow-2xl rounded-[2rem] overflow-hidden flex flex-col h-[calc(100vh-210px)] min-h-[500px]">
                        <div className="bg-emerald-500 p-2 text-white text-center text-[9px] font-black tracking-[0.3em] uppercase">
                            Terminal de Respuesta
                        </div>
                        <div className="flex-1 overflow-hidden bg-white">
                            {selectedChat ? (
                                <ChatPanelContent />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-200 p-12 text-center bg-gray-50/50">
                                    <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-xl border border-gray-100 flex items-center justify-center mb-8 transform hover:rotate-12 transition-transform duration-500">
                                        <Inbox size={48} className="opacity-10 text-emerald-500" />
                                    </div>
                                    <h4 className="font-black text-gray-400 text-xs uppercase tracking-[0.3em] mb-3">En Espera</h4>
                                    <p className="text-[11px] font-bold text-gray-400 leading-relaxed px-6">Selecciona cualquier ticket de la consola global para iniciar la gestión del soporte</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Chat Drawer */}
            <MobileDrawer
                isOpen={mobileShowChat && !!selectedChat}
                onClose={() => setMobileShowChat(false)}
                title="Consola de Soporte"
            >
                <div className="h-[85vh]">
                    <ChatPanelContent />
                </div>
            </MobileDrawer>
        </div>
    );
};

export default SupportManager;

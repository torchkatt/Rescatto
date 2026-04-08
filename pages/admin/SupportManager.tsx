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
    ChevronLeft, ChevronRight
} from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────────
const FETCH_SIZE = 50;   // cuántos trae de Firestore por lote
const PAGE_SIZE  = 15;   // cuántos muestra por página en la lista

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
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

    // ── Pagination state ───────────────────────────────────────────────────────
    const [currentPage, setCurrentPage] = useState(1);

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
    const loadChats = useCallback(async (initial = false) => {
        if (initial) {
            setLoadingChats(true);
            setChats([]);
            setLastDoc(null);
            setHasMore(true);
            setCurrentPage(1);
        } else {
            setLoadingMore(true);
        }

        try {
            let q = query(
                collection(db, 'chats'),
                orderBy('updatedAt', 'desc'),
                limit(FETCH_SIZE)
            );
            if (!initial && lastDoc) {
                q = query(
                    collection(db, 'chats'),
                    orderBy('updatedAt', 'desc'),
                    startAfter(lastDoc),
                    limit(FETCH_SIZE)
                );
            }
            const snap = await getDocs(q);
            const newChats = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Chat[];

            if (initial) setChats(newChats);
            else setChats(prev => [...prev, ...newChats]);

            setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
            setHasMore(snap.docs.length === FETCH_SIZE);
        } catch (err) {
            logger.error('Error cargando chats de soporte:', err);
            toast.error('Error al cargar conversaciones');
        } finally {
            setLoadingChats(false);
            setLoadingMore(false);
        }
    }, [lastDoc]);

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

    const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage    = Math.min(currentPage, totalPages);
    const paginated   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const stats = useMemo(() => ({
        total: chats.length,
        unread: chats.filter(c => !c.lastMessage.read && c.lastMessage.senderId !== user?.id && c.lastMessage.senderId !== '').length,
        byType: Object.fromEntries(Object.keys(TYPE_LABELS).map(t => [t, chats.filter(c => c.type === t).length])),
    }), [chats, user?.id]);

    // Cuando el usuario llega a la última página y hay más en Firestore, los carga
    const goToPage = useCallback(async (page: number) => {
        const target = Math.max(1, Math.min(page, totalPages));
        // Si queremos ir a la última página y hay más datos sin cargar, los traemos
        if (hasMore && target === totalPages && paginated.length > 0) {
            await loadChats(false);
        }
        setCurrentPage(target);
    }, [totalPages, hasMore, paginated.length, loadChats]);

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

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4 overflow-x-hidden" style={{ height: 'calc(100vh - 120px)', minHeight: 580 }}>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
                        <MessageSquare className="text-emerald-600" size={28} />
                        Soporte
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {stats.total}{hasMore ? '+' : ''} conversaciones
                        {stats.unread > 0 && <> · <span className="font-bold text-red-500">{stats.unread} sin leer</span></>}
                    </p>
                </div>
                <button
                    onClick={() => loadChats(true)}
                    disabled={loadingChats}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all self-start shrink-0"
                >
                    <RefreshCw size={14} className={loadingChats ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-2 shrink-0">
                <button
                    onClick={() => handleFilter('all')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterType === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                    <MessageSquare size={12} /> Todos ({stats.total}{hasMore ? '+' : ''})
                </button>
                {Object.entries(TYPE_LABELS).map(([type, meta]) => (
                    <button
                        key={type}
                        onClick={() => handleFilter(type)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterType === type ? 'bg-gray-900 text-white' : `${meta.color} hover:opacity-80`}`}
                    >
                        {meta.icon} {meta.label} ({stats.byType[type] ?? 0}{hasMore ? '+' : ''})
                    </button>
                ))}
            </div>

            {/* Main layout — altura fija para que los paneles tengan scroll interno */}
            <div className="flex gap-4 flex-1 min-h-0">

                {/* ── Lista de chats ── */}
                <div className={`flex flex-col w-full md:w-80 lg:w-96 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>

                    {/* Search */}
                    <div className="p-3 border-b border-gray-100 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="search"
                                placeholder="Buscar participante, pedido..."
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-gray-50"
                            />
                        </div>
                    </div>

                    {/* Lista scrolleable */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-50 min-h-0">
                        {loadingChats ? (
                            <div className="flex justify-center items-center h-32">
                                <RefreshCw size={20} className="animate-spin text-gray-400" />
                            </div>
                        ) : paginated.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-medium">Sin conversaciones</p>
                            </div>
                        ) : paginated.map(chat => {
                            const meta     = TYPE_LABELS[chat.type] ?? TYPE_LABELS['admin-support'];
                            const isSelected = selectedChat?.id === chat.id;
                            const isUnread   = !chat.lastMessage.read && chat.lastMessage.senderId !== user?.id && chat.lastMessage.senderId !== '';
                            return (
                                <button
                                    key={chat.id}
                                    onClick={() => selectChat(chat)}
                                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-emerald-50' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                                            {chatTitle(chat)}
                                        </p>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isUnread && <Circle size={8} className="fill-red-500 text-red-500" />}
                                            <span className="text-[10px] text-gray-400">{timeAgo(chat.updatedAt)}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 truncate mb-1.5">
                                        {chat.lastMessage.text || 'Sin mensajes'}
                                    </p>
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${meta.color}`}>
                                        {meta.icon} {meta.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer de paginación — fuera del scroll, siempre visible */}
                    {!loadingChats && (
                        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50 shrink-0">
                            <span className="text-[11px] text-gray-400">
                                {filtered.length === 0 ? '0' : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)}`}
                                {' '}de {filtered.length}{hasMore ? '+' : ''}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    disabled={safePage <= 1}
                                    onClick={() => goToPage(safePage - 1)}
                                    className="p-1 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-colors"
                                    title="Página anterior"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="text-[11px] font-semibold text-gray-600 px-1">
                                    {safePage} / {totalPages}{hasMore ? '+' : ''}
                                </span>
                                <button
                                    disabled={safePage >= totalPages && !hasMore}
                                    onClick={() => goToPage(safePage + 1)}
                                    className="p-1 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-colors"
                                    title="Página siguiente"
                                >
                                    <ChevronRight size={14} />
                                </button>
                                {loadingMore && <RefreshCw size={11} className="animate-spin text-gray-400 ml-1" />}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Panel de chat ── */}
                <div className={`flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-0 ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
                    {!selectedChat ? (
                        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
                            <MessageSquare size={48} className="opacity-20" />
                            <p className="font-medium">Selecciona una conversación</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <button
                                        className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                                        onClick={() => setMobileShowChat(false)}
                                    >
                                        <X size={18} />
                                    </button>
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
                                </div>
                            </div>

                            {/* Mensajes — scroll interno */}
                            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/30 min-h-0">
                                {loadingMessages ? (
                                    <div className="flex justify-center items-center h-32">
                                        <RefreshCw size={20} className="animate-spin text-gray-400" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center text-gray-400 text-sm py-8">Sin mensajes aún</div>
                                ) : messages.map(msg => {
                                    const isAdmin  = msg.senderId === user?.id;
                                    const isSystem = msg.type === 'system' || msg.senderId === 'system';
                                    if (isSystem) return (
                                        <div key={msg.id} className="flex justify-center">
                                            <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.text}</span>
                                        </div>
                                    );
                                    return (
                                        <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isAdmin ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                                                {!isAdmin && <p className="text-[10px] font-bold mb-0.5 opacity-60">{msg.senderName}</p>}
                                                <p className="text-sm leading-relaxed">{msg.text}</p>
                                                <p className={`text-[10px] mt-1 ${isAdmin ? 'text-white/60 text-right' : 'text-gray-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupportManager;

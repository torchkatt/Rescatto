import React from 'react';
import { Message as MessageType } from '../../types';
import { Check, CheckCheck, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MessageBubbleProps {
    message: MessageType;
    isMine: boolean;
    showAvatar?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isMine,
    showAvatar = true,
}) => {
    const isSystem = message.type === 'system';

    if (isSystem) {
        return (
            <div className="flex justify-center my-4">
                <div className="bg-gray-100 px-4 py-2 rounded-full text-xs text-gray-600 max-w-md text-center">
                    {message.text}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex gap-2 mb-4 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar (Only for other participants) */}
            {showAvatar && !isMine && (
                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-gray-100 shadow-sm border border-gray-200 mt-1">
                    <User size={16} className="text-gray-400" />
                </div>
            )}

            {/* Message Content */}
            <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[70%]`}>
                {/* Sender Name (if not mine) */}
                {!isMine && (
                    <span className="text-xs text-gray-500 mb-1 px-1">
                        {message.senderName}
                    </span>
                )}

                {/* Bubble */}
                <div
                    className={`px-4 py-2.5 rounded-2xl shadow-sm ${isMine
                        ? 'bg-emerald-600 text-white rounded-tr-none shadow-emerald-100'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none shadow-gray-100'
                        }`}
                >
                    {message.type === 'location' && message.location ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📍</span>
                            <div>
                                <p className="text-sm font-semibold">Ubicación compartida</p>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${message.location.lat},${message.location.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 underline hover:text-blue-800"
                                >
                                    Ver en mapa
                                </a>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                    )}
                </div>

                {/* Timestamp and Read Status */}
                <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">
                        {format(new Date(message.timestamp), 'HH:mm', { locale: es })}
                    </span>

                    {isMine && (
                        <div className="flex items-center">
                            {message.read ? (
                                <CheckCheck size={12} className="text-emerald-500" />
                            ) : (
                                <Check size={12} className="text-gray-300" />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;

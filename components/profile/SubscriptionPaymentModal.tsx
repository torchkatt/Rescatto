import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Copy, CheckCircle, Upload, Loader2, Clock, AlertCircle, Download } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { functions, storage } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';
import { SubscriptionRequest } from '../../types';
import { QRCodeCanvas } from 'qrcode.react';

interface BankInfo {
    configured: boolean;
    bankName?: string;
    accountType?: string;
    brebKey?: string;
    holder?: string;
    nit?: string;
}

interface Props {
    request: SubscriptionRequest;
    onClose: () => void;
    onProofSubmitted: () => void;
}

/** Construye el payload del QR de pago Bre-B compatible con apps bancarias colombianas */
function buildPaymentQRUrl(bankInfo: BankInfo, amount: number, referenceCode: string): string {
    if (!bankInfo.brebKey) return referenceCode;

    const key = bankInfo.brebKey.trim();
    const description = encodeURIComponent(`Rescatto Pass · Ref: ${referenceCode}`);

    // Si parece número de celular colombiano → link Nequi
    const phoneDigits = key.replace(/\D/g, '');
    const isPhone = /^(57)?3\d{9}$/.test(phoneDigits);
    if (isPhone) {
        const phone = phoneDigits.startsWith('57') ? phoneDigits.slice(2) : phoneDigits;
        return `https://nequi.com.co/transferencia?phone=${phone}&amount=${amount}&description=${description}`;
    }

    // Email → Bre-B por email
    if (key.includes('@')) {
        return `brb://pay?email=${encodeURIComponent(key)}&amount=${amount}&ref=${encodeURIComponent(referenceCode)}`;
    }

    // Llave NIT/alfanumérica → Bre-B genérico
    return `brb://pay?key=${encodeURIComponent(key)}&amount=${amount}&ref=${encodeURIComponent(referenceCode)}`;
}

const QR_SIZE = 220;

export const SubscriptionPaymentModal: React.FC<Props> = ({ request, onClose, onProofSubmitted }) => {
    const { success, showToast } = useToast();
    const [copied, setCopied] = useState(false);
    const [transactionNumber, setTransactionNumber] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    const isPendingReview = request.status === 'pending_review';
    const isExpired = new Date(request.expiresAt) < new Date();

    useEffect(() => {
        const load = async () => {
            try {
                const fn = httpsCallable(functions, 'getBankPaymentInfo');
                const res = await fn({});
                setBankInfo(res.data as BankInfo);
            } catch (err) {
                logger.error('getBankPaymentInfo error:', err);
                setBankInfo({ configured: false });
            }
        };
        load();
    }, []);

    const qrValue = bankInfo?.configured
        ? buildPaymentQRUrl(bankInfo, request.amount, request.referenceCode)
        : request.referenceCode;

    const copyCode = () => {
        navigator.clipboard.writeText(request.referenceCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadQR = useCallback(() => {
        // El canvas de QRCodeCanvas está dentro del contenedor — lo buscamos por id
        const canvas = document.getElementById('qr-payment-canvas') as HTMLCanvasElement | null;
        if (!canvas) return;

        // Creamos un canvas temporal con padding y texto para que sea más útil al guardar
        const padding = 24;
        const labelH = 48;
        const out = document.createElement('canvas');
        out.width = QR_SIZE + padding * 2;
        out.height = QR_SIZE + padding * 2 + labelH;
        const ctx = out.getContext('2d')!;

        // Fondo blanco
        ctx.fillStyle = '#ffffff';
        ctx.roundRect(0, 0, out.width, out.height, 16);
        ctx.fill();

        // QR centrado
        ctx.drawImage(canvas, padding, padding, QR_SIZE, QR_SIZE);

        // Texto con el código
        ctx.fillStyle = '#1A6B4A';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(request.referenceCode, out.width / 2, QR_SIZE + padding + 22);

        ctx.fillStyle = '#6b7280';
        ctx.font = '11px sans-serif';
        ctx.fillText(`Rescatto Pass · ${formatCOP(request.amount)}`, out.width / 2, QR_SIZE + padding + 40);

        const link = document.createElement('a');
        link.download = `rescatto-pay-${request.referenceCode}.png`;
        link.href = out.toDataURL('image/png');
        link.click();
    }, [request.referenceCode, request.amount]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setProofFile(file);
    };

    const handleSubmit = async () => {
        if (!transactionNumber.trim()) {
            showToast('error', 'Ingresa el número de transacción.');
            return;
        }
        setSubmitting(true);
        try {
            let paymentProofUrl: string | undefined;
            if (proofFile) {
                const path = `subscription_proofs/${request.id}/${Date.now()}_${proofFile.name}`;
                const fileRef = storageRef(storage, path);
                await uploadBytes(fileRef, proofFile);
                paymentProofUrl = await getDownloadURL(fileRef);
            }

            const submitFn = httpsCallable(functions, 'submitPaymentProof');
            await submitFn({
                requestId: request.id,
                transactionNumber: transactionNumber.trim(),
                paymentProofUrl,
            });

            success('¡Comprobante enviado! El equipo Rescatto verificará tu pago en menos de 24h.');
            onProofSubmitted();
        } catch (err: any) {
            logger.error('submitPaymentProof error:', err);
            showToast('error', err?.message || 'Error al enviar el comprobante. Intenta de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-gray-900">Pagar Rescatto Pass</h2>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">
                            {request.planId === 'monthly' ? 'Plan Mensual' : 'Plan Anual'} · {formatCOP(request.amount)}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto px-6 py-5 space-y-5">
                    {/* Estado: en revisión */}
                    {isPendingReview && (
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <Clock size={20} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-black text-amber-800">Pago en revisión</p>
                                <p className="text-xs text-amber-600 mt-0.5">
                                    Tu comprobante fue recibido. El equipo lo verificará en menos de 24h.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Expirado */}
                    {isExpired && !isPendingReview && (
                        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm font-black text-red-700">
                                Esta solicitud venció. Cierra y genera una nueva.
                            </p>
                        </div>
                    )}

                    {/* QR de pago — centrado y grande */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex flex-col items-center gap-4">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest self-start">
                            Escanea para pagar
                        </p>

                        {/* QR */}
                        <div className="bg-white p-4 rounded-2xl shadow-md border border-emerald-100">
                            {bankInfo === null ? (
                                <div style={{ width: QR_SIZE, height: QR_SIZE }} className="flex items-center justify-center">
                                    <Loader2 size={32} className="animate-spin text-emerald-400" />
                                </div>
                            ) : (
                                <QRCodeCanvas
                                    id="qr-payment-canvas"
                                    value={qrValue}
                                    size={QR_SIZE}
                                    level="H"
                                    marginSize={1}
                                    fgColor="#1A6B4A"
                                />
                            )}
                        </div>

                        {/* Código de referencia */}
                        <div className="w-full text-center">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                                Código de referencia
                            </p>
                            <p className="text-lg font-black text-emerald-900 tracking-wider break-all leading-snug">
                                {request.referenceCode}
                            </p>
                        </div>

                        {/* Acciones: copiar + descargar */}
                        <div className="flex gap-2 w-full">
                            <button
                                onClick={copyCode}
                                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-200 px-3 py-2.5 rounded-xl active:scale-95 transition-all"
                            >
                                {copied ? <CheckCircle size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                {copied ? 'Copiado' : 'Copiar código'}
                            </button>
                            <button
                                onClick={downloadQR}
                                disabled={bankInfo === null}
                                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-200 px-3 py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-40"
                            >
                                <Download size={13} />
                                Descargar QR
                            </button>
                        </div>

                        <p className="text-[11px] text-emerald-600 text-center leading-relaxed">
                            Transfiere exactamente <strong>{formatCOP(request.amount)}</strong> e incluye el
                            código de referencia en el concepto del pago.
                        </p>
                    </div>

                    {/* Upload comprobante — solo si no está en revisión ni vencida */}
                    {!isPendingReview && !isExpired && (
                        <div className="space-y-4">
                            <p className="text-sm font-black text-gray-900">Una vez realizado el pago</p>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
                                    Número de transacción *
                                </label>
                                <input
                                    type="text"
                                    value={transactionNumber}
                                    onChange={e => setTransactionNumber(e.target.value)}
                                    placeholder="Ej: 2024031500001234"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
                                    Comprobante de pago (opcional)
                                </label>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`w-full border-2 border-dashed rounded-xl py-4 flex flex-col items-center gap-2 transition-all ${
                                        proofFile
                                            ? 'border-emerald-400 bg-emerald-50'
                                            : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {proofFile ? (
                                        <>
                                            <CheckCircle size={22} className="text-emerald-500" />
                                            <span className="text-xs font-bold text-emerald-700 text-center px-4 truncate max-w-full">
                                                {proofFile.name}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={22} className="text-gray-400" />
                                            <span className="text-xs font-bold text-gray-500">Toca para subir imagen</span>
                                        </>
                                    )}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !transactionNumber.trim()}
                                className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                            >
                                {submitting
                                    ? <><Loader2 size={18} className="animate-spin" /> Enviando...</>
                                    : 'Ya pagué, enviar comprobante'}
                            </button>
                        </div>
                    )}

                    <p className="text-center text-[11px] text-gray-400 pb-1">
                        Válido hasta: {new Date(request.expiresAt).toLocaleString('es-CO')}
                    </p>
                </div>
            </div>
        </div>
    );
};

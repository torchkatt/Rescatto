import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { logger } from '../../utils/logger';
import {
    Building2, ShieldCheck, Pencil, Loader2, CheckCircle,
    AlertTriangle, Eye, EyeOff, Lock, Mail
} from 'lucide-react';

interface BankInfo {
    configured: boolean;
    bankName?: string;
    accountType?: string;
    brebKey?: string;
    holder?: string;
    nit?: string;
}

type Step = 'view' | 'request_otp' | 'verify_otp' | 'edit' | 'success';

export const AdminPaymentSettings: React.FC = () => {
    const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
    const [step, setStep] = useState<Step>('view');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [maskedEmail, setMaskedEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [showAccount, setShowAccount] = useState(false);
    const [error, setError] = useState('');

    // Formulario
    const [form, setForm] = useState({
        bankName: '',
        accountType: 'Cuenta de Ahorros',
        brebKey: '',
        holder: '',
        nit: '',
    });

    useEffect(() => {
        loadBankInfo();
    }, []);

    const loadBankInfo = async () => {
        setLoading(true);
        try {
            const fn = httpsCallable(functions, 'getBankPaymentInfo');
            const result: any = await fn({});
            setBankInfo(result.data);
            if (result.data.configured) {
                setForm({
                    bankName:    result.data.bankName    || '',
                    accountType: result.data.accountType || 'Cuenta de Ahorros',
                    brebKey:     result.data.brebKey     || '',
                    holder:      result.data.holder      || '',
                    nit:         result.data.nit         || '',
                });
            }
        } catch (err) {
            logger.error('getBankPaymentInfo error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOTP = async () => {
        setSubmitting(true);
        setError('');
        try {
            const fn = httpsCallable(functions, 'requestBankInfoChange');
            const result: any = await fn({});
            setMaskedEmail(result.data.maskedEmail);
            setStep('verify_otp');
        } catch (err: any) {
            logger.error('requestBankInfoChange error:', err);
            setError(err?.message || 'Error al enviar el código. Intenta de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyOTP = () => {
        if (otp.length !== 6) {
            setError('El código debe tener 6 dígitos.');
            return;
        }
        setError('');
        setStep('edit');
    };

    const handleSave = async () => {
        if (!form.bankName || !form.holder) {
            setError('Banco y titular son obligatorios.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const fn = httpsCallable(functions, 'updateBankPaymentInfo');
            await fn({ otp, ...form });
            await loadBankInfo();
            setStep('success');
            setOtp('');
            setTimeout(() => setStep('view'), 3000);
        } catch (err: any) {
            logger.error('updateBankPaymentInfo error:', err);
            if (err?.message?.includes('expiró')) {
                setError('El código OTP expiró. Vuelve a solicitar uno.');
                setStep('view');
            } else if (err?.message?.includes('incorrecto')) {
                setError('Código incorrecto. Verifica e intenta de nuevo.');
                setStep('verify_otp');
            } else {
                setError(err?.message || 'Error al guardar. Intenta de nuevo.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 size={32} className="animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-black text-white">Datos Bancarios de Pago</h1>
                <p className="text-gray-400 text-sm mt-1">
                    Información BBVA Bre-B que se muestra a los clientes al suscribirse.
                    Cualquier modificación requiere verificación por correo (OTP).
                </p>
            </div>

            {/* Vista actual */}
            {step === 'view' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 rounded-xl">
                                <Building2 size={20} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="font-black text-gray-900">Cuenta BBVA Bre-B</p>
                                <p className="text-xs text-gray-400">
                                    {bankInfo?.configured ? 'Configurada' : 'Sin configurar'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setStep('request_otp')}
                            className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors active:scale-95"
                        >
                            <Pencil size={15} /> Modificar
                        </button>
                    </div>

                    {bankInfo?.configured ? (
                        <div className="divide-y divide-gray-50">
                            {[
                                { label: 'Banco', value: bankInfo.bankName },
                                { label: 'Tipo de cuenta', value: bankInfo.accountType },
                                { label: 'Llave Bre-B', value: bankInfo.brebKey },
                                { label: 'Titular', value: bankInfo.holder },
                                ...(bankInfo.nit ? [{ label: 'NIT', value: bankInfo.nit }] : []),
                            ].map(({ label, value, sensitive }: any) => (
                                <div key={label} className="flex items-center justify-between px-6 py-3.5">
                                    <span className="text-sm text-gray-500 font-medium">{label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-gray-900">{value || '—'}</span>
                                        {sensitive && (
                                            <button onClick={() => setShowAccount(v => !v)} className="text-gray-400 hover:text-gray-600">
                                                {showAccount ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="px-6 py-10 text-center">
                            <AlertTriangle size={32} className="mx-auto mb-3 text-amber-400" />
                            <p className="font-bold text-gray-700">Datos bancarios no configurados</p>
                            <p className="text-sm text-gray-400 mt-1">Los clientes no podrán completar el pago de suscripción.</p>
                            <button
                                onClick={() => setStep('request_otp')}
                                className="mt-4 px-6 py-2.5 bg-emerald-600 text-white text-sm font-black rounded-xl hover:bg-emerald-700 transition-colors"
                            >
                                Configurar ahora
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Paso 1: solicitar OTP */}
            {step === 'request_otp' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-5">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
                        <Lock size={28} className="text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900">Verificación requerida</h2>
                        <p className="text-gray-500 text-sm mt-2">
                            Para modificar los datos bancarios se enviará un código de 6 dígitos a tu correo de administrador.
                        </p>
                    </div>
                    {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
                    <div className="flex gap-3 justify-center pt-2">
                        <button
                            onClick={() => { setStep('view'); setError(''); }}
                            className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleRequestOTP}
                            disabled={submitting}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center gap-2"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                            Enviar código
                        </button>
                    </div>
                </div>
            )}

            {/* Paso 2: ingresar OTP */}
            {step === 'verify_otp' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-5">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck size={28} className="text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900">Ingresa el código</h2>
                        <p className="text-gray-500 text-sm mt-2">
                            Enviamos un código de 6 dígitos a <strong>{maskedEmail}</strong>.<br />
                            Expira en 5 minutos.
                        </p>
                    </div>
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full text-center text-3xl font-black tracking-[0.5em] border-2 border-gray-200 rounded-2xl py-4 text-gray-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setStep('view'); setError(''); setOtp(''); }}
                            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleVerifyOTP}
                            disabled={otp.length !== 6}
                            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            Continuar
                        </button>
                    </div>
                    <button
                        onClick={handleRequestOTP}
                        className="w-full text-xs text-gray-400 hover:text-emerald-600 transition-colors font-medium"
                    >
                        ¿No llegó el código? Reenviar
                    </button>
                </div>
            )}

            {/* Paso 3: formulario de edición */}
            {step === 'edit' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                        <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                        <p className="text-sm font-bold text-emerald-700">Identidad verificada. Edita los datos con cuidado.</p>
                    </div>

                    {[
                        { key: 'bankName', label: 'Nombre del banco', placeholder: 'BBVA Colombia' },
                        { key: 'accountType', label: 'Tipo de cuenta', placeholder: 'Cuenta de Ahorros' },
                        { key: 'brebKey', label: 'Llave Bre-B (cel / email / NIT)', placeholder: '+57 300 000 0000' },
                        { key: 'holder', label: 'Titular', placeholder: 'Rescatto S.A.S.' },
                        { key: 'nit', label: 'NIT (opcional)', placeholder: '900.000.000-0' },
                    ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
                                {label}
                            </label>
                            <input
                                type="text"
                                value={form[key as keyof typeof form]}
                                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                placeholder={placeholder}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>
                    ))}

                    {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => { setStep('view'); setError(''); setOtp(''); }}
                            className="flex-1 py-3.5 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={submitting}
                            className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                            Guardar cambios
                        </button>
                    </div>
                </div>
            )}

            {/* Éxito */}
            {step === 'success' && (
                <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm p-10 text-center space-y-4">
                    <CheckCircle size={48} className="text-emerald-500 mx-auto" />
                    <h2 className="text-xl font-black text-gray-900">¡Datos actualizados!</h2>
                    <p className="text-gray-500 text-sm">Los datos bancarios se guardaron correctamente y ya están activos para los clientes.</p>
                </div>
            )}

            {/* Info de seguridad */}
            <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <Lock size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-500 leading-relaxed">
                    Los datos bancarios se almacenan encriptados en Firestore. Cada modificación requiere verificación OTP
                    enviado al correo del administrador y queda registrada en el log de auditoría.
                </p>
            </div>
        </div>
    );
};

export default AdminPaymentSettings;

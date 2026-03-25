import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, Eye, EyeOff, User, Gift, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/common/Logo';
import { logger } from '../utils/logger';
import { auditService, AuditAction } from '../services/auditService';
import { SEO } from '../components/common/SEO';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'CUSTOMER' | 'BUSINESS'>('BUSINESS');
  const { user, isAuthenticated, login, loginWithGoogle, loginWithApple, loginWithFacebook, loginAsGuest } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  // Redirigir si el usuario ya está autenticado (y no es invitado, o si lo es pero no estamos en modo registro/login explícito)
  useEffect(() => {
    // Si el usuario es real (no invitado) y está autenticado, redirigir siempre
    if (isAuthenticated && user && !user.isGuest) {
      logger.log('Login: Usuario real autenticado, redirigiendo a /');
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  // Manejar parámetros de URL (?mode=register)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'register') {
      setIsRegistering(true);
    }
  }, []);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email o contraseña incorrectos. Por favor, verifica tus datos.';
      case 'auth/user-disabled':
        return 'Esta cuenta ha sido deshabilitada. Contacta al administrador.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Inténtalo más tarde.';
      case 'auth/network-request-failed':
        return 'Error de conexión. Revisa tu internet.';
      default:
        return 'Error al iniciar sesión. Intenta nuevamente.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden');
          return;
        }
        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          return;
        }
        // Importación dinámica para evitar problemas de dependencia circular
        const { authService } = await import('../services/authService');
        const { UserRole } = await import('../types');
        // El registro usa el rol seleccionado en las pestañas
        const role = selectedRole === 'BUSINESS' ? UserRole.ADMIN : UserRole.CUSTOMER;
        await authService.register(email, password, fullName, role, { 
            invitedBy: referralCode.trim().toUpperCase() 
        });
        navigate('/');
      } else {
        await login(email, password);
        // La navegación es manejada por RootRedirect en App.tsx o AuthContext
        navigate('/');
      }
    } catch (err: any) {
      logger.error('Login error:', err);
      setError(getErrorMessage(err.code || err.message));
      
      auditService.logEvent({
        action: AuditAction.LOGIN_FAILURE,
        performedBy: email,
        details: { error: err.code || err.message, isRegistering, selectedRole },
        path: '/login'
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Google');
      auditService.logEvent({
        action: AuditAction.LOGIN_FAILURE,
        performedBy: user?.id || 'anonymous',
        details: { error: err.code || err.message, method: 'google' },
        path: '/login'
      });
    }
  }

  const handleAppleLogin = async () => {
    try {
      await loginWithApple();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Apple');
    }
  };

  const handleFacebookLogin = async () => {
    try {
      await loginWithFacebook();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Facebook');
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-outfit relative">
      <SEO 
        title={isRegistering ? t('login_title_register') : t('login_title_welcome')} 
        description={t('login_desc')}
      />
      
      {/* Global Language Switcher */}
      <button
        onClick={toggleLanguage}
        className="absolute top-6 right-6 z-50 flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:shadow-md hover:bg-white text-slate-700 font-bold text-sm transition-all group"
      >
        <Globe size={16} className="text-emerald-600 group-hover:animate-pulse" />
        {i18n.language.startsWith('es') ? 'ES' : 'EN'}
      </button>
      {/* ... Contenido del lado izquierdo ... */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2574&auto=format&fit=crop"
            alt="Market Background"
            className="w-full h-full object-cover opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 via-slate-900/95 to-black/80"></div>
          {/* Decorative Circles */}
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 p-16 flex flex-col justify-between h-full text-white">
          <div className="flex items-center gap-3 animate-fade-in-up">
            <Logo size="md" className="bg-white/10 backdrop-blur-md rounded-xl border border-white/10 shadow-lg p-1" iconColor="#34d399" />
            <span className="text-2xl font-bold tracking-tight">Rescatto Business</span>
          </div>

          <div className="mb-20 animate-fade-in-up delay-[200ms]">
            <h1 className="text-5xl lg:text-6xl font-extrabold mb-8 leading-tight tracking-tight">
              Rentabiliza <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">cada producto.</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-lg leading-relaxed font-light">
              Transforma excedentes en ganancias. La plataforma inteligente para negocios que lideran el cambio hacia un futuro sin desperdicio.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-400 animate-fade-in-up delay-[400ms]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>Algoritmos de Precios</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Analytics Real-time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lado Derecho - Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50 relative">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-md w-full relative z-10 animate-fade-in-up">
          {/* Logo para Móvil */}
          <div className="text-center lg:text-left mb-10">
            <div className="inline-flex lg:hidden items-center gap-2 mb-6 justify-center bg-white px-5 py-2.5 rounded-full border border-slate-100 shadow-sm">
              <Logo size="sm" textColor="text-slate-900" />
              <span className="font-bold text-slate-900">Business</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
              {isRegistering ? t('login_title_register') : t('login_title_welcome')}
            </h2>
            <p className="text-slate-500">
              {isRegistering
                ? t('login_desc_register')
                : t('login_desc_welcome')}
            </p>
          </div>

          {isRegistering && (
            <div className="flex p-1 bg-slate-200/50 rounded-xl mb-8">
              <button
                type="button"
                onClick={() => setSelectedRole('CUSTOMER')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  selectedRole === 'CUSTOMER'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('login_role_customer')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('BUSINESS')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  selectedRole === 'BUSINESS'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('login_role_business')}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-fade-in-up shadow-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full shrink-0"></div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">{t('login_fullname')}</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-white text-base hover:border-slate-300"
                      placeholder={t('login_fullname_ph')}
                      required
                    />
                  </div>
                </div>

                {selectedRole === 'CUSTOMER' && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-1.5">
                      {t('login_referral')} 
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t('login_optional')}</span>
                    </label>
                    <div className="relative group">
                      <Gift className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-white text-base hover:border-slate-300 font-mono tracking-widest"
                        placeholder="ABC123"
                        maxLength={6}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">{t('login_email')}</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  className={`block w-full pl-12 pr-4 py-3.5 border rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-white text-base hover:border-slate-300 ${emailTouched && email && !email.includes('@') ? 'border-red-300' : 'border-slate-200'}`}
                  placeholder={t('login_email_ph')}
                  required
                />
                {emailTouched && email && !email.includes('@') && (
                  <p className="text-xs text-red-500 mt-1 ml-1">Ingresa un correo válido</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-sm font-semibold text-slate-700">{t('login_password')}</label>
                {!isRegistering && (
                  <button type="button" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
                    {t('login_forgot_pwd')}
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-12 py-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-white text-base hover:border-slate-300"
                  placeholder={t('login_password_ph')}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {isRegistering && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">{t('login_confirm_password')}</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setConfirmTouched(true); }}
                    className={`block w-full pl-12 pr-12 py-3.5 border rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-white text-base hover:border-slate-300 ${confirmTouched && confirmPassword && confirmPassword !== password ? 'border-red-300' : 'border-slate-200'}`}
                    placeholder={t('login_password_ph')}
                    required
                  />
                  {confirmTouched && confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-red-500 mt-1 ml-1">Las contraseñas no coinciden</p>
                  )}
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl text-base font-bold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300 flex items-center justify-center gap-2 group transform active:scale-[0.98]"
            >
              {isRegistering ? t('login_btn_register') : t('login_btn_login')}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="my-8 flex items-center">
              <div className="flex-1 border-t border-slate-200"></div>
              <span className="px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('login_continue_with')}</span>
              <div className="flex-1 border-t border-slate-200"></div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={handleGoogleLogin}
                type="button"
                aria-label="Continuar con Google"
                className="flex items-center justify-center py-3 border border-slate-200 rounded-xl shadow-sm bg-white hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
              </button>
              <button
                onClick={handleAppleLogin}
                type="button"
                aria-label="Continuar con Apple"
                className="flex items-center justify-center py-3 border border-slate-200 rounded-xl shadow-sm bg-white hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              </button>
              <button
                onClick={handleFacebookLogin}
                type="button"
                aria-label="Continuar con Facebook"
                className="flex items-center justify-center py-3 border border-slate-200 rounded-xl shadow-sm bg-white hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
              >
                <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </button>
            </div>
          </form>

          <button
            onClick={async () => {
              try {
                setError('');
                await loginAsGuest();
                navigate('/');
              } catch (err: any) {
                setError('Error al ingresar como invitado. Intenta de nuevo.');
                auditService.logEvent({
                  action: AuditAction.LOGIN_FAILURE,
                  details: { error: err.code || err.message, method: 'guest' },
                  path: '/login'
                });
              }
            }}
            type="button"
            className="w-full mt-6 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100/50 text-emerald-700 py-4 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 group shadow-sm"
          >
            <User size={18} className="group-hover:scale-110 transition-transform" />
            {t('login_btn_guest')}
          </button>

          <div className="mt-8 text-center text-sm">
            <span className="text-slate-500">
              {isRegistering ? t('login_has_account_q') : t('login_no_account_q')}
            </span>
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="ml-2 font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-all active:scale-95"
            >
              {isRegistering ? t('login_link_login') : t('login_link_register')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Login;
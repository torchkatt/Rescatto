import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sellerService } from '../../services/sellerService';
import { categoryService } from '../../services/categoryService';
import { SellerType, Category, Seller } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/customer/common/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/common/ErrorState';
import { Store, ChevronDown, Phone, MapPin, AlignLeft, Tag } from 'lucide-react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { SEO } from '../../components/common/SEO';

// ── Seller type options ──────────────────────────────────────────────────────

const SELLER_TYPE_OPTIONS: { value: SellerType; labelKey: string; label: string }[] = [
  { value: SellerType.FOOD, labelKey: 'seller_type_food', label: 'Comida' },
  { value: SellerType.RETAIL, labelKey: 'seller_type_retail', label: 'Retail' },
  { value: SellerType.SERVICE, labelKey: 'seller_type_service', label: 'Servicio' },
  { value: SellerType.INDIVIDUAL, labelKey: 'seller_type_individual', label: 'Individual' },
];

// ── Form data ─────────────────────────────────────────────────────────────────

interface SellerOnboardingForm {
  name: string;
  type: SellerType;
  description: string;
  phone: string;
  address: string;
  city: string;
  categoryIds: string[];
}

const INITIAL_FORM: SellerOnboardingForm = {
  name: '',
  type: SellerType.FOOD,
  description: '',
  phone: '',
  address: '',
  city: '',
  categoryIds: [],
};

// ── Validation ────────────────────────────────────────────────────────────────

interface FormErrors {
  name?: string;
  type?: string;
  description?: string;
  phone?: string;
  address?: string;
  city?: string;
}

function validate(form: SellerOnboardingForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'El nombre del vendedor es obligatorio';
  if (!form.type) errors.type = 'Selecciona un tipo de vendedor';
  if (!form.description.trim()) errors.description = 'La descripción es obligatoria';
  if (!form.phone.trim()) errors.phone = 'El teléfono es obligatorio';
  if (!form.address.trim()) errors.address = 'La dirección es obligatoria';
  if (!form.city.trim()) errors.city = 'La ciudad es obligatoria';
  return errors;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SellerOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { t } = useTranslation();

  const [form, setForm] = useState<SellerOnboardingForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  // ── On mount: check if user already has a seller profile, load categories ──

  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;

      try {
        // Check if already a seller
        const existingSellers = await sellerService.getByOwner(user.id);
        if (existingSellers.length > 0) {
          navigate('/seller-dashboard', { replace: true });
          return;
        }

        // Load root categories for chip selection
        const cats = await categoryService.getRootCategories();
        setCategories(cats);
      } catch (err: any) {
        logger.error('SellerOnboarding init error:', err);
        setLoadError(err instanceof Error ? err : new Error('Error al cargar datos'));
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const toggleCategory = (catId: string) => {
    setForm(prev => {
      const exists = prev.categoryIds.includes(catId);
      return {
        ...prev,
        categoryIds: exists
          ? prev.categoryIds.filter(id => id !== catId)
          : [...prev.categoryIds, catId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (!user?.id) return;

    setSubmitting(true);
    try {
      const sellerData: Omit<Seller, 'id' | 'createdAt'> = {
        name: form.name.trim(),
        type: form.type,
        categoryIds: form.categoryIds,
        ownerId: user.id,
        location: {
          lat: 0,
          lng: 0,
          address: form.address.trim(),
          city: form.city.trim(),
        },
        description: form.description.trim(),
        contact: {
          phone: form.phone.trim(),
        },
        rating: 0,
        stats: {
          totalTransactions: 0,
          totalRevenue: 0,
        },
        isActive: true,
        subscription: 'free',
        commissionRate: 0.10,
        };

      await sellerService.create(sellerData);
      success(t('seller_onboarding_success', '¡Perfil de vendedor creado con éxito!'));
      navigate('/seller-dashboard', { replace: true });
    } catch (err: any) {
      logger.error('SellerOnboarding create error:', err);
      showError(t('seller_onboarding_error', 'Error al crear el perfil. Intenta de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 space-y-6" data-testid="seller-onboarding-skeleton">
        <Skeleton.Block h={32} w="60%" rounded="lg" className="mb-2" />
        <Skeleton.Block h={16} w="80%" rounded="md" />
        <div className="space-y-4 mt-8">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton.Block key={i} h={48} w="100%" rounded="lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <ErrorState
        error={loadError}
        title={t('seller_onboarding_load_error_title')}
        message={t('seller_onboarding_load_error_msg')}
        resetErrorBoundary={() => window.location.reload()}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title={t('seller_onboarding_seo_title')} description={t('seller_onboarding_seo_desc')} />

      <div className="max-w-xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 mb-4">
            <Store size={24} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {t('seller_onboarding_title', 'Crear perfil de vendedor')}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {t('seller_onboarding_subtitle', 'Completa la información para empezar a vender en Rescatto.')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-1.5">
              {t('seller_name_label', 'Nombre del vendedor')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Store size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder={t('seller_name_ph', 'Ej. Tienda El Buen Sabor')}
                className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                  errors.name
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-200 focus:ring-emerald-400 focus:border-transparent'
                }`}
                disabled={submitting}
              />
            </div>
            {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name}</p>}
          </div>

          {/* Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-bold text-gray-700 mb-1.5">
              {t('seller_type_label', 'Tipo de vendedor')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                id="type"
                name="type"
                value={form.type}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-white border rounded-xl text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 transition-all ${
                  errors.type
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-200 focus:ring-emerald-400 focus:border-transparent'
                }`}
                disabled={submitting}
              >
                {SELLER_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey, opt.label)}
                  </option>
                ))}
              </select>
            </div>
            {errors.type && <p className="mt-1 text-xs text-red-500 font-medium">{errors.type}</p>}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-bold text-gray-700 mb-1.5">
              {t('seller_desc_label', 'Descripción')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <AlignLeft size={18} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none" />
              <textarea
                id="description"
                name="description"
                rows={3}
                value={form.description}
                onChange={handleChange}
                placeholder={t('seller_desc_ph', 'Describe qué vendes, tu propuesta de valor...')}
                className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-none ${
                  errors.description
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-200 focus:ring-emerald-400 focus:border-transparent'
                }`}
                disabled={submitting}
              />
            </div>
            {errors.description && <p className="mt-1 text-xs text-red-500 font-medium">{errors.description}</p>}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-1.5">
              {t('seller_phone_label', 'Teléfono')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder={t('seller_phone_ph', 'Ej. +57 300 123 4567')}
                className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                  errors.phone
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-200 focus:ring-emerald-400 focus:border-transparent'
                }`}
                disabled={submitting}
              />
            </div>
            {errors.phone && <p className="mt-1 text-xs text-red-500 font-medium">{errors.phone}</p>}
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className="block text-sm font-bold text-gray-700 mb-1.5">
              {t('seller_address_label', 'Dirección')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="address"
                name="address"
                type="text"
                value={form.address}
                onChange={handleChange}
                placeholder={t('seller_address_ph', 'Ej. Calle 123 #45-67')}
                className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                  errors.address
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-200 focus:ring-emerald-400 focus:border-transparent'
                }`}
                disabled={submitting}
              />
            </div>
            {errors.address && <p className="mt-1 text-xs text-red-500 font-medium">{errors.address}</p>}
          </div>

          {/* City */}
          <div>
            <label htmlFor="city" className="block text-sm font-bold text-gray-700 mb-1.5">
              {t('seller_city_label', 'Ciudad')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="city"
                name="city"
                type="text"
                value={form.city}
                onChange={handleChange}
                placeholder={t('seller_city_ph', 'Ej. Bogotá')}
                className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                  errors.city
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-200 focus:ring-emerald-400 focus:border-transparent'
                }`}
                disabled={submitting}
              />
            </div>
            {errors.city && <p className="mt-1 text-xs text-red-500 font-medium">{errors.city}</p>}
          </div>

          {/* Categories (chip-style multi-select) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              <Tag size={16} className="inline mr-1.5 -mt-0.5" />
              {t('seller_categories_label', 'Categorías')}
            </label>
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400">{t('seller_no_categories', 'No hay categorías disponibles')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const isSelected = form.categoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      disabled={submitting}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
                      }`}
                    >
                      {cat.icon && <span>{cat.icon}</span>}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting
                ? t('seller_onboarding_creating', 'Creando perfil...')
                : t('seller_onboarding_cta', 'Crear perfil de vendedor')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default withErrorBoundary(SellerOnboarding, 'Crear Perfil de Vendedor');

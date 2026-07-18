import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock all external deps
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: null, loading: false })) }));
vi.mock('../../context/ToastContext', () => ({ useToast: vi.fn(() => ({ success: vi.fn(), error: vi.fn() })) }));
vi.mock('../../hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
vi.mock('../../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../utils/formatters', () => ({ formatCOP: vi.fn((v: number) => `$${v.toLocaleString('es-CO')}`) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('../../components/customer/common/Loading', () => ({ LoadingSpinner: () => <div data-testid="loading-spinner">L</div> }));
vi.mock('../../components/customer/common/GuestConversionBanner', () => ({ GuestConversionBanner: () => <div data-testid="guest-banner">G</div> }));
vi.mock('../../services/firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), startAfter: vi.fn(), getDocs: vi.fn() }));
vi.mock('../../services/transactionService', () => ({ transactionService: { cancelByBuyer: vi.fn() } }));

import MyTransactions from '../../pages/customer/MyTransactions';
import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

const mockUser = { id: 'user-1', email: 'test@test.com' };

function renderMyTransactions(user = mockUser) {
  mockUseAuth.mockReturnValue({ user, loading: false });
  return render(<MemoryRouter><MyTransactions /></MemoryRouter>);
}

describe('MyTransactions', () => {
  it('shows guest banner when user is not logged in', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderMyTransactions(null);
    expect(screen.getByTestId('guest-banner')).toBeInTheDocument();
  });
});
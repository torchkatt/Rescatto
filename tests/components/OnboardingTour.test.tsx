import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ---- Mocks ----

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es', changeLanguage: vi.fn() },
  }),
}));

const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn().mockReturnValue('mock-doc-ref');

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

vi.mock('../../services/firebase', () => ({
  db: 'mock-db',
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../components/customer/common/Button', () => ({
  Button: ({ children, onClick, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} className={className} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

// Mock react-joyride
const mockJoyride = vi.fn();
vi.mock('react-joyride', () => {
  const STATUS = { FINISHED: 'finished', SKIPPED: 'skipped', RUNNING: 'running' };
  return {
    default: (props: Record<string, unknown>) => {
      mockJoyride(props);
      if (props.run) {
        return <div data-testid="joyride-active" />;
      }
      return <div data-testid="joyride-inactive" />;
    },
    STATUS,
  };
});

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

// ---- Import components under test ----
import { OnboardingTour as CustomerOnboardingTour } from '../../components/customer/OnboardingTour';
import { OnboardingTour as BusinessOnboardingTour } from '../../components/common/OnboardingTour';

// ========================================
// Customer OnboardingTour Tests
// ========================================
describe('Customer OnboardingTour', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', role: 'CUSTOMER' },
      isLoading: false,
      isAuthenticated: true,
    } as any);
  });

  it('renders first slide with translated title', () => {
    render(<CustomerOnboardingTour onComplete={mockOnComplete} />);

    expect(screen.getByText('onboarding_slide1_title')).toBeDefined();
    expect(screen.getByText('onboarding_slide1_desc')).toBeDefined();
  });

  it('clicking Next advances to the next slide', () => {
    render(<CustomerOnboardingTour onComplete={mockOnComplete} />);

    // First slide visible
    expect(screen.getByText('onboarding_slide1_title')).toBeDefined();

    // Click Next
    const nextButton = screen.getByText('onboarding_btn_next');
    fireEvent.click(nextButton);

    // Second slide visible
    expect(screen.getByText('onboarding_slide2_title')).toBeDefined();
    expect(screen.getByText('onboarding_slide2_desc')).toBeDefined();
  });

  it('progress dots update correctly when advancing slides', () => {
    const { container } = render(<CustomerOnboardingTour onComplete={mockOnComplete} />);

    // 4 dots total
    const dots = container.querySelectorAll('.h-2.rounded-full');
    expect(dots.length).toBe(4);

    // First dot is active (w-8)
    expect(dots[0].className).toContain('w-8');
    expect(dots[0].className).toContain('bg-emerald-500');
    expect(dots[1].className).toContain('w-2');
    expect(dots[1].className).toContain('bg-gray-200');

    // Advance to slide 2
    fireEvent.click(screen.getByText('onboarding_btn_next'));

    const updatedDots = container.querySelectorAll('.h-2.rounded-full');
    expect(updatedDots[0].className).toContain('w-2');
    expect(updatedDots[1].className).toContain('w-8');
    expect(updatedDots[1].className).toContain('bg-emerald-500');
  });

  it('last slide shows Start button instead of Next', () => {
    render(<CustomerOnboardingTour onComplete={mockOnComplete} />);

    // Advance through all slides to the last one
    fireEvent.click(screen.getByText('onboarding_btn_next')); // -> slide 2
    fireEvent.click(screen.getByText('onboarding_btn_next')); // -> slide 3
    fireEvent.click(screen.getByText('onboarding_btn_next')); // -> slide 4 (last)

    expect(screen.getByText('onboarding_slide4_title')).toBeDefined();
    expect(screen.getByText('onboarding_btn_start')).toBeDefined();
    expect(screen.queryByText('onboarding_btn_next')).toBeNull();
  });

  it('clicking skip calls handleFinish and updates Firestore', async () => {
    const { container } = render(<CustomerOnboardingTour onComplete={mockOnComplete} />);

    // The skip button is the X button (first button in the component, not the main action button)
    const skipButton = container.querySelector('button.absolute');
    expect(skipButton).not.toBeNull();

    await act(async () => {
      fireEvent.click(skipButton!);
    });

    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'users', 'user-123');
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', { hasSeenOnboarding: true });
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('on completion (last slide Start click), calls onComplete callback', async () => {
    render(<CustomerOnboardingTour onComplete={mockOnComplete} />);

    // Go to last slide
    fireEvent.click(screen.getByText('onboarding_btn_next')); // -> 2
    fireEvent.click(screen.getByText('onboarding_btn_next')); // -> 3
    fireEvent.click(screen.getByText('onboarding_btn_next')); // -> 4

    // Click Start on last slide
    await act(async () => {
      fireEvent.click(screen.getByText('onboarding_btn_start'));
    });

    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'users', 'user-123');
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', { hasSeenOnboarding: true });
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('all 4 slides use i18n keys (no hardcoded Spanish)', () => {
    render(<CustomerOnboardingTour onComplete={mockOnComplete} />);

    // Slide 1
    expect(screen.getByText('onboarding_slide1_title')).toBeDefined();
    expect(screen.getByText('onboarding_slide1_desc')).toBeDefined();

    fireEvent.click(screen.getByText('onboarding_btn_next'));
    // Slide 2
    expect(screen.getByText('onboarding_slide2_title')).toBeDefined();
    expect(screen.getByText('onboarding_slide2_desc')).toBeDefined();

    fireEvent.click(screen.getByText('onboarding_btn_next'));
    // Slide 3
    expect(screen.getByText('onboarding_slide3_title')).toBeDefined();
    expect(screen.getByText('onboarding_slide3_desc')).toBeDefined();

    fireEvent.click(screen.getByText('onboarding_btn_next'));
    // Slide 4
    expect(screen.getByText('onboarding_slide4_title')).toBeDefined();
    expect(screen.getByText('onboarding_slide4_desc')).toBeDefined();

    // Button labels are also i18n keys
    expect(screen.getByText('onboarding_btn_start')).toBeDefined();
  });
});

// ========================================
// Business OnboardingTour Tests
// ========================================
describe('Business OnboardingTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseAuth.mockReturnValue({
      user: { id: 'owner-456', role: 'VENUE_OWNER' },
      isLoading: false,
      isAuthenticated: true,
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render Joyride when hasSeenOnboarding=true', () => {
    render(<BusinessOnboardingTour isBusinessOwner={true} hasSeenOnboarding={true} />);

    // Timer never fires, run stays false
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('joyride-inactive')).toBeDefined();
    expect(screen.queryByTestId('joyride-active')).toBeNull();
  });

  it('does not render Joyride when isBusinessOwner=false', () => {
    render(<BusinessOnboardingTour isBusinessOwner={false} hasSeenOnboarding={false} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('joyride-inactive')).toBeDefined();
    expect(screen.queryByTestId('joyride-active')).toBeNull();
  });

  it('renders Joyride when conditions are met (isBusinessOwner=true, hasSeenOnboarding=false)', () => {
    render(<BusinessOnboardingTour isBusinessOwner={true} hasSeenOnboarding={false} />);

    // Before timer fires, Joyride should not be running
    expect(screen.getByTestId('joyride-inactive')).toBeDefined();

    // After the 1000ms delay, Joyride should start
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getByTestId('joyride-active')).toBeDefined();
  });

  it('uses i18n keys for locale buttons', () => {
    render(<BusinessOnboardingTour isBusinessOwner={true} hasSeenOnboarding={false} />);

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Verify that Joyride was called with i18n locale keys
    const lastCall = mockJoyride.mock.calls[mockJoyride.mock.calls.length - 1][0];
    expect(lastCall.locale).toEqual({
      back: 'tour_btn_back',
      close: 'tour_btn_close',
      last: 'tour_btn_last',
      next: 'tour_btn_next',
      skip: 'tour_btn_skip',
    });
  });
});

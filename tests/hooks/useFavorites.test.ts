import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as firestore from 'firebase/firestore';
import { useFavorites } from '../../hooks/useFavorites';

// Mock AuthContext
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

const mockGetDoc = vi.mocked(firestore.getDoc);
const mockUpdateDoc = vi.mocked(firestore.updateDoc);
const mockDoc = vi.mocked(firestore.doc);

describe('useFavorites hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockDoc.mockReturnValue({ id: 'user-1' } as any);
  });

  it('should return empty favorites for unauthenticated user', async () => {
    mockUseAuth.mockReturnValue({ user: null } as any);

    const { result } = renderHook(() => useFavorites());

    await act(async () => {});

    expect(result.current.favorites).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should load favorites from localStorage immediately', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } } as any);
    localStorage.setItem('rescatto_favs_user-1', JSON.stringify(['venue-1', 'venue-2']));

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ favorites: ['venue-1', 'venue-2'] }),
    } as any);

    const { result } = renderHook(() => useFavorites());

    // Should have local data immediately
    expect(result.current.favorites).toEqual(['venue-1', 'venue-2']);
  });

  it('isFavorite should return true for favorited venue', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } } as any);
    localStorage.setItem('rescatto_favs_user-1', JSON.stringify(['venue-1']));

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ favorites: ['venue-1'] }),
    } as any);

    const { result } = renderHook(() => useFavorites());

    expect(result.current.isFavorite('venue-1')).toBe(true);
    expect(result.current.isFavorite('venue-2')).toBe(false);
  });

  it('toggleFavorite should add a venue to favorites', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } } as any);
    // Mock for initial fetchRemote AND for the update
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ favorites: [] }),
    } as any);
    mockUpdateDoc.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFavorites());

    // Wait for the initial remote fetch to complete
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    // Now toggle - this should be stable since remote fetch is done
    await act(async () => {
      result.current.toggleFavorite('venue-new');
    });

    expect(result.current.isFavorite('venue-new')).toBe(true);
  });

  it('toggleFavorite should remove a venue already in favorites', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } } as any);
    localStorage.setItem('rescatto_favs_user-1', JSON.stringify(['venue-1']));

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ favorites: ['venue-1'] }),
    } as any);
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      const result2 = await result.current.toggleFavorite('venue-1');
      expect(result2).toBe(false); // Was removed
    });

    expect(result.current.isFavorite('venue-1')).toBe(false);
  });

  it('toggleFavorite should do nothing for unauthenticated user', async () => {
    mockUseAuth.mockReturnValue({ user: null } as any);

    const { result } = renderHook(() => useFavorites());

    const res = await act(async () => {
      return result.current.toggleFavorite('venue-1');
    });

    expect(res).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

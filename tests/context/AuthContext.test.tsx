import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import * as firebaseAuth from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import { UserRole } from '../../types';

// Mock services that AuthContext depends on
vi.mock('../../services/authService', () => ({
    authService: {
        login: vi.fn(),
        logout: vi.fn(),
        loginWithGoogle: vi.fn(),
        loginWithApple: vi.fn(),
        loginWithFacebook: vi.fn(),
        loginAsGuest: vi.fn(),
        convertGuestToUser: vi.fn(),
        resetPassword: vi.fn(),
    },
}));

vi.mock('../../services/roleService', () => ({
    roleService: {
        getAllRoles: vi.fn().mockResolvedValue([]),
    },
}));

import { AuthProvider, useAuth } from '../../context/AuthContext';

const mockOnAuthStateChanged = vi.mocked(firebaseAuth.onAuthStateChanged);
const mockOnSnapshot = vi.mocked(firestore.onSnapshot);
const mockDoc = vi.mocked(firestore.doc);
const mockGetDoc = vi.mocked(firestore.getDoc);

const makeFirebaseUser = (uid = 'uid-1') => ({ uid, email: 'test@test.com' } as any);
const makeUserDoc = (role: UserRole = UserRole.CUSTOMER) => ({
    exists: () => true,
    data: () => ({
        id: 'uid-1',
        email: 'test@test.com',
        fullName: 'Test User',
        role,
        venueId: null,
        venueIds: [],
        isVerified: true,
    }),
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(AuthProvider, null, children);

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDoc.mockReturnValue({ id: 'uid-1' } as any);
    });

    it('starts with isLoading=true and user=null', () => {
        mockOnAuthStateChanged.mockReturnValue(vi.fn());

        const { result } = renderHook(() => useAuth(), { wrapper });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('sets user after auth state change with valid Firestore doc', async () => {
        const unsubUser = vi.fn();
        const unsubAuth = vi.fn();

        mockOnAuthStateChanged.mockImplementation((_auth, callback: any) => {
            setTimeout(() => callback(makeFirebaseUser()), 0);
            return unsubAuth;
        });

        mockOnSnapshot.mockImplementation((_ref, callback: any) => {
            callback(makeUserDoc(UserRole.CUSTOMER));
            return unsubUser;
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(result.current.user).not.toBeNull();
        expect(result.current.user?.role).toBe(UserRole.CUSTOMER);
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.isLoading).toBe(false);
    });

    it('sets user=null and isLoading=false on logout', async () => {
        const unsubAuth = vi.fn();

        mockOnAuthStateChanged.mockImplementation((_auth, callback: any) => {
            // Immediately fire null (signed out)
            callback(null);
            return unsubAuth;
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await new Promise(r => setTimeout(r, 10));
        });

        expect(result.current.user).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('hasRole returns true for matching role', async () => {
        const unsubUser = vi.fn();

        mockOnAuthStateChanged.mockImplementation((_auth, callback: any) => {
            setTimeout(() => callback(makeFirebaseUser()), 0);
            return vi.fn();
        });

        mockOnSnapshot.mockImplementation((_ref, callback: any) => {
            callback(makeUserDoc(UserRole.ADMIN));
            return unsubUser;
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(result.current.hasRole([UserRole.ADMIN])).toBe(true);
        expect(result.current.hasRole([UserRole.CUSTOMER])).toBe(false);
        expect(result.current.hasRole([UserRole.ADMIN, UserRole.SUPER_ADMIN])).toBe(true);
    });

    it('sets user from Firebase Auth data when Firestore doc does not exist', async () => {
        const unsubUser = vi.fn();
        const firebaseUser = makeFirebaseUser();

        mockOnAuthStateChanged.mockImplementation((_auth, callback: any) => {
            setTimeout(() => callback(firebaseUser), 0);
            return vi.fn();
        });

        mockOnSnapshot.mockImplementation((_ref, callback: any) => {
            // Doc doesn't exist — AuthContext sets user from Firebase Auth
            callback({ exists: () => false, data: () => null });
            return unsubUser;
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        // User should be populated with Firebase Auth data
        expect(result.current.user).not.toBeNull();
        expect(result.current.user?.id).toBe(firebaseUser.uid);
        expect(result.current.user?.role).toBe(UserRole.CUSTOMER);
    });
});

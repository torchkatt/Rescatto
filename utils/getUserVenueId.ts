import { User } from '../types';

/**
 * Returns the primary venueId for a user, supporting both legacy `venueId`
 * and the newer `venueIds` array. Always prefer the first element of `venueIds`.
 */
export function getUserVenueId(user: User | null | undefined): string | null {
    if (!user) return null;
    return user.venueIds?.[0] ?? user.venueId ?? null;
}

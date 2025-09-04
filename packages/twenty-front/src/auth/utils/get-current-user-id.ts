/**
 * Get Current User ID Utility
 *
 * Provides access to the current user's ID.
 * This utility function can be called from anywhere in the frontend.
 * It uses localStorage and cookies to retrieve user information when Recoil state is not available.
 */

import { isDefined } from 'twenty-shared/utils';
import { cookieStorage } from '~/utils/cookie-storage';

/**
 * Get the current user's ID
 * @returns {string | null} The user ID or null if not logged in
 */
export const getCurrentUserId = (): string | null => {
  try {
    // Try to get token pair from cookies first (where Twenty stores auth tokens)
    const tokenPair = cookieStorage.getItem('tokenPair');
    if (tokenPair && typeof tokenPair === 'object') {
      // Decode the access token to get user ID
      const accessToken = (tokenPair as any).accessOrWorkspaceAgnosticToken
        ?.token;
      if (accessToken) {
        try {
          // JWT tokens have payload in the middle section (base64 encoded)
          const tokenParts = accessToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.sub || payload.userId || payload.id) {
              return payload.sub || payload.userId || payload.id;
            }
          }
        } catch (e) {
          // Token parsing failed, continue to fallback methods
        }
      }
    }

    // Fallback: try to get from localStorage (for development/testing)
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (isDefined(user?.id)) {
          return user.id;
        }
      } catch (e) {
        // JSON parsing failed, ignore
      }
    }

    // Final fallback: check for user ID in localStorage directly
    const userId = localStorage.getItem('userId');
    if (isDefined(userId)) {
      return userId;
    }

    return null;
  } catch (error) {
    console.warn('Failed to get current user ID:', error);
    return null;
  }
};

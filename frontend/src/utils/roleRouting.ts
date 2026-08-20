import type { UserRole } from '@/types/auth';

/** Home route for a given role -- used both for post-login redirect and to
 * bounce an authenticated-but-wrong-role user somewhere sensible. */
export function homeRouteForRole(role: UserRole): string {
  return role === 'SUPER_ADMIN' ? '/super-admin' : '/admin';
}

import type { User } from '@/store/useAuthStore';

export function routeForRole(role: User['role']): string {
  if (!role) return '/select-role';
  if (role === 'TEACHER') return '/teacher';
  if (role === 'PRINCIPAL') return '/principal';
  return '/';
}

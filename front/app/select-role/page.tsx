'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, GraduationCap, ShieldCheck, UserRound } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { routeForRole } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';

type SelectableRole = 'USER' | 'ADMIN' | 'TEACHER' | 'PRINCIPAL';

const roles: Array<{ value: SelectableRole; label: string; description: string; icon: typeof UserRound }> = [
  { value: 'USER', label: 'User', description: 'Use the standard application dashboard.', icon: UserRound },
  { value: 'ADMIN', label: 'Admin', description: 'Manage the application and its users.', icon: ShieldCheck },
  { value: 'TEACHER', label: 'Teacher', description: 'Complete your teaching profile and onboarding.', icon: GraduationCap },
  { value: 'PRINCIPAL', label: 'Principal', description: 'Complete your school and administrative onboarding.', icon: BriefcaseBusiness },
];

export default function SelectRolePage() {
  const router = useRouter();
  const { user, accessToken, setAuth, isHydrated, isAuthenticated } = useAuthStore();
  const [selectedRole, setSelectedRole] = useState<SelectableRole>('USER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated || !user || !accessToken) {
      router.replace('/login');
      return;
    }
    if (user.role) router.replace(routeForRole(user.role));
  }, [accessToken, isAuthenticated, isHydrated, router, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken || !user) return;

    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi('/auth/role', {
        method: 'POST',
        body: JSON.stringify({ role: selectedRole }),
      }, accessToken);
      setAuth(result.user, result.accessToken, result.refreshToken);
      router.replace(routeForRole(result.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign your role');
    } finally {
      setLoading(false);
    }
  };

  if (!isHydrated || !user || user.role) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto my-12 px-4">
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 md:p-8 shadow-xl">
        <div className="mb-7">
          <p className="text-sm font-semibold text-primary">One last step</p>
          <h1 className="font-heading text-3xl font-bold mt-1">Choose your role</h1>
          <p className="text-muted-foreground text-sm mt-2">This choice is saved to your account and controls where you go next.</p>
        </div>

        {error && <p className="bg-destructive/15 border border-destructive text-destructive rounded-md p-3 text-sm mb-5">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map(({ value, label, description, icon: Icon }) => (
              <label key={value} className={`flex gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${selectedRole === value ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/60'}`}>
                <input type="radio" name="role" value={value} checked={selectedRole === value} onChange={() => setSelectedRole(value)} className="mt-1" />
                <span>
                  <span className="flex items-center gap-2 font-semibold"><Icon className="w-4 h-4 text-primary" />{label}</span>
                  <span className="block text-xs text-muted-foreground mt-1">{description}</span>
                </span>
              </label>
            ))}
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary disabled:opacity-50">
            {loading ? 'Saving role...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

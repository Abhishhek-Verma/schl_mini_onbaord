'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { TokenInspector } from '@/components/TokenInspector';
import { Shield, Server } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!user?.role) {
      router.replace('/select-role');
    } else if (user.role === 'TEACHER') {
      router.replace('/teacher');
    } else if (user.role === 'PRINCIPAL') {
      router.replace('/principal');
    }
  }, [isHydrated, isAuthenticated, user?.role, router]);

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="px-4 space-y-8 py-6">
      {/* Token Inspector Component */}
      <TokenInspector />
    </div>
  );
}

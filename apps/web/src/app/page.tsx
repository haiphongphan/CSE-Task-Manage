'use client';
// Trang gốc "/": chuyển hướng tới trang chủ theo vai trò
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homeOf, useAuth } from '@/lib/auth';
import { Loading } from '@/components/ui';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(user ? homeOf(user.role) : '/login');
  }, [user, loading, router]);
  return <Loading />;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/quotes');
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold">MechQuote</h1>
        <p className="mt-2">Mekanik Teklif Otomasyon Sistemi</p>
        <p className="mt-4">Yönlendiriliyorsunuz...</p>
      </div>
    </main>
  );
}

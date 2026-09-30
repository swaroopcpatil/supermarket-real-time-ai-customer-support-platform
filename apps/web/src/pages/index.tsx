import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-slate-500 font-medium animate-pulse">Redirecting to sign in...</p>
    </div>
  );
}

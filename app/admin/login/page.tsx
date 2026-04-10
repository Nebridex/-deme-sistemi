'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin } from '@/lib/auth';
import { firebaseConfigError, isFirebaseConfigured } from '@/lib/firebase';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await adminLogin(email, password);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center p-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold">Firebase configuration required</h1>
          <p className="mt-2 text-sm text-rose-700">{firebaseConfigError}</p>
          <p className="mt-2 text-sm text-slate-600">Please set your `.env.local` with NEXT_PUBLIC_FIREBASE_* values and restart app.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-5">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <input required type="email" placeholder="Email" className="w-full rounded-lg border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required type="password" placeholder="Password" className="w-full rounded-lg border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-70">{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  );
}

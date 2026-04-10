import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">Cafe Bill Management MVP</h1>
      <p className="text-slate-600">Admin manages tables from dashboard. Customers access bill only via secure public token link.</p>
      <div className="flex gap-3">
        <Link className="rounded-lg bg-slate-900 px-4 py-2 text-white" href="/admin">Go to Admin</Link>
        <Link className="rounded-lg bg-white px-4 py-2 text-slate-900" href="/admin/login">Admin Login</Link>
      </div>
    </main>
  );
}

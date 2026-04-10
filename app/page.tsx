import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">Cafe Bill Management MVP</h1>
      <p className="text-slate-600">Use admin area for management or open a table route directly for customer view.</p>
      <div className="flex gap-3">
        <Link className="rounded-lg bg-slate-900 px-4 py-2 text-white" href="/admin">
          Go to Admin
        </Link>
        <Link className="rounded-lg bg-white px-4 py-2 text-slate-900" href="/t/demo-table-1">
          Open Demo Table
        </Link>
      </div>
    </main>
  );
}

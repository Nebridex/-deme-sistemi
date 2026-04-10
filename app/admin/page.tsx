'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/app/components/AuthGuard';
import { TableCard } from '@/app/components/TableCard';
import { adminLogout } from '@/lib/auth';
import { createTable, deleteTable, subscribeTables, updateTable } from '@/lib/firestore';
import type { CafeTable } from '@/types';

function AdminDashboardContent() {
  const router = useRouter();
  const [tables, setTables] = useState<CafeTable[]>([]);

  useEffect(() => subscribeTables(setTables), []);

  const addTable = async () => {
    const name = window.prompt('Table name', `Table ${tables.length + 1}`)?.trim();
    if (!name) return;
    await createTable(name);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-4 md:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cafe Admin Dashboard</h1>
          <p className="text-sm text-slate-600">Manage all tables and live bill state.</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-white" onClick={addTable}>
            + Add Table
          </button>
          <button
            className="rounded-lg border px-4 py-2"
            onClick={async () => {
              await adminLogout();
              router.replace('/admin/login');
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onDelete={deleteTable}
            onRename={(id, name) => updateTable(id, { name })}
            onToggleStatus={(id, status) => updateTable(id, { status })}
          />
        ))}
        {!tables.length && <div className="rounded-xl bg-white p-5 text-slate-500 shadow-sm">No tables yet. Add your first table.</div>}
      </section>
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <AuthGuard>
      <AdminDashboardContent />
    </AuthGuard>
  );
}

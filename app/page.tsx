import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">Kafe QR Hesap Yönetimi</h1>
      <p className="text-slate-600">Yönetici masaları panelden yönetir, müşteriler hesabı sadece güvenli QR bağlantısı ile görür.</p>
      <div className="flex gap-3">
        <Link className="rounded-lg bg-slate-900 px-4 py-2 text-white" href="/admin">Yönetim Paneli</Link>
        <Link className="rounded-lg bg-white px-4 py-2 text-slate-900" href="/admin/login">Yönetici Girişi</Link>
      </div>
    </main>
  );
}

# Kafe QR Hesap Yönetimi (Firebase Entegre) ccc

Next.js + TypeScript + Tailwind + Firebase App/Firestore/Auth integration.

## Rotalar
- Yönetici giriş: `/admin/login`
- Yönetici paneli: `/admin`
- Masa detay: `/admin/tables/[tableId]`
- Müşteri canlı hesap: `/t/[publicToken]`

## Firebase collections
- `cafes`
- `cafeUsers`
- `tables`
- `tableItems`
- `publicTables`
- `tableActivityLogs`
- `payments` (backend-only scaffold)
- `splitSessions` (backend-only scaffold)
- `tableSettlements` (backend-only scaffold)

## Required environment (.env.local)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_APP_URL=https://minifabrika.online
NEXT_PUBLIC_APP_BASE_URL=https://minifabrika.online
NEXT_PUBLIC_APP_NAME=MiniFabrika Adisyon Pilot
NEXT_PUBLIC_APP_DESCRIPTION=QR destekli restoran adisyon ve masa yönetimi
NEXT_PUBLIC_APP_ENV=production
```

If these are missing, the app shows a configuration error and blocks auth/data operations.

## Firebase kurulum adımları
1. **Authentication > Email/Password** açın.
2. **Self sign-up kapalı tutun**: kullanıcı hesaplarını Firebase Console veya Admin SDK üzerinden manuel açın (public register flow yok).
3. Firestore veritabanını (Native mode) oluşturun.
4. Admin kullanıcılar için `cafeUsers/{uid}` dökümanı ekleyin:
   - `cafeId`
   - `email`
   - `role` = `owner` veya `manager`
5. Uygulama için gerekli koleksiyonları oluşturun (`tables`, `tableItems`, `publicTables`, `tableActivityLogs`, `completedSessions`).
6. `firestore.rules` dosyasını deploy edin.

## Vercel deploy adımları (minifabrika.online)
1. Repo’yu Vercel’e bağlayın ve production branch'i bu release'i taşıyan dalda tutun. Canlı dağıtım eski bir dalda kalırsa Firestore rules ve uygulama kodu birbirinden kopar.
2. Domain olarak `minifabrika.online` ekleyin.
3. **Project Settings > Environment Variables** bölümüne yukarıdaki tüm `NEXT_PUBLIC_*` değişkenleri **Production** scope ile girin.
4. Build command: `npm run build`, Output: Next.js default.
5. Deploy sonrası `/admin/login` üzerinden giriş testi yapın.

## Firebase Console ayarları (production)
- **Authentication > Sign-in method**
  - Email/Password: **Enabled**
  - Email link / anonim / sosyal sağlayıcılar: **Disabled** (private admin kullanım)
- **Authentication > Settings**
  - Authorized domains: `minifabrika.online`
- **Firestore**
  - Production mode
  - `firestore.rules` deploy edilmiş olmalı
  - Gerekli indeksleri Firestore hata linklerinden oluşturarak tamamlayın (özellikle `where + orderBy` kullanılan dashboard sorguları)
- **Users / cafeUsers**
  - Her admin için Auth user + eşleşen `cafeUsers/{uid}` dokümanı (`cafeId`, `email`, `role`) zorunlu

## Entegrasyon notları
- Firebase app tek örnekli (`getApps` guard).
- Yönetici oturumu Firebase Auth default persistence ile sürer.
- Yönetici rotaları, auth listener + `cafeUsers` rol kontrolü ile korunur.
- Dashboard ve müşteri sayfası `onSnapshot` ile gerçek zamanlıdır.
- Kritik bütünlük akışları bu pilotta doğrudan Firestore istemci akışıyla çalışır.

## Güvenlik sınırı
Toplam tutar / ürün adedi / public projection bütünlüğü bu pilotta istemci akışları ile yönetilir.

## Firestore kural durumu (hardening)
- Ham `tables` ve `tableItems` koleksiyonları public okunmaz; müşteri QR sayfası yalnızca token-keyed `publicTables` projection verisini okur.
- `publicTables` yazımı yalnızca projection'ın `cafeId` alanı oturumdaki kullanıcının tek kafesiyle eşleştiğinde yapılır.
- `tableItems` ve `tableActivityLogs` yazımları cafe/table ilişkisi doğrulaması ile sınırlandırılmıştır.
- `completedSessions` yalnızca admin-auth kullanıcı tarafından, doğrulanmış session item payload şekli ile yazılabilir.
- `payments`, `splitSessions`, `tableSettlements` koleksiyonları istemciye tamamen kapalıdır.
- Pilot akışta projection/log yazımları doğrudan Firestore istemcisinden yapılır; ödeme veya daha yüksek bütünlük gerektiren mutasyonlardan önce güvenilir bir bütünlük sınırı tasarlanmalıdır.

## Pilot manuel test checklist (prod)
1. Masa aç.
2. Aynı masaya 2 ürün ekle.
3. Masa kartında `Toplam` ve `Ürün` alanlarının anlık güncellendiğini doğrula.
4. `Adisyonu Kapat` işlemini yap.
5. Firestore'da `cafes/{cafeId}/salesLogs/{saleId}` kaydının oluştuğunu doğrula.
6. Dashboard'da `Bugünkü Kapanan Masa Cirosu` metrik artışını doğrula.
7. Sayfayı F5 ile yenile.
8. Ciro/metriklerin korunup korunmadığını doğrula.
9. `/admin/reports` sayfasında ilgili masanın ciro/satış kaydını doğrula.

## Çoklu işletme onboarding (manuel davet)
Bu sistemde her Firebase Auth kullanıcısı yalnızca **tek bir** `cafeId` kullanır.
Public signup yoktur.

1. Firebase Console → Authentication → kullanıcıyı email/password ile ekle.
2. Kullanıcının `uid` bilgisini kopyala.
3. Firestore'da `cafes/{newCafeId}` oluştur:
   - `name`, `status: "active"`, `ownerUid`, `createdAt`, `updatedAt`
4. Firestore'da `cafeUsers/{uid}` oluştur:
   - `email`, `role: "owner" | "manager"`, `cafeId: newCafeId`, `createdAt`, `updatedAt`
5. Kullanıcı `/admin/login` ile giriş yaptığında yalnızca kendi `cafeId` verisini görür.
6. Yeni kafede ilk masa/ürün işlemi projection'ı üretir; müşteri QR ekranı projection'daki kafe adını ve hesap verisini gösterir.

## Production smoke test checklist (manual)
1. **Admin login**
   - `/admin/login` ile giriş yapılır.
   - Public signup/register akışı yoktur.
2. **Table + item flow**
   - Sabit masada ürün ekle: `tableItems` oluşturulur, masa toplamı anında artar.
   - Ürün düzenle/sil: masa toplamı anında güncellenir.
3. **Completion flow**
   - Sabit masa tamamla: `completedSessions` kaydı oluşur, aktif ürünler arşivlenir, masa `Yeni müşteri için hazır` olur.
   - Geçici sipariş tamamla: history kaydı oluşur ve sipariş kapanır.
4. **Dashboard**
   - Tamamlanan Siparişler / Adisyon Geçmişi yeni kapanışı gösterir.
   - Son İşlemler logları gösterir.
5. **Public/QR link**
   - Masa detayındaki URL `https://minifabrika.online/t/<token>` formatında olmalı.

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
NEXT_PUBLIC_APP_URL=https://adisyon.minifabrika.online
NEXT_PUBLIC_APP_BASE_URL=https://adisyon.minifabrika.online
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

## Vercel deploy adımları (adisyon.minifabrika.online)
1. Repo’yu Vercel’e bağlayın ve Production branch olarak `release/admin-stable` seçin.
2. Domain olarak `adisyon.minifabrika.online` ekleyin.
3. **Project Settings > Environment Variables** bölümüne yukarıdaki tüm `NEXT_PUBLIC_*` değişkenleri **Production** scope ile girin.
4. Build command: `npm run build`, Output: Next.js default.
5. Deploy sonrası `/admin/login` üzerinden giriş testi yapın.

## Firebase Console ayarları (production)
- **Authentication > Sign-in method**
  - Email/Password: **Enabled**
  - Email link / anonim / sosyal sağlayıcılar: **Disabled** (private admin kullanım)
- **Authentication > Settings**
  - Authorized domains: `adisyon.minifabrika.online`
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
- Kritik bütünlük akışları için callable sınırı hazırdır:
  - `recomputeTableAggregates`
  - `syncPublicTableProjection`
  - `rotatePublicToken`
  - Fonksiyonlar yoksa istemci fallback akışı devreye girer.

## Güvenlik sınırı
Toplam tutar / ürün adedi / public projection bütünlüğü için üretimde Cloud Functions + Admin SDK ile tam backend otoritesi önerilir. Bu repo, o geçiş için callable sınırını ve data modelini hazırlar.

## Firestore kural durumu (hardening)
- `publicTables` yazımı artık yalnızca admin-auth ve canonical `tables` verisiyle birebir uyumlu payload kabul eder.
- `tableItems` ve `tableActivityLogs` yazımları cafe/table ilişkisi doğrulaması ile sınırlandırılmıştır.
- `completedSessions` yalnızca admin-auth kullanıcı tarafından, doğrulanmış session item payload şekli ile yazılabilir.
- `payments`, `splitSessions`, `tableSettlements` koleksiyonları istemciye tamamen kapalıdır.
- Geçiş dönemi uyumluluğu için client fallback projection/log yazımları hâlâ minimum ölçüde açık tutulur; callable deploy sonrası backend-only yapılmalıdır.

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
   - Masa detayındaki URL `https://adisyon.minifabrika.online/t/<token>` formatında olmalı.

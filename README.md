# Kafe QR Hesap Yönetimi (Firebase Entegre)

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
NEXT_PUBLIC_APP_NAME=MiniFabrika Adisyon Pilot
NEXT_PUBLIC_APP_DESCRIPTION=QR destekli restoran adisyon ve masa yönetimi
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
- `payments`, `splitSessions`, `tableSettlements` koleksiyonları istemciye tamamen kapalıdır.
- Geçiş dönemi uyumluluğu için client fallback projection/log yazımları hâlâ minimum ölçüde açık tutulur; callable deploy sonrası backend-only yapılmalıdır.

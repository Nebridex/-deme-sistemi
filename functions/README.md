# Functions Scaffold (Sunucu Kontrollü Veri Bütünlüğü)

Bu klasör, kritik bütünlük akışlarını istemciden backend'e taşıma sınırıdır.

## Hedef callable uçlar
- `recomputeTableAggregates({ tableId, cafeId })`
- `syncPublicTableProjection({ tableId, cafeId })`
- `rotatePublicToken({ tableId, actorUid })` (yalnızca owner)

## Mevcut durum
- İstemci tarafında `lib/backendIntegrity.ts` callable uçları dener.
- Fonksiyonlar henüz deploy edilmemişse otomatik olarak güvenli istemci fallback akışına döner.
- Bu sayede mevcut çalışan akışlar bozulmadan backend geçişi hazırlanmış olur.

## Üretime geçiş adımı
1. `functions/src/integrity.js` dosyasını gerçek `firebase-functions` + `firebase-admin` koduyla tamamla.
2. Callable uçları deploy et.
3. Firestore kurallarında aggregate/projection alanları için doğrudan istemci update iznini daralt.

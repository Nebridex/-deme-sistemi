# Functions Durumu

Bu pilot dağıtımda Cloud Functions **kullanılmaz**.

- Uygulama çalışma zamanında yalnızca doğrudan Firestore istemci akışlarını kullanır.
- `functions/src/integrity.js` yalnızca bilgilendirme amaçlı scaffold dosyasıdır.
- Tarayıcı tarafında callable/Firebase Functions ağ çağrısı yapılmamalıdır.

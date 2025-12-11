
# MechQuote - Mekanik Tesisat Firmaları için Modern Teklif Yönetim Sistemi

MechQuote, mekanik tesisat, ısıtma, soğutma ve havalandırma (HVAC) sektöründeki firmaların teklif hazırlama, maliyet analizi ve proje yönetimi süreçlerini dijitalleştirmek ve otomatize etmek için tasarlanmış modern bir web uygulamasıdır. Bu uygulama, karmaşık teklif süreçlerini basitleştirir, hataları en aza indirir ve işletmenizin verimliliğini artırır.

## Temel Özellikler

- **Müşteri Yönetimi (CRM):** Müşteri bilgilerinizi, adreslerini ve onlarla olan tüm etkileşim geçmişinizi (notlar, telefon görüşmeleri) tek bir yerden yönetin.
- **Akıllı Ürün Kataloğu:** Ürünlerinizi, malzemelerinizi ve hizmetlerinizi; marka, model, maliyet ve satış fiyatı gibi detaylarla birlikte merkezi bir veritabanında saklayın.
- **Detaylı Teklif Oluşturma:**
    - Ürünleri kategorilere ayrılmış bir seçiciyle tekliflerinize hızla ekleyin.
    - Her kalem için iskonto ve kâr marjı oranlarını anında ayarlayın.
    - Döviz kurlarını (USD/EUR) TCMB'den otomatik çekerek anlık maliyet ve satış fiyatlarını görün.
- **Revizyon ve Versiyon Takibi:** Oluşturulan bir teklifin birden çok versiyonunu (revizyonunu) kolayca oluşturun ve takip edin.
- **Reçete Yönetimi:** "Kombi Montajı" gibi bir iş kaleminin hangi alt malzemelerden ve işçiliklerden oluştuğunu tanımlayan reçeteler oluşturarak standartlaştırılmış ve hatasız teklifler hazırlayın.
- **Şablon Yönetimi:** Sık kullanılan teklif yapılarını şablon olarak kaydederek yeni teklifleri saniyeler içinde başlatın.
- **İş Atama ve Hakediş Takibi:** Onaylanan teklifleri sahadaki ustalarınıza atayın ve onlara yapılacak ödemeleri yönetin.
- **Yazdırılabilir ve İhraç Edilebilir Çıktılar:** Hazırlanan teklifleri kurumsal kimliğinize uygun, profesyonel bir formatta PDF olarak yazdırın veya Excel'e aktarın.
- **Veri İthalatı:** Mevcut ürün listelerinizi Excel formatında sisteme toplu olarak yükleyin.

## Teknoloji Mimarisi

- **Frontend:** [Next.js](https://nextjs.org/) (App Router), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Backend & Veritabanı:** [Firebase](https://firebase.google.com/) (Firestore, Authentication)
- **UI Kütüphanesi:** [shadcn/ui](https://ui.shadcn.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Form Yönetimi:** [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)

## Kurulum ve Çalıştırma

Bu projeyi kendi bilgisayarınızda kurmak ve çalıştırmak için aşağıdaki adımları izleyin.

### 1. Ön Koşullar

- **Node.js:** v18.17.0 veya daha güncel bir sürüm.
- **npm** veya **yarn** paket yöneticisi.
- **Firebase Hesabı:** Ücretsiz bir [Firebase](https://firebase.google.com/) hesabı oluşturun.

### 2. Projeyi Klonlama

Bu depoyu bilgisayarınıza klonlayın:
```bash
git clone https://github.com/KULLANICI_ADINIZ/REPO_ADINIZ.git
cd REPO_ADINIZ
```

### 3. Bağımlılıkları Yükleme

Proje dizininde, gerekli tüm paketleri yüklemek için aşağıdaki komutu çalıştırın:
```bash
npm install
```

### 4. Firebase Projesi Oluşturma

1.  [Firebase Console](https://console.firebase.google.com/)'a gidin ve yeni bir proje oluşturun.
2.  Proje kontrol panelinizden, sol menüdeki "Proje Ayarları" (dişli ikonu) seçeneğine tıklayın.
3.  "Genel" sekmesi altında, "Uygulamalarım" bölümüne gelin ve bir **Web uygulaması** (`</>`) oluşturun.
4.  Uygulamanızı kaydettikten sonra, size `firebaseConfig` adında bir JavaScript nesnesi verilecektir. Bu nesneyi kopyalayın.

### 5. Ortam Değişkenlerini Ayarlama

Projenin ana dizininde `.env.local` adında yeni bir dosya oluşturun. Bu dosyanın içine, bir önceki adımda Firebase'den kopyaladığınız yapılandırma bilgilerini aşağıdaki gibi yerleştirin:

```.env.local
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
```

**Önemli:** `firebaseConfig` nesnesindeki değerleri tırnak işaretleri içine doğru bir şekilde kopyaladığınızdan emin olun. Bu dosya gizli bilgilerinizi içerir ve `.gitignore` dosyası sayesinde Git reponuza dahil edilmez.

### 6. Geliştirme Sunucusunu Başlatma

Tüm kurulum tamamlandıktan sonra, geliştirme sunucusunu başlatmak için aşağıdaki komutu çalıştırın:

```bash
npm run dev
```

Uygulama varsayılan olarak `http://localhost:9002` adresinde çalışmaya başlayacaktır. Tarayıcınızda bu adresi açarak uygulamayı kullanmaya başlayabilirsiniz.

## Mevcut Komutlar

- `npm run dev`: Geliştirme sunucusunu başlatır.
- `npm run build`: Uygulamayı production (canlı) ortamı için build eder.
- `npm run start`: Production build'ini çalıştırır.
- `npm run lint`: Kod stilini ve olası hataları kontrol eder.


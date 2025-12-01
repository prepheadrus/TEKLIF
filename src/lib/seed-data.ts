
export type InitialInstallationType = {
  name: string;
  description: string;
};

export const initialInstallationTypesData: InitialInstallationType[] = [
  // 1. Ana Kategori ve Altları
  { name: 'Sıhhi Tesisat (Plumbing)', description: 'Binanın su ihtiyacının karşılanması ve atık suyun uzaklaştırılmasını kapsar.' },
  { name: 'Sıhhi Tesisat (Plumbing) > Temiz Su Tesisatı', description: 'Soğuk su hatları, sıcak su hatları, sirkülasyon hatları.' },
  { name: 'Sıhhi Tesisat (Plumbing) > Pis Su (Atık Su) Tesisatı', description: 'Bina içi pis su, rögarlar, yağ ayırıcılar.' },
  { name: 'Sıhhi Tesisat (Plumbing) > Yağmur Suyu Tesisatı', description: 'Çatı ve balkon süzgeçleri, yağmur iniş boruları, drenaj pompaları.' },
  { name: 'Sıhhi Tesisat (Plumbing) > Depolama ve Basınçlandırma', description: 'Su depoları (betonarme/modüler), hidrofor sistemleri, genleşme tankları.' },
  { name: 'Sıhhi Tesisat (Plumbing) > Su Arıtma ve Yumuşatma', description: 'Filtrasyon, klorlama, su yumuşatma cihazları.' },
  { name: 'Sıhhi Tesisat (Plumbing) > Vitrifiye ve Armatür Montajları', description: 'Lavabo, klozet, batarya, duş tekneleri.' },

  // 2. Ana Kategori ve Altları
  { name: 'Isıtma Tesisatı (Heating)', description: 'Binaların ısıtılması ve sıcak su ihtiyaçlarının karşılanması.' },
  { name: 'Isıtma Tesisatı (Heating) > Isı Üretim Sistemleri (Merkezi/Bireysel)', description: 'Kazanlar (doğalgaz/katı yakıt), kombiler, kaskad sistemler.' },
  { name: 'Isıtma Tesisatı (Heating) > Isı Transfer Üniteleri', description: 'Radyatörler, yerden ısıtma boruları, konvektörler, apareyler.' },
  { name: 'Isıtma Tesisatı (Heating) > Isı Pompası Sistemleri', description: 'Hava/su kaynaklı ısı pompaları.' },
  { name: 'Isıtma Tesisatı (Heating) > Boru ve Dağıtım Hatları', description: 'Kolon hatları, branşmanlar, kollektör grupları.' },
  { name: 'Isıtma Tesisatı (Heating) > Baca Sistemleri', description: 'Çelik bacalar, kaskad bacalar.' },

  // 3. Ana Kategori ve Altları
  { name: 'Soğutma ve İklimlendirme (HVAC)', description: 'Ortam havasının soğutulması ve şartlandırılması.' },
  { name: 'Soğutma ve İklimlendirme (HVAC) > Merkezi Soğutma Grupları', description: 'Chiller (Soğutma grubu) üniteleri, soğutma kuleleri.' },
  { name: 'Soğutma ve İklimlendirme (HVAC) > Değişken Debili Sistemler', description: 'VRF / VRV dış ve iç üniteler.' },
  { name: 'Soğutma ve İklimlendirme (HVAC) > Bireysel Klimalar', description: 'Split klimalar, multi-split sistemler.' },
  { name: 'Soğutma ve İklimlendirme (HVAC) > Uç Birimler', description: 'Fan-Coil cihazları (kaset, gizli tavan, döşeme tipi).' },
  { name: 'Soğutma ve İklimlendirme (HVAC) > Soğutma Borulaması', description: 'Bakır borulama, siyah çelik borulama (Chiller için), izolasyon.' },

  // 4. Ana Kategori ve Altları
  { name: 'Havalandırma Tesisatı (Ventilation)', description: 'İç mekan hava kalitesinin sağlanması ve hava sirkülasyonu.' },
  { name: 'Havalandırma Tesisatı (Ventilation) > Havalandırma Cihazları', description: 'Klima santralleri (AHU), ısı geri kazanım cihazları (VAM).' },
  { name: 'Havalandırma Tesisatı (Ventilation) > Fanlar ve Aspiratörler', description: 'Egzoz fanları, çatı tipi fanlar, banyo/wc aspiratörleri.' },
  { name: 'Havalandırma Tesisatı (Ventilation) > Kanal Sistemi', description: 'Galvaniz hava kanalları, esnek (flexible) kanallar, tekstil kanallar.' },
  { name: 'Havalandırma Tesisatı (Ventilation) > Hava Dağıtım Elemanları', description: 'Menfezler, difüzörler, panjurlar, damperler (yangın/hava ayar).' },
  { name: 'Havalandırma Tesisatı (Ventilation) > Özel Havalandırma', description: 'Sığınak havalandırması (radyoaktif filtreli), mutfak davlumbaz egzozları.' },

  // 5. Ana Kategori ve Altları
  { name: 'Yangın Söndürme Tesisatı (Fire Protection)', description: 'Yangına müdahale ve can/mal güvenliği sistemleri.' },
  { name: 'Yangın Söndürme Tesisatı (Fire Protection) > Sulu Söndürme Sistemleri', description: 'Sprinkler (yağmurlama) hatları, yangın dolapları.' },
  { name: 'Yangın Söndürme Tesisatı (Fire Protection) > Yangın Pompa Dairesi', description: 'Dizel ve elektrikli yangın pompaları, jokey pompalar.' },
  { name: 'Yangın Söndürme Tesisatı (Fire Protection) > Saha Tesisatı', description: 'Yangın hidrantları, itfaiye su alma ağızları.' },
  { name: 'Yangın Söndürme Tesisatı (Fire Protection) > Gazlı Söndürme Sistemleri', description: 'FM200, Novec, CO2 sistemleri (genelde elektrik/server odaları için).' },
  { name: 'Yangın Söndürme Tesisatı (Fire Protection) > Duman Tahliye Sistemleri', description: 'Duman damperleri, basınçlandırma fanları (merdiven/asansör).' },

  // 6. Ana Kategori ve Altları
  { name: 'Doğalgaz Tesisatı', description: 'Gaz yakıcı cihazlara güvenli gaz iletimi.' },
  { name: 'Doğalgaz Tesisatı > Altyapı', description: 'Ana servis kutusu, polietilen (PE) yeraltı hatları.' },
  { name: 'Doğalgaz Tesisatı > Bina İçi Tesisat', description: 'Kolon hatları, daire içi ocak/kombi tesisatları.' },
  { name: 'Doğalgaz Tesisatı > Endüstriyel Gaz', description: 'LNG veya LPG tank sahaları ve dağıtım hatları.' },
  
  // 7. Ana Kategori ve Altları
  { name: 'Endüstriyel ve Özel Tesisatlar (Proje Tipine Göre)', description: 'Projeye özel endüstriyel proses ve medikal sistemler.' },
  { name: 'Endüstriyel ve Özel Tesisatlar (Proje Tipine Göre) > Basınçlı Hava Tesisatı', description: 'Kompresörler, kurutucular ve dağıtım boruları.' },
  { name: 'Endüstriyel ve Özel Tesisatlar (Proje Tipine Göre) > Buhar ve Kondens Tesisatı', description: 'Buhar kazanları, kondens tankları (Sanayi, otel, hastane).' },
  { name: 'Endüstriyel ve Özel Tesisatlar (Proje Tipine Göre) > Medikal Gaz Tesisatı', description: 'Oksijen, vakum, azot protoksit hatları (Hastaneler için).' },
  { name: 'Endüstriyel ve Özel Tesisatlar (Proje Tipine Göre) > Gri Su Sistemleri', description: 'Atık suyun geri kazanılıp rezervuarlarda kullanımı.' },

  // 8. Ana Kategori ve Altları
  { name: 'Mekanik Otomasyon (BMS - Building Management System)', description: 'Mekanik cihazların elektrik ile haberleştiği noktadır.' },
  { name: 'Mekanik Otomasyon (BMS - Building Management System) > Saha Elemanları', description: 'Sensörler (sıcaklık, nem, basınç), motorlu vanalar, termostatlar.' },
  { name: 'Mekanik Otomasyon (BMS - Building Management System) > Kontrol Panelleri', description: 'MCC (Motor Control Center) panoları, DDC panelleri.' },
];

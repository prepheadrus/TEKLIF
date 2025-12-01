
type InitialInstallationType = {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
};

// --- Main Disciplines ---
const mainDisciplines: InitialInstallationType[] = [
  { id: '1', name: 'Sıhhi Tesisat (Plumbing)', description: 'Binanın su ihtiyacının karşılanması ve atık suyun uzaklaştırılmasını kapsar.', parentId: null },
  { id: '2', name: 'Isıtma Tesisatı (Heating)', description: 'Binaların ısıtılması ve sıcak su ihtiyaçlarının karşılanması.', parentId: null },
  { id: '3', name: 'Soğutma ve İklimlendirme (HVAC)', description: 'Ortam havasının soğutulması ve şartlandırılması.', parentId: null },
  { id: '4', name: 'Havalandırma Tesisatı (Ventilation)', description: 'İç mekan hava kalitesinin sağlanması ve hava sirkülasyonu.', parentId: null },
  { id: '5', name: 'Yangın Söndürme Tesisatı (Fire Protection)', description: 'Yangına müdahale ve can/mal güvenliği sistemleri.', parentId: null },
  { id: '6', name: 'Doğalgaz Tesisatı', description: 'Gaz yakıcı cihazlara güvenli gaz iletimi.', parentId: null },
  { id: '7', name: 'Endüstriyel ve Özel Tesisatlar', description: 'Projeye özel endüstriyel proses ve medikal sistemler.', parentId: null },
  { id: '8', name: 'Mekanik Otomasyon (BMS)', description: 'Bina Yönetim Sistemleri ile mekanik cihazların kontrolü.', parentId: null },
];

// --- Sub-Categories ---
const subCategories: InitialInstallationType[] = [
  // 1. Sıhhi Tesisat
  { id: '101', name: 'Temiz Su Tesisatı', description: 'Soğuk su hatları, sıcak su hatları, sirkülasyon hatları.', parentId: '1' },
  { id: '102', name: 'Pis Su (Atık Su) Tesisatı', description: 'Bina içi pis su, rögarlar, yağ ayırıcılar.', parentId: '1' },
  { id: '103', name: 'Yağmur Suyu Tesisatı', description: 'Çatı ve balkon süzgeçleri, yağmur iniş boruları, drenaj pompaları.', parentId: '1' },
  { id: '104', name: 'Depolama ve Basınçlandırma', description: 'Su depoları (betonarme/modüler), hidrofor sistemleri, genleşme tankları.', parentId: '1' },
  { id: '105', name: 'Su Arıtma ve Yumuşatma', description: 'Filtrasyon, klorlama, su yumuşatma cihazları.', parentId: '1' },
  { id: '106', name: 'Vitrifiye ve Armatür Montajları', description: 'Lavabo, klozet, batarya, duş tekneleri.', parentId: '1' },

  // 2. Isıtma Tesisatı
  { id: '201', name: 'Isı Üretim Sistemleri (Merkezi/Bireysel)', description: 'Kazanlar (doğalgaz/katı yakıt), kombiler, kaskad sistemler.', parentId: '2' },
  { id: '202', name: 'Isı Transfer Üniteleri', description: 'Radyatörler, yerden ısıtma boruları, konvektörler, apareyler.', parentId: '2' },
  { id: '203', name: 'Isı Pompası Sistemleri', description: 'Hava/su kaynaklı ısı pompaları.', parentId: '2' },
  { id: '204', name: 'Boru ve Dağıtım Hatları', description: 'Kolon hatları, branşmanlar, kollektör grupları.', parentId: '2' },
  { id: '205', name: 'Baca Sistemleri', description: 'Çelik bacalar, kaskad bacalar.', parentId: '2' },

  // 3. Soğutma ve İklimlendirme
  { id: '301', name: 'Merkezi Soğutma Grupları', description: 'Chiller (Soğutma grubu) üniteleri, soğutma kuleleri.', parentId: '3' },
  { id: '302', name: 'Değişken Debili Sistemler', description: 'VRF / VRV dış ve iç üniteler.', parentId: '3' },
  { id: '303', name: 'Bireysel Klimalar', description: 'Split klimalar, multi-split sistemler.', parentId: '3' },
  { id: '304', name: 'Uç Birimler', description: 'Fan-Coil cihazları (kaset, gizli tavan, döşeme tipi).', parentId: '3' },
  { id: '305', name: 'Soğutma Borulaması', description: 'Bakır borulama, siyah çelik borulama (Chiller için), izolasyon.', parentId: '3' },

  // 4. Havalandırma Tesisatı
  { id: '401', name: 'Havalandırma Cihazları', description: 'Klima santralleri (AHU), ısı geri kazanım cihazları (VAM).', parentId: '4' },
  { id: '402', name: 'Fanlar ve Aspiratörler', description: 'Egzoz fanları, çatı tipi fanlar, banyo/wc aspiratörleri.', parentId: '4' },
  { id: '403', name: 'Kanal Sistemi', description: 'Galvaniz hava kanalları, esnek (flexible) kanallar, tekstil kanallar.', parentId: '4' },
  { id: '404', name: 'Hava Dağıtım Elemanları', description: 'Menfezler, difüzörler, panjurlar, damperler (yangın/hava ayar).', parentId: '4' },
  { id: '405', name: 'Özel Havalandırma', description: 'Sığınak havalandırması (radyoaktif filtreli), mutfak davlumbaz egzozları.', parentId: '4' },

  // 5. Yangın Söndürme Tesisatı
  { id: '501', name: 'Sulu Söndürme Sistemleri', description: 'Sprinkler (yağmurlama) hatları, yangın dolapları.', parentId: '5' },
  { id: '502', name: 'Yangın Pompa Dairesi', description: 'Dizel ve elektrikli yangın pompaları, jokey pompalar.', parentId: '5' },
  { id: '503', name: 'Saha Tesisatı', description: 'Yangın hidrantları, itfaiye su alma ağızları.', parentId: '5' },
  { id: '504', name: 'Gazlı Söndürme Sistemleri', description: 'FM200, Novec, CO2 sistemleri (genelde elektrik/server odaları için).', parentId: '5' },
  { id: '505', name: 'Duman Tahliye Sistemleri', description: 'Duman damperleri, basınçlandırma fanları (merdiven/asansör).', parentId: '5' },

  // 6. Doğalgaz Tesisatı
  { id: '601', name: 'Altyapı', description: 'Ana servis kutusu, polietilen (PE) yeraltı hatları.', parentId: '6' },
  { id: '602', name: 'Bina İçi Tesisat', description: 'Kolon hatları, daire içi ocak/kombi tesisatları.', parentId: '6' },
  { id: '603', name: 'Endüstriyel Gaz', description: 'LNG veya LPG tank sahaları ve dağıtım hatları.', parentId: '6' },
  
  // 7. Endüstriyel ve Özel Tesisatlar
  { id: '701', name: 'Basınçlı Hava Tesisatı', description: 'Kompresörler, kurutucular ve dağıtım boruları.', parentId: '7' },
  { id: '702', name: 'Buhar ve Kondens Tesisatı', description: 'Buhar kazanları, kondens tankları (Sanayi, otel, hastane).', parentId: '7' },
  { id: '703', name: 'Medikal Gaz Tesisatı', description: 'Oksijen, vakum, azot protoksit hatları (Hastaneler için).', parentId: '7' },
  { id: '704', name: 'Gri Su Sistemleri', description: 'Atık suyun geri kazanılıp rezervuarlarda kullanımı.', parentId: '7' },

  // 8. Mekanik Otomasyon (BMS)
  { id: '801', name: 'Saha Elemanları', description: 'Sensörler (sıcaklık, nem, basınç), motorlu vanalar, termostatlar.', parentId: '8' },
  { id: '802', name: 'Kontrol Panelleri', description: 'MCC (Motor Control Center) panoları, DDC panelleri.', parentId: '8' },
];


export const initialInstallationTypes = [
    ...mainDisciplines.map(d => ({ name: d.name, description: d.description, parentId: d.parentId, id: d.id })),
    ...subCategories.map(d => ({ name: d.name, description: d.description, parentId: d.parentId, id: d.id })),
];

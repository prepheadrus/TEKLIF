
type InitialInstallationType = {
  // id property is removed, it will be generated dynamically
  name: string;
  description: string;
  parentId: string | null;
  children?: Omit<InitialInstallationType, 'parentId'>[];
};

export const initialInstallationTypesData: Omit<InitialInstallationType, 'parentId'>[] = [
  {
    name: 'Sıhhi Tesisat (Plumbing)',
    description: 'Binanın su ihtiyacının karşılanması ve atık suyun uzaklaştırılmasını kapsar.',
    children: [
      { name: 'Temiz Su Tesisatı', description: 'Soğuk su hatları, sıcak su hatları, sirkülasyon hatları.' },
      { name: 'Pis Su (Atık Su) Tesisatı', description: 'Bina içi pis su, rögarlar, yağ ayırıcılar.' },
      { name: 'Yağmur Suyu Tesisatı', description: 'Çatı ve balkon süzgeçleri, yağmur iniş boruları, drenaj pompaları.' },
      { name: 'Depolama ve Basınçlandırma', description: 'Su depoları (betonarme/modüler), hidrofor sistemleri, genleşme tankları.' },
      { name: 'Su Arıtma ve Yumuşatma', description: 'Filtrasyon, klorlama, su yumuşatma cihazları.' },
      { name: 'Vitrifiye ve Armatür Montajları', description: 'Lavabo, klozet, batarya, duş tekneleri.' },
    ],
  },
  {
    name: 'Isıtma Tesisatı (Heating)',
    description: 'Binaların ısıtılması ve sıcak su ihtiyaçlarının karşılanması.',
    children: [
      { name: 'Isı Üretim Sistemleri (Merkezi/Bireysel)', description: 'Kazanlar (doğalgaz/katı yakıt), kombiler, kaskad sistemler.' },
      { name: 'Isı Transfer Üniteleri', description: 'Radyatörler, yerden ısıtma boruları, konvektörler, apareyler.' },
      { name: 'Isı Pompası Sistemleri', description: 'Hava/su kaynaklı ısı pompaları.' },
      { name: 'Boru ve Dağıtım Hatları', description: 'Kolon hatları, branşmanlar, kollektör grupları.' },
      { name: 'Baca Sistemleri', description: 'Çelik bacalar, kaskad bacalar.' },
    ],
  },
  {
    name: 'Soğutma ve İklimlendirme (HVAC)',
    description: 'Ortam havasının soğutulması ve şartlandırılması.',
    children: [
        { name: 'Merkezi Soğutma Grupları', description: 'Chiller (Soğutma grubu) üniteleri, soğutma kuleleri.' },
        { name: 'Değişken Debili Sistemler', description: 'VRF / VRV dış ve iç üniteler.' },
        { name: 'Bireysel Klimalar', description: 'Split klimalar, multi-split sistemler.' },
        { name: 'Uç Birimler', description: 'Fan-Coil cihazları (kaset, gizli tavan, döşeme tipi).' },
        { name: 'Soğutma Borulaması', description: 'Bakır borulama, siyah çelik borulama (Chiller için), izolasyon.' },
    ]
  },
  {
    name: 'Havalandırma Tesisatı (Ventilation)',
    description: 'İç mekan hava kalitesinin sağlanması ve hava sirkülasyonu.',
    children: [
        { name: 'Havalandırma Cihazları', description: 'Klima santralleri (AHU), ısı geri kazanım cihazları (VAM).' },
        { name: 'Fanlar ve Aspiratörler', description: 'Egzoz fanları, çatı tipi fanlar, banyo/wc aspiratörleri.' },
        { name: 'Kanal Sistemi', description: 'Galvaniz hava kanalları, esnek (flexible) kanallar, tekstil kanallar.' },
        { name: 'Hava Dağıtım Elemanları', description: 'Menfezler, difüzörler, panjurlar, damperler (yangın/hava ayar).' },
        { name: 'Özel Havalandırma', description: 'Sığınak havalandırması (radyoaktif filtreli), mutfak davlumbaz egzozları.' },
    ]
  },
  {
    name: 'Yangın Söndürme Tesisatı (Fire Protection)',
    description: 'Yangına müdahale ve can/mal güvenliği sistemleri.',
    children: [
        { name: 'Sulu Söndürme Sistemleri', description: 'Sprinkler (yağmurlama) hatları, yangın dolapları.' },
        { name: 'Yangın Pompa Dairesi', description: 'Dizel ve elektrikli yangın pompaları, jokey pompalar.' },
        { name: 'Saha Tesisatı', description: 'Yangın hidrantları, itfaiye su alma ağızları.' },
        { name: 'Gazlı Söndürme Sistemleri', description: 'FM200, Novec, CO2 sistemleri (genelde elektrik/server odaları için).' },
        { name: 'Duman Tahliye Sistemleri', description: 'Duman damperleri, basınçlandırma fanları (merdiven/asansör).' },
    ]
  },
  {
      name: 'Doğalgaz Tesisatı',
      description: 'Gaz yakıcı cihazlara güvenli gaz iletimi.',
      children: [
          { name: 'Altyapı', description: 'Ana servis kutusu, polietilen (PE) yeraltı hatları.' },
          { name: 'Bina İçi Tesisat', description: 'Kolon hatları, daire içi ocak/kombi tesisatları.' },
          { name: 'Endüstriyel Gaz', description: 'LNG veya LPG tank sahaları ve dağıtım hatları.' },
      ]
  },
  {
      name: 'Endüstriyel ve Özel Tesisatlar',
      description: 'Projeye özel endüstriyel proses ve medikal sistemler.',
      children: [
          { name: 'Basınçlı Hava Tesisatı', description: 'Kompresörler, kurutucular ve dağıtım boruları.' },
          { name: 'Buhar ve Kondens Tesisatı', description: 'Buhar kazanları, kondens tankları (Sanayi, otel, hastane).' },
          { name: 'Medikal Gaz Tesisatı', description: 'Oksijen, vakum, azot protoksit hatları (Hastaneler için).' },
          { name: 'Gri Su Sistemleri', description: 'Atık suyun geri kazanılıp rezervuarlarda kullanımı.' },
      ]
  },
  {
      name: 'Mekanik Otomasyon (BMS)',
      description: 'Bina Yönetim Sistemleri ile mekanik cihazların kontrolü.',
      children: [
          { name: 'Saha Elemanları', description: 'Sensörler (sıcaklık, nem, basınç), motorlu vanalar, termostatlar.' },
          { name: 'Kontrol Panelleri', description: 'MCC (Motor Control Center) panoları, DDC panelleri.' },
      ]
  }
];

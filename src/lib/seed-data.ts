
type InitialInstallationType = {
  name: string;
  description: string;
  children?: Omit<InitialInstallationType, 'description'>[];
};

export const initialInstallationTypesData: InitialInstallationType[] = [
  {
    name: 'Sıhhi Tesisat (Plumbing)',
    description: 'Binanın su ihtiyacının karşılanması ve atık suyun uzaklaştırılmasını kapsar.',
    children: [
      { name: 'Temiz Su Tesisatı' },
      { name: 'Pis Su (Atık Su) Tesisatı' },
      { name: 'Yağmur Suyu Tesisatı' },
      { name: 'Depolama ve Basınçlandırma' },
      { name: 'Su Arıtma ve Yumuşatma' },
      { name: 'Vitrifiye ve Armatür Montajları' },
    ],
  },
  {
    name: 'Isıtma Tesisatı (Heating)',
    description: 'Binaların ısıtılması ve sıcak su ihtiyaçlarının karşılanması.',
    children: [
      { name: 'Isı Üretim Sistemleri (Merkezi/Bireysel)' },
      { name: 'Isı Transfer Üniteleri' },
      { name: 'Isı Pompası Sistemleri' },
      { name: 'Boru ve Dağıtım Hatları' },
      { name: 'Baca Sistemleri' },
    ],
  },
  {
    name: 'Soğutma ve İklimlendirme (HVAC)',
    description: 'Ortam havasının soğutulması ve şartlandırılması.',
    children: [
        { name: 'Merkezi Soğutma Grupları' },
        { name: 'Değişken Debili Sistemler' },
        { name: 'Bireysel Klimalar' },
        { name: 'Uç Birimler' },
        { name: 'Soğutma Borulaması' },
    ]
  },
  {
    name: 'Havalandırma Tesisatı (Ventilation)',
    description: 'İç mekan hava kalitesinin sağlanması ve hava sirkülasyonu.',
    children: [
        { name: 'Havalandırma Cihazları' },
        { name: 'Fanlar ve Aspiratörler' },
        { name: 'Kanal Sistemi' },
        { name: 'Hava Dağıtım Elemanları' },
        { name: 'Özel Havalandırma' },
    ]
  },
  {
    name: 'Yangın Söndürme Tesisatı (Fire Protection)',
    description: 'Yangına müdahale ve can/mal güvenliği sistemleri.',
    children: [
        { name: 'Sulu Söndürme Sistemleri' },
        { name: 'Yangın Pompa Dairesi' },
        { name: 'Saha Tesisatı' },
        { name: 'Gazlı Söndürme Sistemleri' },
        { name: 'Duman Tahliye Sistemleri' },
    ]
  },
  {
      name: 'Doğalgaz Tesisatı',
      description: 'Gaz yakıcı cihazlara güvenli gaz iletimi.',
      children: [
          { name: 'Altyapı' },
          { name: 'Bina İçi Tesisat' },
          { name: 'Endüstriyel Gaz' },
      ]
  },
  {
      name: 'Endüstriyel ve Özel Tesisatlar',
      description: 'Projeye özel endüstriyel proses ve medikal sistemler.',
      children: [
          { name: 'Basınçlı Hava Tesisatı' },
          { name: 'Buhar ve Kondens Tesisatı' },
          { name: 'Medikal Gaz Tesisatı' },
          { name: 'Gri Su Sistemleri' },
      ]
  },
  {
      name: 'Mekanik Otomasyon (BMS)',
      description: 'Bina Yönetim Sistemleri ile mekanik cihazların kontrolü.',
      children: [
          { name: 'Saha Elemanları' },
          { name: 'Kontrol Panelleri' },
      ]
  }
];

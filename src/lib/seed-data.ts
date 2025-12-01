
export type InitialInstallationType = {
  name: string;
  description?: string;
  children?: InitialInstallationType[];
};


export const initialInstallationTypesData: InitialInstallationType[] = [
    {
        name: "1. ISITMA TESİSATI",
        children: [
            {
                name: "1.1. Isı Üretim Merkezi",
                children: [
                    { name: "Kazanlar (Dilimli / Çelik / Yoğuşmalı)" },
                    { name: "Brülörler ve Gaz Yolu Armatürleri" },
                    { name: "Duman Bacaları (Çift Cidarlı Paslanmaz Çelik)" },
                    { name: "Kazan Kontrol Panelleri (Kazan Üzeri)" },
                ]
            },
            {
                name: "1.2. Isıtma Armatürleri ve Ekipmanları",
                children: [
                    { name: "Hava Ayırıcılar ve Tortu Tutucular (Spirovent vb.)" },
                    { name: "Denge Kapları (Hydraulic Separator)" },
                    { name: "Genleşme Tankları (Membranlı - Isıtma Tipi)" },
                    { name: "Otomatik Su Besleme Ünitesi" },
                ]
            },
            {
                name: "1.3. Isıtma Pompa Grupları",
                children: [
                    { name: "Kazan Şönt Pompaları" },
                    { name: "Primer Devre Sirkülasyon Pompaları" },
                    { name: "Sekonder Devre Sirkülasyon Pompaları (Frekans Konvertörlü)" },
                ]
            },
            {
                name: "1.4. Isıtma Boru Hattı Bileşenleri",
                children: [
                    { name: "Siyah Çelik Borular (Dikişli/Dikişsiz)" },
                    { name: "Boru Fitingsleri (Dirsek, Te, Redüksiyon - Kaynaklı)" },
                    { name: "Boru Askı ve Konsol Sistemleri (Rot, Dübel, Somun, L Profil)" },
                    { name: "Boru İzolasyonu (Cam Yünü / Taş Yünü / Alüminyum Kaplama)" },
                ]
            },
            {
                name: "1.5. Isıtma Vana Grubu",
                children: [
                    { name: "Kelebek Vanalar (Dişli kutulu / Kollu)" },
                    { name: "Pislik Tutucular" },
                    { name: "Çekvalfler (Yaylı / Çalpara)" },
                    { name: "Balans Vanaları (Statik / Dinamik)" },
                    { name: "Kompansatörler (Metal Körüklü / Kauçuk)" },
                ]
            },
        ]
    },
    {
        name: "2. SOĞUTMA TESİSATI",
        children: [
            {
                name: "2.1. Soğutma Üretim",
                children: [
                    { name: "Su Soğutma Grupları (Chiller - Vidalı/Scroll Kompresörlü)" },
                    { name: "Soğutma Kuleleri (Açık/Kapalı - Aksiyel/Radyal Fanlı)" },
                    { name: "Chiller Vibrasyon Takozları ve Kaideleri" },
                ]
            },
            {
                name: "2.2. Soğutma Suyu Şartlandırma",
                children: [
                    { name: "Kimyasal Dozaj Pompaları" },
                    { name: "Filtrasyon Sistemleri (Kum Seperatörü)" },
                    { name: "Otomatik Blöf Sistemleri" },
                ]
            },
            {
                name: "2.3. Soğutma Borulaması ve Yalıtım",
                children: [
                    { name: "Çelik Borular (Soğutma Hattı)" },
                    { name: "Elastomerik Kauçuk Köpüğü İzolasyonu (Boru çapına göre et kalınlıkları detaylandırılmalı)" },
                    { name: "Boru Askıları (İzolasyon Takozlu - Soğuk Köprü Engelleyici)" },
                ]
            },
            {
                name: "2.4. Soğutma Uç Birim Bağlantıları",
                children: [
                    { name: "Fan-Coil Bağlantı Paketleri (Fleks hortum, küresel vana, pislik tutucu seti)" },
                    { name: "Motorlu Vanalar (2 Yollu / 3 Yollu - On/Off veya Oransal)" },
                ]
            }
        ]
    },
    {
        name: "3. HAVALANDIRMA VE KLİMA",
        children: [
            {
                name: "3.1. Havalandırma Cihazları",
                children: [
                    { name: "Klima Santralleri (Hücre yapıları, Bataryalar, Fanlar)" },
                    { name: "Filtre Grupları (G4 Kaset, F7 Torba, Hepa Filtreler)" },
                    { name: "Nemlendirici Üniteler (Buharlı / Pedli)" },
                ]
            },
            {
                name: "3.2. Hava Kanalları ve Altyapı",
                children: [
                    { name: "Galvaniz Hava Kanalları (Levha kalınlıklarına göre: 0.70mm, 1.00mm, 1.20mm)" },
                    { name: "Paslanmaz Çelik Kanallar (Mutfak Egzoz vb.)" },
                    { name: "Hava Kanalı Flanş ve Köşe Parçaları" },
                    { name: "Kanal İzolasyonu (Akustik / Termal - İçten/Dıştan)" },
                ]
            },
            {
                name: "3.3. Kanal Aksesuarları",
                children: [
                    { name: "Hava Damperleri (Manuel Volüm Damperi)" },
                    { name: "Yangın Damperleri (Sigortalı / Motorlu)" },
                    { name: "Susturucular (Kulisli Tip)" },
                    { name: "Fleksible Bağlantılar (Cihaz ağızları için konnektörler)" },
                    { name: "Müdahale Kapakları" },
                ]
            },
            {
                name: "3.4. Üfleme ve Emiş Elemanları",
                children: [
                    { name: "Menfezler (Dağıtıcı/Toplayıcı - Damperli/Dampersiz)" },
                    { name: "Difüzörler (Kare, Slot, Girdaplı)" },
                    { name: "Anemostadlar" },
                    { name: "Plenum Kutuları (İzoleli)" },
                ]
            },
            {
                name: "3.5. VRF / Klima Bakır Borulama",
                children: [
                    { name: "Bakır Borular (Sert / Tavlı)" },
                    { name: "Refnet (Dağıtıcı) Jointler" },
                    { name: "Konsol ve Kablo Tavaları" },
                    { name: "Drenaj Hattı (PVC Borulama)" },
                ]
            }
        ]
    },
    {
        name: "4. SIHHİ TESİSAT",
        children: [
            {
                name: "4.1. Sıcak Su Üretim",
                children: [
                    { name: "Boylerler (Tek/Çift Serpantinli)" },
                    { name: "Elektrikli Rezistanslar" },
                    { name: "Plakalı Isı Eşanjörleri" },
                ]
            },
            {
                name: "4.2. Pompalar ve Hidroforlar",
                children: [
                    { name: "Kullanım Suyu Hidroforları (Frekans konvertörlü panosu dahil)" },
                    { name: "Sirkülasyon Pompaları (Bronz gövde - Lejyonella riskine karşı)" },
                    { name: "Pis Su Dalgıç Pompaları (Kızaklı sistem, toplu çekvalf dahil)" },
                ]
            },
            {
                name: "4.3. Borulama Sistemleri",
                children: [
                    { name: "PPRC Temiz Su Boruları ve Fitingsleri" },
                    { name: "Kompozit Folyolu Borular (Sıcak Su için)" },
                    { name: "PVC Pis Su Boruları (B Tipi / BD Tipi)" },
                    { name: "Sessiz Borular (Astolan / Mineral katkılı)" },
                ]
            },
            {
                name: "4.4. Tesisat Aksesuarları",
                children: [
                    { name: "Basınç Düşürücüler" },
                    { name: "Koç Darbesi Önleyiciler" },
                    { name: "Süzgeçler (Yer Süzgeci, Balkon Süzgeci, Çatı Süzgeci)" },
                    { name: "Yağ Ayırıcılar (Mutfak hatları için)" },
                ]
            }
        ]
    },
    {
        name: "5. YANGIN TESİSATI",
        children: [
            {
                name: "5.1. Pompa İstasyonu Detayı",
                children: [
                    { name: "Ana Pompa (Dizel) + Yakıt Tankı + Susturucu" },
                    { name: "Yedek Pompa (Elektrikli)" },
                    { name: "Jokey Pompa" },
                    { name: "Pompa Kontrol Panoları (UL/FM onaylı)" },
                    { name: "Test Hattı ve Debimetre (Akış ölçer)" },
                ]
            },
            {
                name: "5.2. Saha Ekipmanları (Zone Bazlı)",
                children: [
                    { name: "Islak Alarm Vanaları (Alarm Check Valve)" },
                    { name: "Akış Anahtarları (Flow Switch)" },
                    { name: "İzleme Anahtarlı Kelebek Vanalar" },
                    { name: "Test ve Drenaj Vanaları" },
                ]
            },
            {
                name: "5.3. Borulama ve Sismik",
                children: [
                    { name: "Siyah Çelik Boru (SCH40 - Yivli veya Kaynaklı)" },
                    { name: "Yivli Bağlantı Parçaları (Kaplin, Dirsek, Te)" },
                    { name: "Sismik Halatlar ve Sismik Askı Setleri" },
                ]
            }
        ]
    },
    {
        name: "6. OTOMASYON VE SAHA KONTROL",
        children: [
            {
                name: "6.1. Saha Enstrümanları",
                children: [
                    { name: "Daldırma Tipi Sıcaklık Sensörleri" },
                    { name: "Kanal Tipi Nem ve Sıcaklık Sensörleri" },
                    { name: "Fark Basınç Anahtarları (Filtre kirlilik için)" },
                    { name: "Basınç Transmitterleri" },
                ]
            },
            {
                name: "6.2. Kontrol Panelleri",
                children: [
                    { name: "MCC Panoları (Güç Panoları)" },
                    { name: "DDC Panoları (Kontrol Panoları)" },
                    { name: "Frekans İnvertörleri (Sürücüler)" },
                ]
            }
        ]
    },
    {
        name: "7. GENEL GİDERLER VE DİĞERLERİ",
        children: [
            {
                name: "7.1. Test ve Devreye Alma",
                children: [
                    { name: "Boru Basınç Testleri" },
                    { name: "Hava Kanalı Sızdırmazlık Testleri" },
                    { name: "Balanslama (Su ve Hava Ayarları)" },
                ]
            },
            {
                name: "7.2. Etiketleme ve İşaretleme",
                children: [
                    { name: "Boru Yön Okları ve Etiketleri" },
                    { name: "Vana Numaralandırma Plakaları" },
                    { name: "Ekipman Tanıtım Kartları" },
                ]
            }
        ]
    }
];


/**
 * @file Fiyat hesaplama iş mantığını içerir.
 */

interface PriceCalculationInput {
  listPrice: number;
  basePrice: number;
  discountRate: number; // 0-1 aralığında, örn: 0.15
  profitMargin: number;  // 0-1 aralığında, örn: 0.20
  exchangeRate: number;  // Yabancı para birimi için, TL ise 1 olmalı
  quantity: number;
  vatRate: number; // KDV oranı, örn: 0.20
  priceIncludesVat: boolean; // Fiyatların KDV içerip içermediği
}

interface PriceCalculationOutput {
  cost: number;            // Orijinal para biriminde maliyet (KDV Hariç)
  tlCost: number;          // TL cinsinden maliyet (KDV Hariç)
  originalSellPrice: number; // Orijinal para biriminde KDV HARİÇ satış fiyatı
  tlSellPrice: number;       // TL cinsinden KDV HARİÇ satış fiyatı
  profitAmount: number;    // TL cinsinden BİRİM kâr tutarı
  totalTlSell: number;     // TL cinsinden KDV HARİÇ toplam satış tutarı
  totalTlCost: number;     // TL cinsinden toplam maliyet
  totalProfit: number;     // TL cinsinden toplam kâr
}

/**
 * Verilen bilgilere göre birim ve toplam fiyatları KDV HARİÇ olarak hesaplar.
 * @returns Tüm KDV hariç maliyet, satış ve kâr bilgilerini içeren bir nesne.
 */
export function calculateItemTotals({
  listPrice,
  basePrice,
  discountRate,
  profitMargin,
  exchangeRate,
  quantity,
  vatRate,
  priceIncludesVat,
}: PriceCalculationInput): PriceCalculationOutput {
  
  // 1. KDV'den Arındırma
  // Eğer fiyatlar KDV dahil girildiyse, KDV hariç hallerini bul.
  const vatDivisor = 1 + (vatRate || 0);
  const netBasePrice = priceIncludesVat ? basePrice / vatDivisor : basePrice;
  const netListPrice = priceIncludesVat ? listPrice / vatDivisor : listPrice;
  
  // 2. Maliyet Hesaplaması (Cost)
  // Maliyet, KDV hariç alış fiyatıdır.
  // Bu örnekte, iskonto satış fiyatı üzerinden yapıldığı için, maliyet direkt basePrice (alış fiyatı) olur.
  // Ancak daha esnek bir yapı için, maliyetin iskonto edilmiş liste fiyatı olduğunu varsayalım.
  // Bu durumda, maliyet = KDV hariç liste fiyatı * (1 - iskonto) olur.
  // Şimdilik daha basit olan alış fiyatını maliyet olarak alalım.
  const cost = netBasePrice > 0 ? netBasePrice : (netListPrice * (1 - discountRate));


  // 3. Satış Fiyatı Hesaplaması (Sell Price - KDV HARİÇ)
  // Satış fiyatı, maliyetin üzerine kâr marjının eklenmesiyle bulunur.
  // KDV hariç satış fiyatı = KDV Hariç Maliyet * (1 + Kâr Oranı)
  // YA DA
  // KDV hariç satış fiyatı = KDV Hariç Liste Fiyatı * (1 - İskonto) * (1 + Kâr Marjı)
  // İkinci yöntem daha yaygındır, çünkü kar genellikle iskontolu fiyat üzerinden hesaplanır.
  const discountedPrice = netListPrice * (1 - discountRate);
  const originalSellPrice = discountedPrice * (1 + profitMargin);
  
  // 4. TL'ye Çevrim
  const tlCost = cost * exchangeRate;
  const tlSellPrice = originalSellPrice * exchangeRate;

  // 5. Kâr Hesaplaması (Profit)
  // Birim kâr, birim satış fiyatı ile birim maliyet arasındaki farktır (her ikisi de TL).
  const profitAmount = tlSellPrice - tlCost;

  // 6. Toplam Değerlerin Hesaplanması (Totals)
  const totalTlCost = tlCost * quantity;
  const totalTlSell = tlSellPrice * quantity;
  const totalProfit = profitAmount * quantity;

  return {
    // Birim değerler (KDV Hariç)
    cost,
    tlCost,
    originalSellPrice,
    tlSellPrice,
    profitAmount,
    // Toplam değerler (KDV Hariç)
    totalTlSell,
    totalTlCost,
    totalProfit,
  };
}


/**
 * @file Fiyat hesaplama iş mantığını içerir.
 */

interface PriceCalculationInput {
  listPrice: number;
  discountRate: number; // 0-1 aralığında, örn: 0.15
  profitMargin: number;  // 0-1 aralığında, örn: 0.20
  exchangeRate: number;  // Yabancı para birimi için, TL ise 1 olmalı
  quantity: number;
}

interface PriceCalculationOutput {
  cost: number;            // Orijinal para biriminde maliyet (iskonto uygulanmış liste fiyatı)
  tlCost: number;          // TL cinsinden maliyet
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
  discountRate,
  profitMargin,
  exchangeRate,
  quantity,
}: PriceCalculationInput): PriceCalculationOutput {
  
  // 1. Maliyet Hesaplaması (Cost)
  // Maliyet, her zaman liste fiyatı üzerinden yapılan iskonto ile bulunur.
  // Maliyet (Orijinal Para Birimi) = Liste Fiyatı * (1 - İskonto Oranı)
  const cost = listPrice * (1 - discountRate);

  // 2. Satış Fiyatı Hesaplaması (Sell Price - KDV HARİÇ)
  // Satış fiyatı, maliyetin üzerine kâr marjının eklenmesiyle bulunur.
  // Satış Fiyatı (Orijinal Para Birimi) = Maliyet * (1 + Kâr Oranı)
  const originalSellPrice = cost * (1 + profitMargin);
  
  // 3. TL'ye Çevrim
  const tlCost = cost * exchangeRate;
  const tlSellPrice = originalSellPrice * exchangeRate;

  // 4. Kâr Hesaplaması (Profit)
  // Birim kâr, birim satış fiyatı ile birim maliyet arasındaki farktır.
  const profitAmount = tlSellPrice - tlCost;

  // 5. Toplam Değerlerin Hesaplanması (Totals)
  const totalTlCost = tlCost * quantity;
  const totalTlSell = tlSellPrice * quantity;
  const totalProfit = profitAmount * quantity;

  return {
    // Birim değerler
    cost,
    tlCost,
    originalSellPrice,
    tlSellPrice,
    profitAmount,
    // Toplam değerler
    totalTlSell,
    totalTlCost,
    totalProfit,
  };
}

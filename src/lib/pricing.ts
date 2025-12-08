
/**
 * @file Fiyat hesaplama iş mantığını içerir.
 */

interface PriceCalculationInput {
  listPrice: number;       // Tedarikçinin ham liste fiyatı
  basePrice: number;       // Bu aslında maliyettir, ancak iskonto varsa üzerine yazılır.
  discountRate: number;    // 0-1 aralığında, örn: 0.15 (Liste fiyatına uygulanan tedarikçi iskontosu)
  profitMargin: number;    // 0-1 aralığında, örn: 0.20 (Maliyet üzerine eklenecek kâr)
  exchangeRate: number;    // Yabancı para birimi için, TL ise 1 olmalı
  quantity: number;
  vatRate: number;         // KDV oranı, örn: 0.20
  priceIncludesVat: boolean; // Girdi fiyatlarının KDV içerip içermediği
}

interface PriceCalculationOutput {
  cost: number;            // Orijinal para biriminde maliyet (Liste Fiyatı - İskonto) (KDV Hariç)
  tlCost: number;          // TL cinsinden maliyet (KDV Hariç)
  originalSellPrice: number; // Orijinal para biriminde KDV HARİÇ satış fiyatı (Maliyet + Kâr)
  tlSellPrice: number;       // TL cinsinden KDV HARİÇ satış fiyatı
  profitAmount: number;    // TL cinsinden BİRİM kâr tutarı
  totalTlSell: number;     // TL cinsinden KDV HARİÇ toplam satış tutarı
  totalTlCost: number;     // TL cinsinden toplam maliyet
  totalProfit: number;     // TL cinsinden toplam kâr
}

/**
 * Verilen bilgilere göre birim ve toplam fiyatları KDV HARİÇ olarak hesaplar.
 * Yeni Mantık: Maliyet = Liste Fiyatı * (1 - İskonto). Satış Fiyatı = Maliyet * (1 + Kâr).
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
  // `listPrice` tedarikçinin ham liste fiyatıdır.
  const netListPrice = priceIncludesVat ? listPrice / vatDivisor : listPrice;
  // `basePrice` eğer iskonto yoksa doğrudan maliyettir.
  const netBasePrice = priceIncludesVat ? basePrice / vatDivisor : basePrice;

  // 2. Birim Maliyet Hesaplaması (Cost)
  // Maliyet, KDV hariç tedarikçi liste fiyatından iskonto düşülerek bulunur.
  // Eğer `netListPrice` girilmişse, hesaplama bunun üzerinden yapılır.
  // Eğer `netListPrice` yoksa, `netBasePrice` doğrudan maliyet olarak kabul edilir.
  const cost = netListPrice > 0 
    ? netListPrice * (1 - discountRate)
    : netBasePrice;
  
  // 3. Satış Fiyatı Hesaplaması (Sell Price - KDV HARİÇ)
  // Satış fiyatı, birim maliyetin üzerine kâr marjının eklenmesiyle bulunur.
  const originalSellPrice = cost * (1 + profitMargin);
  
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

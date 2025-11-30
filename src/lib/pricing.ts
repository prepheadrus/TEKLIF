
/**
 * @file Fiyat hesaplama iş mantığını içerir.
 */

interface PriceCalculationInput {
  listPrice: number;
  discountRate: number;
  profitMargin: number;
  exchangeRate: number;
}

interface PriceCalculationOutput {
  cost: number;
  originalSellPrice: number;
  tlSellPrice: number;
}

/**
 * Verilen bilgilere göre maliyet, orijinal satış fiyatı ve TL satış fiyatını hesaplar.
 * @param listPrice - Ürünün liste fiyatı.
 * @param discountRate - Liste fiyatı üzerinden yapılacak iskonto oranı (örn: 0.15 for 15%).
 * @param profitMargin - Maliyet üzerinden eklenecek kâr marjı (örn: 0.20 for 20%).
 * @param exchangeRate - Yabancı para biriminin TL karşılığı olan kur.
 * @returns Maliyet, orijinal satış fiyatı ve TL satış fiyatını içeren bir nesne.
 */
export function calculatePrice({
  listPrice,
  discountRate,
  profitMargin,
  exchangeRate,
}: PriceCalculationInput): PriceCalculationOutput {
  // Maliyet = Liste Fiyatı * (1 - İskonto Oranı)
  const cost = listPrice * (1 - discountRate);

  // Satış Fiyatı (Orijinal Para Birimi) = Maliyet * (1 + Kâr Marjı)
  const originalSellPrice = cost * (1 + profitMargin);

  // Satış Fiyatı (TL) = Orijinal Satış Fiyatı * Kur
  const tlSellPrice = originalSellPrice * exchangeRate;

  return {
    cost,
    originalSellPrice,
    tlSellPrice,
  };
}

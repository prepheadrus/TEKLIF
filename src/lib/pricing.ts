
/**
 * @file Fiyat hesaplama iş mantığını içerir.
 */

interface PriceCalculationInput {
  listPrice: number;
  discountRate: number; // 0-1 aralığında, örn: 0.15
  profitMargin: number;  // 0-1 aralığında, örn: 0.20
  exchangeRate: number;  // Yabancı para birimi için, TL ise 1 olmalı
}

interface PriceCalculationOutput {
  cost: number;            // Orijinal para biriminde maliyet (iskonto uygulanmış liste fiyatı)
  tlCost: number;          // TL cinsinden maliyet
  originalSellPrice: number; // Orijinal para biriminde satış fiyatı
  tlSellPrice: number;       // TL cinsinden satış fiyatı
  profitAmount: number;    // TL cinsinden kâr tutarı (her birim için)
}

/**
 * Verilen bilgilere göre maliyet, orijinal satış fiyatı ve TL satış fiyatını hesaplar.
 * @param listPrice - Ürünün liste fiyatı.
 * @param discountRate - Liste fiyatı üzerinden yapılacak iskonto oranı (örn: 0.15 for 15%).
 * @param profitMargin - Maliyet üzerinden eklenecek kâr marjı (örn: 0.20 for 20%).
 * @param exchangeRate - Yabancı para biriminin TL karşılığı olan kur.
 * @returns Maliyet, satış fiyatı ve kâr bilgilerini içeren bir nesne.
 */
export function calculatePrice({
  listPrice,
  discountRate,
  profitMargin,
  exchangeRate,
}: PriceCalculationInput): PriceCalculationOutput {
  // Maliyet (İskontolu Fiyat) = Liste Fiyatı * (1 - İskonto Oranı)
  const cost = listPrice * (1 - discountRate);

  // Satış Fiyatı (Orijinal Para Birimi) = Maliyet / (1 - Kâr Marjı) -> Bu daha doğru bir kâr hesabı
  // Örn: 100 liralık maliyete %20 kâr eklemek için 100 / (1 - 0.2) = 125 TL olmalı. 125'in %20'si 25'tir, kâr 25'e çıkar.
  // Eski yöntem: 100 * (1 + 0.20) = 120 TL. Bu durumda kâr marjı %16.67 olur (20/120).
  const originalSellPrice = cost / (1 - profitMargin);
  
  // TL cinsinden değerler
  const tlCost = cost * exchangeRate;
  const tlSellPrice = originalSellPrice * exchangeRate;

  // Birim başına TL kâr
  const profitAmount = tlSellPrice - tlCost;

  return {
    cost,
    tlCost,
    originalSellPrice,
    tlSellPrice,
    profitAmount,
  };
}

/**
 * Toplam fiyatları hesaplamak için kullanılır.
 */
interface TotalPriceInput {
    quantity: number;
    listPrice: number;
    discountRate: number;
    profitMargin: number;
    exchangeRate: number;
}

/**
 * Bir kalem için toplam maliyet, satış ve karı hesaplar.
 */
export function calculateItemTotals(input: TotalPriceInput) {
    const priceInfo = calculatePrice(input);
    
    const totalTlCost = priceInfo.tlCost * input.quantity;
    const totalTlSell = priceInfo.tlSellPrice * input.quantity;
    const totalProfit = priceInfo.profitAmount * input.quantity;
    
    return {
        ...priceInfo,
        totalTlCost,
        totalTlSell,
        totalProfit
    };
}

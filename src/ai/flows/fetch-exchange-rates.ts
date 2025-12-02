'use server';

/**
 * @fileOverview A flow to fetch daily exchange rates from TCMB.
 *
 * - fetchExchangeRates - A function that fetches and parses USD and EUR rates.
 * - ExchangeRatesOutput - The return type for the fetchExchangeRates function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExchangeRatesOutputSchema = z.object({
  USD: z.number().describe('The selling exchange rate for USD to TRY.'),
  EUR: z.number().describe('The selling exchange rate for EUR to TRY.'),
});
export type ExchangeRatesOutput = z.infer<typeof ExchangeRatesOutputSchema>;


export async function fetchExchangeRates(): Promise<ExchangeRatesOutput> {
  return fetchExchangeRatesFlow();
}

/**
 * Fetches daily exchange rates directly from TCMB's official XML source.
 * This is a tool and does not use an LLM.
 */
const fetchExchangeRatesFlow = ai.defineFlow(
  {
    name: 'fetchExchangeRatesFlow',
    outputSchema: ExchangeRatesOutputSchema,
  },
  async () => {
    try {
      const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      
      // This function now specifically targets the 'ForexSelling' tag.
      const findRate = (currencyCode: string): string | null => {
        const currencyTag = `<Currency CrossOrder=.* CurrencyCode="${currencyCode}">`;
        const regex = new RegExp(`${currencyTag}[\\s\\S]*?<ForexSelling>([\\d.]+)</ForexSelling>`);
        const match = xmlText.match(regex);
        return match ? match[1] : null;
      };

      const usdRateStr = findRate('USD');
      const eurRateStr = findRate('EUR');

      if (!usdRateStr || !eurRateStr) {
        throw new Error('USD or EUR rate not found in the XML response.');
      }

      // The API returns strings, they need to be parsed to float.
      const usdRate = parseFloat(usdRateStr);
      const eurRate = parseFloat(eurRateStr);

      if (isNaN(usdRate) || isNaN(eurRate)) {
        throw new Error('Could not parse exchange rates to numbers.');
      }

      console.log(`Successfully fetched and parsed SELL rates -> USD: ${usdRate}, EUR: ${eurRate}`);

      return {
        USD: usdRate,
        EUR: eurRate,
      };
    } catch (error: any) {
        console.error("Critical error fetching or parsing exchange rates:", error);
        // Fallback to default rates ONLY in case of a critical failure.
        // This prevents the entire quote creation from failing if TCMB is temporarily unreachable.
        return {
            USD: 33.0,
            EUR: 35.5
        };
    }
  }
);

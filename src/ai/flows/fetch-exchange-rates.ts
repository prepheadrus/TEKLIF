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
  USD: z.number().describe('The buying exchange rate for USD to TRY.'),
  EUR: z.number().describe('The buying exchange rate for EUR to TRY.'),
});
export type ExchangeRatesOutput = z.infer<typeof ExchangeRatesOutputSchema>;


export async function fetchExchangeRates(): Promise<ExchangeRatesOutput> {
  return fetchExchangeRatesFlow();
}

/**
 * Fetches daily exchange rates from a reliable JSON source.
 * This is a tool and does not use an LLM.
 */
const fetchExchangeRatesFlow = ai.defineFlow(
  {
    name: 'fetchExchangeRatesFlow',
    outputSchema: ExchangeRatesOutputSchema,
  },
  async () => {
    try {
      // Using a more reliable JSON API that mirrors TCMB data
      const response = await fetch('https://hasaneke.com/api/tcmb', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
      }
      const data = await response.json();
      
      const usdRateStr = data['USD']?.alis;
      const eurRateStr = data['EUR']?.alis;
      
      if (!usdRateStr || !eurRateStr) {
        throw new Error('USD or EUR rate not found in the API response.');
      }

      // IMPORTANT: The API returns strings with commas as decimal separators (e.g., "32,85").
      // We must replace the comma with a dot to parse it correctly as a float.
      const usdRate = parseFloat(usdRateStr.replace(',', '.'));
      const eurRate = parseFloat(eurRateStr.replace(',', '.'));

      if (isNaN(usdRate) || isNaN(eurRate)) {
        throw new Error('Could not parse exchange rates to numbers.');
      }

      return {
        USD: usdRate,
        EUR: eurRate,
      };
    } catch (error: any) {
        console.error("Error fetching or parsing exchange rates:", error);
        // Fallback to default rates in case of any error during fetch or parse
        return {
            USD: 32.5,
            EUR: 35.0
        };
    }
  }
);

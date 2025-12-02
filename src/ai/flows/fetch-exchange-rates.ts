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
      
      const usdRate = data['USD']?.alis;
      const eurRate = data['EUR']?.alis;
      
      if (!usdRate || !eurRate) {
        throw new Error('USD or EUR rate not found in the API response.');
      }

      return {
        USD: parseFloat(usdRate),
        EUR: parseFloat(eurRate),
      };
    } catch (error: any) {
        console.error("Error fetching exchange rates:", error);
        // Fallback to default rates in case of an error
        return {
            USD: 32.5,
            EUR: 35.0
        };
    }
  }
);

'use server';

/**
 * @fileOverview An AI agent that suggests missing parts for a product.
 *
 * - suggestMissingParts - A function that suggests missing parts for a product.
 * - SuggestMissingPartsInput - The input type for the suggestMissingParts function.
 * - SuggestMissingPartsOutput - The return type for the suggestMissingParts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestMissingPartsInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  existingParts: z.array(z.string()).describe('The list of existing parts in the quote.'),
});
export type SuggestMissingPartsInput = z.infer<typeof SuggestMissingPartsInputSchema>;

const SuggestMissingPartsOutputSchema = z.object({
  suggestedParts: z.array(z.string()).describe('The list of suggested parts.'),
});
export type SuggestMissingPartsOutput = z.infer<typeof SuggestMissingPartsOutputSchema>;

export async function suggestMissingParts(input: SuggestMissingPartsInput): Promise<SuggestMissingPartsOutput> {
  return suggestMissingPartsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestMissingPartsPrompt',
  input: {schema: SuggestMissingPartsInputSchema},
  output: {schema: SuggestMissingPartsOutputSchema},
  prompt: `You are an expert mechanical engineer. When a user adds a product to a quote, you will suggest related parts that are commonly used with that product, so the user doesn't forget anything.

Product Name: {{{productName}}}
Existing Parts: {{#each existingParts}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Suggest missing parts:`,
});

const suggestMissingPartsFlow = ai.defineFlow(
  {
    name: 'suggestMissingPartsFlow',
    inputSchema: SuggestMissingPartsInputSchema,
    outputSchema: SuggestMissingPartsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

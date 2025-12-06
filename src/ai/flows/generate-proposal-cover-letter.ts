'use server';
/**
 * @fileOverview A Genkit flow to generate a professional cover letter for a proposal.
 *
 * - generateProposalCoverLetter - A function that calls the AI flow.
 * - CoverLetterInput - The input type for the flow.
 * - CoverLetterOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CoverLetterInputSchema = z.object({
  customerName: z.string().describe('The name of the customer or company the proposal is for.'),
  projectName: z.string().describe('The name of the project.'),
  totalAmount: z.string().describe('The total amount of the proposal, formatted as a currency string (e.g., "125.450,75 TL").'),
});
export type CoverLetterInput = z.infer<typeof CoverLetterInputSchema>;

const CoverLetterOutputSchema = z.object({
    coverLetterHtml: z.string().describe("The generated cover letter as an HTML string, typically using <p> tags.")
});
export type CoverLetterOutput = z.infer<typeof CoverLetterOutputSchema>;

export async function generateProposalCoverLetter(input: CoverLetterInput): Promise<CoverLetterOutput> {
  return generateCoverLetterFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProposalCoverLetterPrompt',
  input: { schema: CoverLetterInputSchema },
  output: { schema: CoverLetterOutputSchema },
  prompt: `You are a professional business development expert at a mechanical engineering company called 'İMS Mühendislik'. Your task is to write a compelling, professional, and friendly cover letter for a financial proposal.

The proposal details are:
- Customer Name: {{{customerName}}}
- Project Name: {{{projectName}}}
- Total Amount: {{{totalAmount}}}

Based on this information, generate a 2-paragraph cover letter in Turkish.
- The first paragraph should greet the customer by name, mention the project, and state that the proposal has been prepared with care, reflecting the project's needs.
- The second paragraph should express confidence in your company's ability to successfully complete the project and end with a positive closing statement.
- The tone should be confident, professional, and customer-focused.
- The output MUST be a valid HTML string, with each paragraph wrapped in a <p> tag.

Example Output Structure:
"<p>Sayın [Müşteri Adı],</p><p>[İkinci paragraf içeriği]</p>"
`,
});

const generateCoverLetterFlow = ai.defineFlow(
  {
    name: 'generateCoverLetterFlow',
    inputSchema: CoverLetterInputSchema,
    outputSchema: CoverLetterOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await prompt(input);
        if (!output) {
          throw new Error("AI output was empty.");
        }
        return output;
    } catch (error) {
        console.error("Error in generateCoverLetterFlow, returning fallback.", error);
        // Fallback in case the AI call fails for any reason (API key, quota, etc.)
        return {
            coverLetterHtml: `<p>Sayın ${input.customerName},</p><p>Firmanızın ihtiyaçları doğrultusunda, "${input.projectName}" projesi için hazırlamış olduğumuz teklifimizi bilgilerinize sunarız. Projenizin her aşamasında kalite, verimlilik ve zamanında teslimat ilkeleriyle çalışmayı taahhüt eder, işbirliğimizin başarılı olacağına inancımızla teşekkür ederiz.</p>`
        };
    }
  }
);

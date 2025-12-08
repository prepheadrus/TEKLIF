
import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

// This function can be marked `async` if using `await` inside
export async function GET() {
    try {
        const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
            // Revalidate every hour
            next: { revalidate: 3600 } 
        });

        if (!response.ok) {
            throw new Error(`TCMB sunucusuna ulaşılamadı. Durum: ${response.status}`);
        }

        const xmlText = await response.text();

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix : "@_",
        });
        const jsonObj = parser.parse(xmlText);

        const currencies = jsonObj.Tarih_Date.Currency;

        const usdRate = currencies.find((c: any) => c['@_Kod'] === 'USD')?.ForexSelling;
        const eurRate = currencies.find((c: any) => c['@_Kod'] === 'EUR')?.ForexSelling;

        if (!usdRate || !eurRate) {
            throw new Error('USD veya EUR kurları XML dosyasında bulunamadı.');
        }

        return NextResponse.json({ 
            USD: parseFloat(usdRate),
            EUR: parseFloat(eurRate),
        });

    } catch (error: any) {
        console.error("Döviz kuru API hatası:", error);
        // Return a 500 error with a clear message
        return NextResponse.json(
            { error: 'Döviz kurları alınamadı.', details: error.message },
            { status: 500 }
        );
    }
}

// Enable dynamic routing for this API route
export const dynamic = 'force-dynamic';


'use client';

import { forwardRef } from 'react';

interface PrintDocumentProps {
  teklif: {
    quoteNumber: string;
    createdAt: { seconds: number };
    customerName: string;
    projectName: string;
    customerId: string;
    totalAmount: number;
    exchangeRates: { USD: number, EUR: number };
    termsAndConditions?: string;
    items: Array<{
        id: string;
        name: string;
        brand: string;
        model?: string;
        quantity: number;
        unit: string;
        listPrice: number;
        currency: 'TRY' | 'USD' | 'EUR';
        discountRate: number;
        profitMargin: number;
        groupName?: string;
        unitPrice: number;
        total: number;
      }>;
    grandTotal: number;
    vatAmount: number;
    grandTotalWithVAT: number;
  };
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
  };
  firma: {
    logo: string;
    ad: string;
    altBaslik: string;
    adres: string;
    email: string;
    telefon: string;
    kase?: string;
  };
}

const formatCurrency = (value: number, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(value);
};

const formatDate = (timestamp?: { seconds: number }) => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR');
};


export const PrintDocument = forwardRef<HTMLDivElement, PrintDocumentProps>(
  ({ teklif, firma, customer }, ref) => {

    console.log('PrintDocument props:', { teklif, customer, firma });
    
    const groupedItems = teklif.items.reduce((acc, item) => {
        const groupName = item.groupName || 'Diğer';
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(item);
        return acc;
    }, {} as Record<string, typeof teklif.items>);

    console.log('teklif.groupedItems (calculated inside PrintDocument):', groupedItems);

    const sortedGroups = Object.entries(groupedItems).sort(([a], [b]) => {
        if (a === 'Diğer') return 1;
        if (b === 'Diğer') return -1;
        return a.localeCompare(b);
    });

    return (
      <div ref={ref} className="bg-white p-8 max-w-[210mm] mx-auto text-[10pt] leading-relaxed screen:shadow-lg screen:my-8 print:p-0">
        
        <header className="flex justify-between items-start pb-3 border-b mb-4">
          <div className="flex items-start gap-3">
            <img src={firma.logo} className="h-12 w-auto" alt="Firma Logosu" />
            <div className="text-xs text-gray-700">
              <p className="font-bold text-sm text-black">{firma.ad}</p>
              <p className="text-gray-600">{firma.altBaslik}</p>
              <p className="text-gray-500 mt-1">{firma.adres}</p>
              <p className="text-gray-500">{firma.email} | {firma.telefon}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0 text-gray-700">
            <p className="text-2xl font-bold text-black">TEKLİF</p>
            <p className="text-sm">Teklif No: {teklif.quoteNumber}</p>
            <p className="text-sm">Tarih: {formatDate(teklif.createdAt)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 mb-6 text-xs">
          <div className="border rounded p-3 bg-slate-50/50">
            <h3 className="font-bold border-b pb-1 mb-2 text-gray-800">MÜŞTERİ BİLGİLERİ</h3>
            <p className="font-semibold text-primary">{customer.name}</p>
            {customer.address && <p className="text-gray-600">{customer.address}</p>}
            {(customer.email || customer.phone) && <p className="text-gray-600">{customer.email} {customer.email && customer.phone && '|'} {customer.phone}</p>}
            {customer.taxNumber && <p className="text-gray-500">Vergi No: {customer.taxNumber}</p>}
          </div>
          <div className="border rounded p-3 bg-slate-50/50">
            <h3 className="font-bold border-b pb-1 mb-2 text-gray-800">PROJE BİLGİSİ</h3>
            <p className="text-gray-700">{teklif.projectName}</p>
          </div>
        </section>

        {sortedGroups.map(([groupName, items], ki) => (
          <section key={ki} className="mb-6 print-avoid-break">
            <h3 className="font-bold text-base mb-2 p-2 bg-slate-100 border-b-2 border-slate-300 text-gray-800">{groupName}</h3>
            <table className="w-full border-collapse text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-1 w-8 text-center font-semibold text-gray-600">#</th>
                  <th className="border p-1 text-left font-semibold text-gray-600">Açıklama</th>
                  <th className="border p-1 w-20 text-center font-semibold text-gray-600">Marka</th>
                  <th className="border p-1 w-20 text-center font-semibold text-gray-600">Model</th>
                  <th className="border p-1 w-16 text-right font-semibold text-gray-600">Miktar</th>
                  <th className="border p-1 w-16 text-center font-semibold text-gray-600">Birim</th>
                  <th className="border p-1 w-24 text-right font-semibold text-gray-600">Birim Fiyat</th>
                  <th className="border p-1 w-24 text-right font-semibold text-gray-600">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={item.id} className="print-avoid-break even:bg-slate-50/50">
                    <td className="border p-1.5 text-center text-gray-600">{i + 1}</td>
                    <td className="border p-1.5 text-gray-800 font-medium">{item.name}</td>
                    <td className="border p-1.5 text-center text-gray-700">{item.brand}</td>
                    <td className="border p-1.5 text-center text-gray-700">{item.model}</td>
                    <td className="border p-1.5 text-right text-gray-700">{item.quantity.toLocaleString('tr-TR')}</td>
                    <td className="border p-1.5 text-center text-gray-700">{item.unit}</td>
                    <td className="border p-1.5 text-right font-mono text-gray-700">{formatCurrency(item.unitPrice)}</td>
                    <td className="border p-1.5 text-right font-mono font-semibold text-black">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <footer className="pt-4 border-t-2 border-slate-300">
            <div className="flex justify-end mb-8 print-avoid-break">
                 <div className="w-[350px] space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="font-semibold text-gray-700">Ara Toplam:</span>
                        <span className="font-mono text-gray-800">{formatCurrency(teklif.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-semibold text-gray-700">KDV (%20):</span>
                        <span className="font-mono text-gray-800">{formatCurrency(teklif.vatAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold pt-2 border-t mt-2 text-black">
                        <span>Genel Toplam:</span>
                        <span className="font-mono">{formatCurrency(teklif.grandTotalWithVAT)}</span>
                    </div>
                </div>
            </div>
            
            {teklif.termsAndConditions && (
                <div className="text-xs mt-8 print-avoid-break">
                    <h3 className="font-bold mb-1 text-gray-800">Notlar ve Koşullar</h3>
                    <p className="whitespace-pre-wrap text-gray-600">{teklif.termsAndConditions}</p>
                </div>
            )}

            {firma.kase && (
              <section className="flex justify-end mt-8 print-avoid-break">
                <div className="text-center">
                  <img src={firma.kase} className="h-20 w-auto" alt="Kaşe" />
                </div>
              </section>
            )}
        </footer>
      </div>
    );
  }
);

PrintDocument.displayName = 'PrintDocument';

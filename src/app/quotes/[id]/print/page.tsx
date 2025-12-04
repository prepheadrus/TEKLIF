'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useEffect } from 'react';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { calculateItemTotals } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import Image from 'next/image';

type Proposal = {
    id: string;
    quoteNumber: string;
    createdAt: { seconds: number };
    customerName: string;
    projectName: string;
    customerId: string;
    totalAmount: number;
    exchangeRates: { USD: number, EUR: number };
};

type ProposalItem = {
    id:string;
    name: string;
    brand: string;
    quantity: number;
    unit: string;
    listPrice: number;
    currency: 'TRY' | 'USD' | 'EUR';
    discountRate: number;
    profitMargin: number;
    groupName?: string;
};

type Customer = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
};

type CalculatedItem = ProposalItem & {
    unitPrice: number;
    total: number;
};

const formatDate = (timestamp?: { seconds: number }) => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR');
}

const formatCurrency = (amount: number, currency: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

const generatePrintHTML = (proposal: Proposal, customer: Customer, sortedGroups: [string, CalculatedItem[]][], totals: any) => {
    return `
        <html>
            <head>
                <title>Teklif: ${proposal.quoteNumber}</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                <style>
                    body {
                        font-family: 'Inter', sans-serif;
                        font-size: 10px;
                        color: #374151; /* gray-700 */
                    }
                    @page {
                      margin: 0;
                    }
                    .print-layout {
                        background-color: white;
                        padding: 1.5cm;
                    }
                </style>
            </head>
            <body>
                <div class="print-layout">
                     <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                        <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                            <img src="/logo.png" alt="Firma Logosu" style="width: 80px; height: 80px; object-fit: contain;" />
                            <div>
                                <h2 style="font-size: 1rem; font-weight: 700; color: #1f2937;">İMS Mühendislik</h2>
                                <p style="font-size: 10px; font-weight: 600; color: #4b5563;">Isıtma-Soğutma ve Mekanik Tesisat Çözümleri</p>
                                <p style="font-size: 10px; max-width: 24rem; margin-top: 0.25rem;">Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA</p>
                                <p style="font-size: 10px; margin-top: 0.25rem;">ims.m.muhendislik@gmail.com | (553) 469 75 01</p>
                            </div>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                            <h2 style="font-size: 1.25rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">TEKLİF</h2>
                            <p style="margin-top: 0.25rem;"><span style="font-weight: 600;">Teklif No:</span> ${proposal.quoteNumber}</p>
                            <p><span style="font-weight: 600;">Tarih:</span> ${formatDate(proposal.createdAt)}</p>
                        </div>
                    </header>

                    <section style="margin-bottom: 1rem; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; break-inside: avoid;">
                        <div style="border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.375rem; background-color: #f9fafb;">
                            <h3 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem;">Müşteri Bilgileri</h3>
                            <p style="font-weight: 700; font-size: 0.75rem;">${customer.name}</p>
                            <p>${customer.address || 'Adres belirtilmemiş'}</p>
                            <p>${customer.email} | ${customer.phone || 'Telefon belirtilmemiş'}</p>
                            ${customer.taxNumber ? `<p>Vergi No/TCKN: ${customer.taxNumber}</p>` : ''}
                        </div>
                        <div style="border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.375rem; background-color: #f9fafb;">
                            <h3 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem;">Proje Bilgisi</h3>
                            <p style="font-weight: 700; font-size: 0.75rem;">${proposal.projectName}</p>
                        </div>
                    </section>

                    <section style="margin-bottom: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                        ${sortedGroups.map(([groupName, groupItems]) => `
                            <div>
                                <h3 style="font-size: 0.875rem; font-weight: 700; margin-bottom: 0.25rem; padding: 0.25rem; background-color: #f3f4f6; border-radius: 0.375rem 0.375rem 0 0; border-bottom: 2px solid #d1d5db; break-inside: avoid;">${groupName}</h3>
                                <table style="width: 100%; font-size: 10px; text-align: left; border-collapse: collapse;">
                                    <thead style="display: table-header-group;">
                                        <tr style="background-color: #e5e7eb;">
                                            <th style="padding: 4px 8px; font-weight: 700; color: #374151; border-bottom: 1px solid #d1d5db; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">#</th>
                                            <th style="padding: 4px 8px; font-weight: 700; color: #374151; border-bottom: 1px solid #d1d5db; text-align: left; width: 40%; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Açıklama</th>
                                            <th style="padding: 4px 8px; font-weight: 700; color: #374151; border-bottom: 1px solid #d1d5db; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Marka</th>
                                            <th style="padding: 4px 8px; font-weight: 700; color: #374151; border-bottom: 1px solid #d1d5db; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Miktar</th>
                                            <th style="padding: 4px 8px; font-weight: 700; color: #374151; border-bottom: 1px solid #d1d5db; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Birim</th>
                                            <th style="padding: 4px 8px; font-weight: 700; color: #374151; border-bottom: 1px solid #d1d5db; text-align: right; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Birim Fiyat</th>
                                            <th style="padding: 4px 8px; font-weight: 700; color: #374151; border-bottom: 1px solid #d1d5db; text-align: right; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Toplam Tutar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${groupItems.map((item, index) => `
                                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                                <td style="padding: 2px 8px; vertical-align: top;">${index + 1}</td>
                                                <td style="padding: 2px 8px; vertical-align: top; font-weight: 500;">${item.name}</td>
                                                <td style="padding: 2px 8px; vertical-align: top;">${item.brand}</td>
                                                <td style="padding: 2px 8px; vertical-align: top; text-align: center;">${item.quantity}</td>
                                                <td style="padding: 2px 8px; vertical-align: top;">${item.unit}</td>
                                                <td style="padding: 2px 8px; vertical-align: top; text-align: right;">${formatCurrency(item.unitPrice, 'TRY')}</td>
                                                <td style="padding: 2px 8px; vertical-align: top; text-align: right; font-weight: 600;">${formatCurrency(item.total, 'TRY')}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                    <tfoot style="break-inside: avoid;">
                                        <tr style="background-color: #f3f4f6; font-weight: 700;">
                                            <td colspan="6" style="padding: 4px 8px; text-align: right; border-top: 2px solid #d1d5db;">Grup Toplamı (KDV Hariç):</td>
                                            <td style="padding: 4px 8px; text-align: right; border-top: 2px solid #d1d5db;">
                                                ${formatCurrency(groupItems.reduce((sum, item) => sum + item.total, 0), 'TRY')}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        `).join('')}
                    </section>

                    <section style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; break-inside: avoid;">
                        <div style="width: 50%;"></div>
                        <div style="width: 50%; display: flex; flex-direction: column; gap: 0.25rem;">
                            <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="font-weight: 600;">Ara Toplam (TL):</span>
                                    <span>${formatCurrency(totals.grandTotalInTRY.subtotal, 'TRY')}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="font-weight: 600;">KDV (%20) (TL):</span>
                                    <span>${formatCurrency(totals.grandTotalInTRY.vat, 'TRY')}</span>
                                </div>
                                <div style="height: 1px; background-color: #e5e7eb; margin: 2px 0;"></div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; font-weight: 700; color: #2563eb;">
                                    <span>Genel Toplam (TL):</span>
                                    <span>${formatCurrency(totals.grandTotalInTRY.grandTotal, 'TRY')}</span>
                                oversikt</div>
                            </div>
                            
                            ${(Object.keys(totals.byCurrency).length > 1) ? `
                                <div style="padding-top: 0.25rem;">
                                <h4 style="font-weight: 600; font-size: 0.75rem; margin-bottom: 0.25rem;">Para Birimi Bazında Özet (KDV Dahil)</h4>
                                ${Object.entries(totals.byCurrency).map(([currency, currencyTotals]: [string, any]) => `
                                     <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: ${currency === 'USD' ? '#166534' : currency === 'EUR' ? '#1d4ed8' : 'inherit'};">
                                        <span>Toplam (${currency}):</span>
                                        <span style="font-family: monospace; font-weight: 600;">${formatCurrency(currencyTotals.grandTotal, currency)}</span>
                                     </div>
                                `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </section>

                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; break-inside: avoid;">
                        <footer style="font-size: 9px; color: #4b5563; display: flex; flex-direction: column; gap: 0.25rem;">
                            <p style='font-weight: 600;'>Teklif Koşulları:</p>
                            <ul style="list-style-position: inside; padding-left: 0; margin: 0;">
                                <li>Teklifin geçerlilik süresi 15 gündür.</li>
                                <li>Fiyatlarımıza KDV dahildir.</li>
                                <li>Hesaplamada kullanılan kurlar: 1 EUR = ${proposal.exchangeRates.EUR.toFixed(4)} TL, 1 USD = ${proposal.exchangeRates.USD.toFixed(4)} TL</li>
                            </ul>
                            <p style="margin-top: 0.5rem; font-weight: 600; font-size: 0.75rem;">İMS Mühendislik | Teşekkür Ederiz!</p>
                        </footer>
                        <div style="position: relative; width: 10rem; height: auto;">
                           <img src="/kase.png" alt="Firma Kaşesi" style="width: 120px; height: 80px; object-fit: contain;" />
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `;
};


export default function PrintQuotePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const proposalId = params.id as string;
    const customerId = searchParams.get('customerId');

    const proposalRef = useMemoFirebase(
        () => (firestore && proposalId ? doc(firestore, 'proposals', proposalId) : null),
        [firestore, proposalId]
    );
    const { data: proposal, isLoading: isProposalLoading } = useDoc<Proposal>(proposalRef);

    const itemsRef = useMemoFirebase(
        () => (firestore && proposalId ? collection(firestore, 'proposals', proposalId, 'proposal_items') : null),
        [firestore, proposalId]
    );
    const { data: items, isLoading: areItemsLoading } = useCollection<ProposalItem>(itemsRef);

    const customerRef = useMemoFirebase(
        () => (firestore && customerId ? doc(firestore, 'customers', customerId) : null),
        [firestore, customerId]
    );
    const { data: customer, isLoading: isCustomerLoading } = useDoc<Customer>(customerRef);

    const { sortedGroups, totals } = useMemo(() => {
        if (!proposal || !items) {
            return { sortedGroups: [], totals: null };
        }
        
        const calculatedItems: CalculatedItem[] = items.map(item => {
            const totals = calculateItemTotals({
                ...item,
                exchangeRate: item.currency === 'USD' ? (proposal.exchangeRates?.USD || 1) : item.currency === 'EUR' ? (proposal.exchangeRates?.EUR || 1) : 1,
            });

            return {
                ...item,
                unitPrice: totals.tlSellPrice,
                total: totals.totalTlSell,
            };
        });

        const itemGroups = calculatedItems.reduce((acc, item) => {
          const groupName = item.groupName || 'Diğer';
          if (!acc[groupName]) {
            acc[groupName] = [];
          }
          acc[groupName].push(item);
          return acc;
        }, {} as Record<string, CalculatedItem[]>);

        const sortedGroups = Object.entries(itemGroups).sort(([a], [b]) => {
            if (a === 'Diğer') return 1;
            if (b === 'Diğer') return -1;
            return a.localeCompare(b);
        });
        
        const totalsByCurrency = items.reduce((acc, item) => {
            const itemTotals = calculateItemTotals({
                 ...item,
                 exchangeRate: 1,
            });
            const originalTotal = itemTotals.originalSellPrice * item.quantity;

            if (!acc[item.currency]) {
                acc[item.currency] = { subtotal: 0, vat: 0, grandTotal: 0 };
            }

            acc[item.currency].subtotal += originalTotal;
            acc[item.currency].vat += originalTotal * 0.20;
            acc[item.currency].grandTotal += originalTotal * 1.20;
            
            return acc;

        }, {} as Record<'TRY' | 'USD' | 'EUR', { subtotal: number, vat: number, grandTotal: number }>);
        
        const grandTotalInTRY = Object.entries(totalsByCurrency).reduce((sum, [currency, totals]) => {
            const rate = currency === 'USD' ? proposal.exchangeRates.USD : currency === 'EUR' ? proposal.exchangeRates.EUR : 1;
            return sum + (totals.subtotal * rate);
        }, 0);

        const vatInTRY = grandTotalInTRY * 0.20;
        const finalTotalInTRY = grandTotalInTRY + vatInTRY;

        const calculatedTotals = {
            byCurrency: totalsByCurrency,
            grandTotalInTRY: {
                subtotal: grandTotalInTRY,
                vat: vatInTRY,
                grandTotal: finalTotalInTRY
            }
        };

        return { sortedGroups, totals: calculatedTotals };
    }, [proposal, items]);

    useEffect(() => {
        if (!isProposalLoading && !areItemsLoading && !isCustomerLoading && proposal && customer && sortedGroups && totals) {
            const printHtml = generatePrintHTML(proposal, customer, sortedGroups, totals);
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(printHtml);
                printWindow.document.close();
                const timer = setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 1000); 
                return () => clearTimeout(timer);
            }
        }
    }, [isProposalLoading, areItemsLoading, isCustomerLoading, proposal, customer, sortedGroups, totals]);

    useEffect(() => {
        if (!isProposalLoading && !areItemsLoading && !isCustomerLoading && (!proposal || !customer || !items)) {
            // Data loading finished, but some data is missing. Close the window.
            const timer = setTimeout(() => {
                 window.close();
            }, 1500); // Give user time to see an error if we were to show one
            return () => clearTimeout(timer);
        }
    }, [isProposalLoading, areItemsLoading, isCustomerLoading, proposal, customer, items]);


    if (isProposalLoading || areItemsLoading || isCustomerLoading) {
         return (
            <div className="flex h-screen w-full items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Teklif çıktısı hazırlanıyor...</p>
                </div>
            </div>
        );
    }

    if (!proposal || !items || !customer) {
        return (
             <div className="flex h-screen w-full items-center justify-center bg-white">
                <p className="text-red-500">Yazdırma için gerekli veriler yüklenemedi. Bu pencere birazdan kapanacak.</p>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Yazdırma penceresi hazırlanıyor...</p>
                <p className="text-sm text-gray-400">Eğer yeni bir pencere açılmadıysa, lütfen pop-up engelleyicinizi kontrol edin.</p>
            </div>
        </div>
    );
}

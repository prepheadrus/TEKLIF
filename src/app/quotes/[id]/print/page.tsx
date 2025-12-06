'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { calculateItemTotals } from '@/lib/pricing';


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

    const isLoading = isProposalLoading || areItemsLoading || isCustomerLoading;

    const generatePrintHTML = useCallback(() => {
        if (isLoading || !proposal || !items || !customer || !totals) {
            return '';
        }
    
        const coverPageIntro = `<div style="margin-top: 3rem; padding: 1rem; font-size: 11px; line-height: 1.6;">
            <p>Sayın ${customer.name},</p>
            <p>Firmanızın ihtiyaçları doğrultusunda, "${proposal.projectName}" projesi için hazırlamış olduğumuz teklifimizi bilgilerinize sunarız. Projenizin her aşamasında kalite, verimlilik ve zamanında teslimat ilkeleriyle çalışmayı taahhüt eder, işbirliğimizin başarılı olacağına inancımızla teşekkür ederiz.</p>
            <p style="margin-top: 1rem; font-weight: 600;">İMS Mühendislik | Teşekkür Ederiz!</p>
        </div>`;

        const mainContentHTML = sortedGroups.map(([groupName, groupItems]) => `
            <div key="${groupName}" style="break-inside: avoid;">
                <h3 style="font-size: 0.875rem; font-weight: 700; margin-bottom: 0.25rem; padding: 0.25rem 0.5rem; background-color: #f3f4f6; border-radius: 0.375rem 0.375rem 0 0; border-bottom: 2px solid #d1d5db;">${groupName}</h3>
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
                            <tr key="${item.id}" style="break-inside: avoid;">
                                <td style="padding: 2px 8px; vertical-align: top; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
                                <td style="padding: 2px 8px; vertical-align: top; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
                                <td style="padding: 2px 8px; vertical-align: top; border-bottom: 1px solid #e5e7eb;">${item.brand}</td>
                                <td style="padding: 2px 8px; vertical-align: top; text-align: center; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
                                <td style="padding: 2px 8px; vertical-align: top; border-bottom: 1px solid #e5e7eb;">${item.unit}</td>
                                <td style="padding: 2px 8px; vertical-align: top; text-align: right; border-bottom: 1px solid #e5e7eb;">${formatCurrency(item.unitPrice, 'TRY')}</td>
                                <td style="padding: 2px 8px; vertical-align: top; text-align: right; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${formatCurrency(item.total, 'TRY')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot style="display: table-footer-group;">
                        <tr style="background-color: #f3f4f6; font-weight: 700; break-inside: avoid;">
                            <td colspan="6" style="padding: 4px 8px; text-align: right; border-top: 2px solid #d1d5db;">Grup Toplamı (KDV Hariç):</td>
                            <td style="padding: 4px 8px; text-align: right; border-top: 2px solid #d1d5db;">
                                ${formatCurrency(groupItems.reduce((sum, item) => sum + item.total, 0), 'TRY')}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `).join('');

        const currencySummaryHTML = (Object.keys(totals.byCurrency).length > 1) ? `
            <div style="padding-top: 0.25rem;">
                <h4 style="font-weight: 600; font-size: 0.75rem; margin-bottom: 0.25rem;">Para Birimi Bazında Özet (KDV Dahil)</h4>
                ${Object.entries(totals.byCurrency).map(([currency, currencyTotals]) => `
                    <div key="${currency}" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: ${currency === 'USD' ? '#166534' : currency === 'EUR' ? '#1d4ed8' : 'inherit'};">
                        <span>Toplam (${currency}):</span>
                        <span style="font-family: monospace; font-weight: 600;">${formatCurrency(currencyTotals.grandTotal, currency as 'TRY'|'USD'|'EUR')}</span>
                    </div>
                `).join('')}
            </div>
        ` : '';
        
        return `
            <html>
                <head>
                    <title>Teklif - ${proposal.quoteNumber}</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
                    <style>
                        @page {
                            size: A4;
                            margin: 0;
                        }
                        body {
                            -webkit-print-color-adjust: exact;
                            font-family: 'Inter', sans-serif;
                            font-size: 10px;
                            color: #374151;
                            background-color: #fff;
                        }
                        .print-layout {
                            padding: 1.5cm;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-layout">
                        <!-- Cover Page -->
                        <div style="display: flex; flex-direction: column; justify-content: space-between; height: calc(100vh - 3cm); page-break-after: always;">
                            <div>
                                <header style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                    <div style="display: flex; align-items: center; gap: 1.5rem;">
                                        <img src="/logo.png" alt="Firma Logosu" style="width: 100px; height: 100px; object-fit: contain;" />
                                        <div>
                                            <h1 style="font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0;">İMS Mühendislik</h1>
                                            <p style="font-size: 0.875rem; font-weight: 600; color: #4b5563; margin: 4px 0 0 0;">Isıtma-Soğutma ve Mekanik Tesisat Çözümleri</p>
                                            <p style="font-size: 0.75rem; margin-top: 0.5rem; margin: 8px 0 0 0;">Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA</p>
                                            <p style="font-size: 0.75rem; margin-top: 0.25rem; margin: 4px 0 0 0;">ims.m.muhendislik@gmail.com | (553) 469 75 01</p>
                                        </div>
                                    </div>
                                    <div style="text-align: right; flex-shrink: 0;">
                                        <h2 style="font-size: 1.875rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; color: #111827;">TEKLİF</h2>
                                        <p style="margin-top: 0.5rem; margin: 8px 0 0 0;"><span style="font-weight: 600;">Teklif No:</span> ${proposal.quoteNumber}</p>
                                        <p style="margin: 4px 0 0 0;"><span style="font-weight: 600;">Tarih:</span> ${formatDate(proposal.createdAt)}</p>
                                    </div>
                                </header>
                                <div style="margin-top: 2rem; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem;">
                                    <div style="border: 1px solid #e5e7eb; padding: 1rem; border-radius: 0.5rem; background-color: #f9fafb;">
                                        <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; border-bottom: 1px solid #d1d5db; padding-bottom: 0.5rem;">Müşteri Bilgileri</h3>
                                        <p style="font-weight: 700; font-size: 0.875rem; color: #111827;">${customer.name}</p>
                                        <p style="margin-top: 0.25rem;">${customer.address || 'Adres belirtilmemiş'}</p>
                                        <p style="margin-top: 0.25rem;">${customer.email} | ${customer.phone || 'Telefon belirtilmemiş'}</p>
                                        ${customer.taxNumber ? `<p style="margin-top: 0.25rem;">Vergi No/TCKN: ${customer.taxNumber}</p>` : ''}
                                    </div>
                                    <div style="border: 1px solid #e5e7eb; padding: 1rem; border-radius: 0.5rem; background-color: #f9fafb;">
                                        <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; border-bottom: 1px solid #d1d5db; padding-bottom: 0.5rem;">Proje Bilgisi</h3>
                                        <p style="font-weight: 700; font-size: 0.875rem; color: #111827;">${proposal.projectName}</p>
                                    </div>
                                </div>
                                ${coverPageIntro}
                            </div>
                            <footer style="border-top: 1px solid #e5e7eb; padding-top: 0.75rem; font-size: 9px;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                                    <div>
                                        <p style="font-weight: 600; margin: 0; margin-bottom: 4px;">Teklif Koşulları:</p>
                                        <ul style="list-style-position: inside; padding-left: 0; margin: 0; display: flex; flex-direction: column; gap: 2px;">
                                            <li>Teklifin geçerlilik süresi 15 gündür.</li>
                                            <li>Fiyatlarımıza KDV dahildir.</li>
                                            <li>Hesaplamada kullanılan kurlar: 1 EUR = ${proposal.exchangeRates.EUR.toFixed(4)} TL, 1 USD = ${proposal.exchangeRates.USD.toFixed(4)} TL</li>
                                        </ul>
                                    </div>
                                    <div style="position: relative; width: 10rem; height: auto; text-align: right;">
                                        <img src="/kase.png" alt="Firma Kaşesi" style="width: 120px; height: 80px; object-fit: contain;" />
                                    </div>
                                </div>
                            </footer>
                        </div>

                        <!-- Main Content Section -->
                        <main style="page-break-before: always;">
                            <header style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <img src="/logo.png" alt="Firma Logosu" style="width: 60px; height: 60px; object-fit: contain;" />
                                    <div>
                                        <h2 style="font-size: 1rem; font-weight: 700; color: #1f2937; margin: 0;">İMS Mühendislik</h2>
                                        <p style="font-size: 10px; margin-top: 2px; margin: 2px 0 0 0;">Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA</p>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <p style="margin: 0;"><span style="font-weight: 600;">Teklif No:</span> ${proposal.quoteNumber}</p>
                                    <p style="margin: 2px 0 0 0;"><span style="font-weight: 600;">Tarih:</span> ${formatDate(proposal.createdAt)}</p>
                                </div>
                            </header>
                            <section style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
                                ${mainContentHTML}
                            </section>
                            <section style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 1rem; break-inside: avoid;">
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
                                        </div>
                                    </div>
                                    ${currencySummaryHTML}
                                </div>
                            </section>
                        </main>
                    </div>
                </body>
            </html>
        `;
    }, [isLoading, proposal, items, customer, totals, sortedGroups]);

    useEffect(() => {
        // This effect runs whenever the dependencies change.
        // The condition inside ensures the logic only executes when data is ready.
        if (!isLoading) {
            const html = generatePrintHTML();
            if (html) { // Only proceed if HTML was generated
                const newWindow = window.open('about:blank', '_blank');
                if (newWindow) {
                    newWindow.document.open();
                    newWindow.document.write(html);
                    newWindow.document.close();
                }
            }
        }
    // The dependency array now includes generatePrintHTML to be correct.
    }, [isLoading, generatePrintHTML]);


    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center gap-4 text-center p-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <h1 className="text-xl font-semibold">Yazdırma Önizlemesi Hazırlanıyor</h1>
                <p className="text-muted-foreground max-w-md">
                    Teklif çıktınız yeni bir sekmede açılacaktır. Lütfen pop-up engelleyicinizin bu site için devre dışı olduğundan emin olun.
                </p>
                 <p className="text-sm text-muted-foreground max-w-md">
                   Eğer yeni sekme otomatik olarak açılmazsa, lütfen tarayıcınızın pop-up engelleyicisini kontrol edin.
                </p>
            </div>
        </div>
    );
}

'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useEffect, useCallback } from 'react';
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
    termsAndConditions?: string;
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


    const generatePrintHTML = useCallback(() => {
        if (!proposal || !items || !customer || !totals) {
            return '';
        }
    
        const mainContentHTML = sortedGroups.map(([groupName, groupItems]) => `
            <div style="break-inside: avoid;">
                <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; padding: 0.5rem; background-color: #f3f4f6; border-radius: 0.375rem 0.375rem 0 0; border-bottom: 2px solid #d1d5db; color: #111827; break-after: avoid;">${groupName}</h3>
                <table style="width: 100%; font-size: 10px; text-align: left; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #e5e7eb;">
                            <th style="padding: 4px 6px; font-weight: 700; color: #1f2937; border-bottom: 1px solid #d1d5db; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">#</th>
                            <th style="padding: 4px 6px; font-weight: 700; color: #1f2937; border-bottom: 1px solid #d1d5db; text-align: left; width: 40%; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Açıklama</th>
                            <th style="padding: 4px 6px; font-weight: 700; color: #1f2937; border-bottom: 1px solid #d1d5db; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Marka</th>
                            <th style="padding: 4px 6px; font-weight: 700; color: #1f2937; border-bottom: 1px solid #d1d5db; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Miktar</th>
                            <th style="padding: 4px 6px; font-weight: 700; color: #1f2937; border-bottom: 1px solid #d1d5db; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Birim</th>
                            <th style="padding: 4px 6px; font-weight: 700; color: #1f2D37; border-bottom: 1px solid #d1d5db; text-align: right; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Birim Fiyat</th>
                            <th style="padding: 4px 6px; font-weight: 700; color: #1f2937; border-bottom: 1px solid #d1d5db; text-align: right; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;">Toplam Tutar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupItems.map((item, index) => `
                            <tr>
                                <td style="padding: 4px 6px; vertical-align: middle; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
                                <td style="padding: 4px 6px; vertical-align: middle; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
                                <td style="padding: 4px 6px; vertical-align: middle; border-bottom: 1px solid #e5e7eb;">${item.brand}</td>
                                <td style="padding: 4px 6px; vertical-align: middle; text-align: center; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
                                <td style="padding: 4px 6px; vertical-align: middle; border-bottom: 1px solid #e5e7eb;">${item.unit}</td>
                                <td style="padding: 4px 6px; vertical-align: middle; text-align: right; border-bottom: 1px solid #e5e7eb;">${formatCurrency(item.unitPrice, 'TRY')}</td>
                                <td style="padding: 4px 6px; vertical-align: middle; text-align: right; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${formatCurrency(item.total, 'TRY')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background-color: #f3f4f6; font-weight: 700;">
                            <td colspan="6" style="padding: 6px 8px; text-align: right; border-top: 2px solid #d1d5db;">Grup Toplamı (KDV Hariç):</td>
                            <td style="padding: 6px 8px; text-align: right; border-top: 2px solid #d1d5db;">
                                ${formatCurrency(groupItems.reduce((sum, item) => sum + item.total, 0), 'TRY')}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `).join('');

        const currencySummaryHTML = (Object.keys(totals.byCurrency).length > 1) ? `
            <div style="padding-top: 0.5rem;">
                <h4 style="font-weight: 600; font-size: 0.75rem; margin-bottom: 0.25rem; color: #000000;">Para Birimi Bazında Özet (KDV Dahil)</h4>
                ${Object.entries(totals.byCurrency).map(([currency, currencyTotals]) => `
                    <div key="${currency}" style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                        <span style="color: #000000;">Toplam (${currency}):</span>
                        <span style="font-family: monospace; font-weight: 600; color: #000000;">${formatCurrency(currencyTotals.grandTotal, currency as 'TRY'|'USD'|'EUR')}</span>
                    </div>
                `).join('')}
            </div>
        ` : '';

        const termsHTML = proposal.termsAndConditions 
            ? proposal.termsAndConditions.replace(/\n/g, '<br />')
            : 'Teklif koşulları belirtilmemiş.';
        
        const coverLetterHtml = `<p>Sayın ${customer.name},</p><p>Firmanızın ihtiyaçları doğrultusunda, "${proposal.projectName}" projesi için hazırlamış olduğumuz teklifimizi bilgilerinize sunarız. Projenizin her aşamasında kalite, verimlilik ve zamanında teslimat ilkeleriyle çalışmayı taahhüt eder, işbirliğimizin başarılı olacağına inancımızla teşekkür ederiz.</p>`;

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
                            margin: 0 !important;
                            
                            @top-left { content: none; }
                            @top-center { content: none; }
                            @top-right { content: none; }
                            @bottom-left { content: none; }
                            @bottom-center { content: none; }
                            @bottom-right { content: none; }
                        }
                        
                         @media print {
                            body {
                                -webkit-print-color-adjust: exact;
                                font-family: 'Inter', sans-serif;
                                font-size: 10px;
                                color: #000000 !important;
                                background-color: #fff;
                                padding: 1.5cm 1cm 1cm 1.5cm;
                            }
                            
                            div, section, main, header, footer, article {
                                display: block !important;
                                height: auto !important;
                                min-height: unset !important;
                            }

                            .print-hidden, .print-hidden * { display: none !important; }
                            
                            .cover-page {
                                padding: 0 !important;
                                height: 100vh !important;
                                width: 100%;
                                display: flex !important;
                                flex-direction: column;
                                justify-content: center;
                                align-items: center;
                                text-align: center;
                                break-after: always; page-break-after: always;
                            }
                            
                            .content-start {
                                break-before: page; page-break-before: always;
                            }

                            .summary-wrapper, h3, .info-cards {
                                break-inside: avoid;
                            }
                            
                            tr {
                                break-inside: avoid;
                            }

                            thead {
                                display: table-header-group;
                            }
                            tfoot {
                                display: table-footer-group;
                            }
                        }
                    </style>
                </head>
                <body>
                    <!-- Cover Page -->
                    <div class="cover-page">
                        <header style="padding-bottom: 1.5rem; border-bottom: 1px solid #e5e7eb; width: 80%;">
                            <div style="display: table; width: 100%;">
                                <div style="display: table-cell; vertical-align: middle; width: 70%; text-align: left;">
                                    <img src="/logo.png" alt="Firma Logosu" style="width: 120px; height: 120px; object-fit: contain; vertical-align: middle; display: inline-block; margin-right: 1.5rem;" />
                                    <div style="display: inline-block; vertical-align: middle;">
                                        <h1 style="font-size: 1.875rem; font-weight: 700; margin: 0; color: #000000;">İMS Mühendislik</h1>
                                        <p style="font-size: 1rem; font-weight: 600; margin: 4px 0 0 0; color: #000000;">Isıtma-Soğutma ve Mekanik Tesisat Çözümleri</p>
                                        <p style="font-size: 0.875rem; margin: 8px 0 0 0; color: #000000;">Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA</p>
                                        <p style="font-size: 0.875rem; margin: 4px 0 0 0; color: #000000;">ims.m.muhendislik@gmail.com | (553) 469 75 01</p>
                                    </div>
                                </div>
                                <div style="display: table-cell; text-align: right; vertical-align: middle; width: 30%;">
                                    <h2 style="font-size: 2.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; color: #000000;">TEKLİF</h2>
                                    <p style="margin: 8px 0 0 0; font-size: 1rem; color: #000000;"><span style="font-weight: 600;">Teklif No:</span> ${proposal.quoteNumber}</p>
                                    <p style="margin: 4px 0 0 0; font-size: 1rem; color: #000000;"><span style="font-weight: 600;">Tarih:</span> ${formatDate(proposal.createdAt)}</p>
                                </div>
                            </div>
                        </header>
                         <div style="margin-top: 4rem; padding: 1rem; font-size: 12px; line-height: 1.7; color: #000000; width: 80%;">
                            <div style="min-height: 200px; text-align: left;">${coverLetterHtml}</div>
                            <div style="position: relative; text-align: right; margin-top: 3rem;">
                                <img src="/kase.png" alt="Firma Kaşesi" style="width: 130px; height: auto; object-fit: contain;" />
                            </div>
                         </div>
                    </div>

                    <!-- Main Content Section -->
                    <div class="content-start">
                        <header style="padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb;">
                            <div style="display: table; width: 100%;">
                                <div style="display: table-cell; vertical-align: middle;">
                                    <img src="/logo.png" alt="Firma Logosu" style="width: 70px; height: 70px; object-fit: contain; vertical-align: middle; display: inline-block; margin-right: 1rem;" />
                                    <div style="display: inline-block; vertical-align: middle;">
                                        <h2 style="font-size: 1.125rem; font-weight: 700; margin: 0; color: #000000;">İMS Mühendislik</h2>
                                        <p style="font-size: 10px; margin: 2px 0 0 0; color: #000000;">Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA</p>
                                    </div>
                                </div>
                                <div style="display: table-cell; text-align: right; vertical-align: middle;">
                                    <p style="margin: 0; font-size: 12px; color: #000000;"><span style="font-weight: 600;">Teklif No:</span> ${proposal.quoteNumber}</p>
                                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #000000;"><span style="font-weight: 600;">Tarih:</span> ${formatDate(proposal.createdAt)}</p>
                                </div>
                            </div>
                        </header>
                         <div class="info-cards" style="margin-top: 1.5rem; display: table; width: 100%; border-spacing: 1rem 0; margin-left: -1rem;">
                                <div style="display: table-cell; width: 50%; padding-left: 1rem;">
                                    <div style="padding: 0.5rem; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                                        <h3 style="font-size: 0.8rem; font-weight: 600; margin: 0; padding-bottom: 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #d1d5db; text-transform: uppercase; letter-spacing: 0.05em; color: #000000;">Müşteri Bilgileri</h3>
                                        <div style="line-height: 1.5; font-size: 0.75rem;">
                                            <p style="font-weight: 700; color: #111827; margin: 2px 0;">${customer.name}</p>
                                            <p style="margin: 2px 0; color: #000000;">${customer.address || 'Adres belirtilmemiş'}</p>
                                            <p style="margin: 2px 0; color: #000000;">${customer.email} | ${customer.phone || 'Telefon belirtilmemiş'}</p>
                                            ${customer.taxNumber ? `<p style="margin: 2px 0; color: #000000;">Vergi No/TCKN: ${customer.taxNumber}</p>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div style="display: table-cell; width: 50%; padding-left: 1rem;">
                                    <div style="padding: 0.5rem; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                                        <h3 style="font-size: 0.8rem; font-weight: 600; margin: 0; padding-bottom: 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #d1d5db; text-transform: uppercase; letter-spacing: 0.05em; color: #000000;">Proje Bilgisi</h3>
                                        <div style="line-height: 1.5; font-size: 0.75rem;">
                                            <p style="font-weight: 700; color: #111827; margin: 2px 0;">${proposal.projectName}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        <main>
                            <section style="margin-top: 1rem;">
                                ${mainContentHTML}
                            </section>
                            <div class="summary-wrapper" style="margin-top: 1rem;">
                                <div style="display: table; width: 100%;">
                                    <div style="display: table-cell; width: 55%; vertical-align: top; font-size: 9px; line-height: 1.5; white-space: pre-wrap; color: #000000; padding-right: 1rem;">
                                       <h4 style="font-weight: 600; font-size: 0.8rem; margin-bottom: 0.5rem; color: #000000;">Teklif Koşulları</h4>
                                       ${termsHTML}
                                    </div>
                                    <div style="display: table-cell; width: 45%; vertical-align: top; font-size: 0.7rem; padding: 0.5rem; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                                        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem;">
                                            <div style="display: table; width: 100%;"><span style="display: table-cell; font-weight: 600; color: #000000;">Ara Toplam (TL):</span><span style="display: table-cell; text-align: right; color: #000000;">${formatCurrency(totals.grandTotalInTRY.subtotal, 'TRY')}</span></div>
                                            <div style="display: table; width: 100%;"><span style="display: table-cell; font-weight: 600; color: #000000;">KDV (%20) (TL):</span><span style="display: table-cell; text-align: right; color: #000000;">${formatCurrency(totals.grandTotalInTRY.vat, 'TRY')}</span></div>
                                            <div style="height: 1px; background-color: #e5e7eb; margin: 4px 0;"></div>
                                            <div style="display: table; width: 100%; font-size: 1rem; font-weight: 700;"><span style="display: table-cell; color: #000000;">Genel Toplam (TL):</span><span style="display: table-cell; text-align: right; color: #000000;">${formatCurrency(totals.grandTotalInTRY.grandTotal, 'TRY')}</span></div>
                                        </div>
                                        ${currencySummaryHTML}
                                    </div>
                                </div>
                            </div>
                        </main>
                    </div>
                </body>
            </html>
        `;
    }, [proposal, items, customer, totals, sortedGroups]);

    useEffect(() => {
        if (isProposalLoading || areItemsLoading || isCustomerLoading) {
            return;
        }
        
        if (proposal && items && customer && totals) {
            const html = generatePrintHTML();
            const timer = setTimeout(() => {
                const newWindow = window.open('about:blank', '_blank');
                if (newWindow) {
                    newWindow.document.open();
                    newWindow.document.write(html);
                    newWindow.document.close();
                } else {
                    alert("Lütfen bu site için pop-up'lara izin verin.");
                }
            }, 100); 

            return () => clearTimeout(timer);
        }

    }, [isProposalLoading, areItemsLoading, isCustomerLoading, proposal, items, customer, totals, generatePrintHTML]);


    const isLoading = isProposalLoading || areItemsLoading || isCustomerLoading;
    
    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-100 print-hidden">
                <div className="flex flex-col items-center gap-4 text-center p-8">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h1 className="text-xl font-semibold">Yazdırma Önizlemesi Hazırlanıyor</h1>
                    <p className="text-muted-foreground max-w-md">
                       Teklif verileri yükleniyor... Yeni sekme otomatik olarak açılacaktır. Lütfen tarayıcınızın pop-up engelleyicisini kontrol edin.
                    </p>
                </div>
            </div>
        );
    }

    return (
         <div className="flex h-screen w-full items-center justify-center bg-gray-100 print-hidden">
            <div className="flex flex-col items-center gap-4 text-center p-8">
                <h1 className="text-xl font-semibold">Yönlendiriliyorsunuz...</h1>
                <p className="text-muted-foreground max-w-md">
                   Yazdırma penceresi açılmadıysa, lütfen pop-up engelleyicinizi kontrol edip tekrar deneyin.
                </p>
            </div>
        </div>
    );
}

    
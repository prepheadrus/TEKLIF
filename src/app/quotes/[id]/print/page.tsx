'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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

const generatePrintHTML = (proposal: Proposal, customer: Customer, sortedGroups: [string, CalculatedItem[]][], totals: any) => {
    const PrintComponent = () => (
        <div className="print-layout">
             <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="Firma Logosu" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                    <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#1f2937' }}>İMS Mühendislik</h2>
                        <p style={{ fontSize: '10px', fontWeight: '600', color: '#4b5563' }}>Isıtma-Soğutma ve Mekanik Tesisat Çözümleri</p>
                        <p style={{ fontSize: '10px', maxWidth: '24rem', marginTop: '0.25rem' }}>Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA</p>
                        <p style={{ fontSize: '10px', marginTop: '0.25rem' }}>ims.m.muhendislik@gmail.com | (553) 469 75 01</p>
                    </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TEKLİF</h2>
                    <p style={{ marginTop: '0.25rem' }}><span style={{ fontWeight: '600' }}>Teklif No:</span> {proposal.quoteNumber}</p>
                    <p><span style={{ fontWeight: '600' }}>Tarih:</span> {formatDate(proposal.createdAt)}</p>
                </div>
            </header>

            <section style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                <div style={{ border: '1px solid #e5e7eb', padding: '0.5rem', borderRadius: '0.375rem', backgroundColor: '#f9fafb' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Müşteri Bilgileri</h3>
                    <p style={{ fontWeight: '700', fontSize: '0.75rem' }}>{customer.name}</p>
                    <p>{customer.address || 'Adres belirtilmemiş'}</p>
                    <p>{customer.email} | {customer.phone || 'Telefon belirtilmemiş'}</p>
                    {customer.taxNumber ? `<p>Vergi No/TCKN: ${customer.taxNumber}</p>` : ''}
                </div>
                <div style={{ border: '1px solid #e5e7eb', padding: '0.5rem', borderRadius: '0.375rem', backgroundColor: '#f9fafb' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Proje Bilgisi</h3>
                    <p style={{ fontWeight: '700', fontSize: '0.75rem' }}>{proposal.projectName}</p>
                </div>
            </section>

            <section style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sortedGroups.map(([groupName, groupItems]) => (
                    <div key={groupName} style={{ breakInside: 'avoid' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', padding: '0.25rem', backgroundColor: '#f3f4f6', borderRadius: '0.375rem 0.375rem 0 0', borderBottom: '2px solid #d1d5db' }}>{groupName}</h3>
                        <table style={{ width: '100%', fontSize: '10px', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead style={{ display: 'table-header-group' }}>
                                <tr style={{ backgroundColor: '#e5e7eb' }}>
                                    <th style={{ padding: '4px 8px', fontWeight: 700, color: '#374151', borderBottom: '1px solid #d1d5db', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>#</th>
                                    <th style={{ padding: '4px 8px', fontWeight: 700, color: '#374151', borderBottom: '1px solid #d1d5db', textAlign: 'left', width: '40%', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>Açıklama</th>
                                    <th style={{ padding: '4px 8px', fontWeight: 700, color: '#374151', borderBottom: '1px solid #d1d5db', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>Marka</th>
                                    <th style={{ padding: '4px 8px', fontWeight: 700, color: '#374151', borderBottom: '1px solid #d1d5db', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>Miktar</th>
                                    <th style={{ padding: '4px 8px', fontWeight: 700, color: '#374151', borderBottom: '1px solid #d1d5db', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>Birim</th>
                                    <th style={{ padding: '4px 8px', fontWeight: 700, color: '#374151', borderBottom: '1px solid #d1d5db', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>Birim Fiyat</th>
                                    <th style={{ padding: '4px 8px', fontWeight: 700, color: '#374151', borderBottom: '1px solid #d1d5db', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>Toplam Tutar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupItems.map((item, index) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '2px 8px', verticalAlign: 'top' }}>{index + 1}</td>
                                        <td style={{ padding: '2px 8px', verticalAlign: 'top', fontWeight: 500 }}>{item.name}</td>
                                        <td style={{ padding: '2px 8px', verticalAlign: 'top' }}>{item.brand}</td>
                                        <td style={{ padding: '2px 8px', verticalAlign: 'top', textAlign: 'center' }}>{item.quantity}</td>
                                        <td style={{ padding: '2px 8px', verticalAlign: 'top' }}>{item.unit}</td>
                                        <td style={{ padding: '2px 8px', verticalAlign: 'top', textAlign: 'right' }}>{formatCurrency(item.unitPrice, 'TRY')}</td>
                                        <td style={{ padding: '2px 8px', verticalAlign: 'top', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total, 'TRY')}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot style={{ breakInside: 'avoid' }}>
                                <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 700 }}>
                                    <td colSpan={6} style={{ padding: '4px 8px', textAlign: 'right', borderTop: '2px solid #d1d5db' }}>Grup Toplamı (KDV Hariç):</td>
                                    <td style={{ padding: '4px 8px', textAlign: 'right', borderTop: '2px solid #d1d5db' }}>
                                        {formatCurrency(groupItems.reduce((sum, item) => sum + item.total, 0), 'TRY')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ))}
            </section>

             <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', breakInside: 'avoid' }}>
                <div style={{ width: '50%' }}></div>
                <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600 }}>Ara Toplam (TL):</span>
                            <span>{formatCurrency(totals.grandTotalInTRY.subtotal, 'TRY')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600 }}>KDV (%20) (TL):</span>
                            <span>{formatCurrency(totals.grandTotalInTRY.vat, 'TRY')}</span>
                        </div>
                        <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '2px 0' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 700, color: '#2563eb' }}>
                            <span>Genel Toplam (TL):</span>
                            <span>{formatCurrency(totals.grandTotalInTRY.grandTotal, 'TRY')}</span>
                        </div>
                    </div>
                    
                    {(Object.keys(totals.byCurrency).length > 1) && (
                        <div style={{ paddingTop: '0.25rem' }}>
                        <h4 style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: '0.25rem' }}>Para Birimi Bazında Özet (KDV Dahil)</h4>
                        {Object.entries(totals.byCurrency).map(([currency, currencyTotals]: [string, any]) => (
                             <div key={currency} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: currency === 'USD' ? '#166534' : currency === 'EUR' ? '#1d4ed8' : 'inherit' }}>
                                <span>Toplam ({currency}):</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(currencyTotals.grandTotal, currency)}</span>
                             </div>
                        ))}
                        </div>
                    )}
                </div>
            </section>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb', breakInside: 'avoid' }}>
                <footer style={{ fontSize: '9px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p style={{ fontWeight: 600 }}>Teklif Koşulları:</p>
                    <ul style={{ listStylePosition: 'inside', paddingLeft: 0, margin: 0 }}>
                        <li>Teklifin geçerlilik süresi 15 gündür.</li>
                        <li>Fiyatlarımıza KDV dahildir.</li>
                        <li>Hesaplamada kullanılan kurlar: 1 EUR = {proposal.exchangeRates.EUR.toFixed(4)} TL, 1 USD = {proposal.exchangeRates.USD.toFixed(4)} TL</li>
                    </ul>
                    <p style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '0.75rem' }}>İMS Mühendislik | Teşekkür Ederiz!</p>
                </footer>
                <div style={{ position: 'relative', width: '10rem', height: 'auto' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img src="/kase.png" alt="Firma Kaşesi" style={{ width: '120px', height: '80px', objectFit: 'contain' }} />
                </div>
            </div>
        </div>
    );
    return renderToStaticMarkup(<PrintComponent />);
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
        if (isProposalLoading || areItemsLoading || isCustomerLoading || !proposal || !customer || !items) {
            return;
        }

        const html = generatePrintHTML(proposal, customer, sortedGroups, totals);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Teklif: ${proposal.quoteNumber}</title>
                        <link rel="stylesheet" type="text/css" href="/globals.css">
                         <style>
                            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                            body { 
                                font-family: 'Inter', sans-serif; 
                                font-size: 10px;
                                color: #374151;
                            }
                             @page { 
                                size: A4;
                                margin: 0;
                            }
                             .print-layout {
                                padding: 1.5cm;
                             }
                        </style>
                    </head>
                    <body>
                        ${html}
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    }, [isProposalLoading, areItemsLoading, isCustomerLoading, proposal, customer, items, sortedGroups, totals]);

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
                <p className="text-red-500">Yazdırma için gerekli veriler yüklenemedi.</p>
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

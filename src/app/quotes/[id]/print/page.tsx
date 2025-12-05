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
        <html>
            <head>
                <title>Teklif: {proposal.quoteNumber}</title>
                 <style dangerouslySetInnerHTML={{ __html: `
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    
                    @page {
                      size: A4;
                      margin: 1.5cm;
                      @top-center {
                        content: element(pageHeader);
                        border-bottom: 1px solid #e5e7eb;
                        padding-bottom: 1rem;
                      }
                       @bottom-center {
                        content: element(pageFooter);
                      }
                    }

                    body {
                      -webkit-print-color-adjust: exact;
                      font-family: 'Inter', sans-serif;
                      font-size: 10px;
                      color: #374151;
                      background-color: #fff;
                    }
                    
                    .page-header {
                        position: running(pageHeader);
                    }

                    .page-footer {
                        position: running(pageFooter);
                        padding-top: 0.5rem;
                        border-top: 1px solid #e5e7eb;
                        font-size: 9px;
                        color: #6b7280;
                    }

                    .cover-page {
                        page-break-after: always;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        height: calc(100vh - 3cm);
                    }

                    .cover-page .page-header {
                        position: static; /* Do not repeat header on cover page */
                    }

                    .content-page {
                        /* Styles for pages after the cover */
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
                ` }} />
            </head>
            <body>
                {/* --- Cover Page Section --- */}
                <div className="cover-page">
                    <div>
                        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '0.75rem' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo.png" alt="Firma Logosu" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
                                <div>
                                    <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>İMS Mühendislik</h1>
                                    <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', margin: '4px 0 0 0' }}>Isıtma-Soğutma ve Mekanik Tesisat Çözümleri</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', margin: '8px 0 0 0' }}>Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', margin: '4px 0 0 0' }}>ims.m.muhendislik@gmail.com | (553) 469 75 01</p>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <h2 style={{ fontSize: '1.875rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, color: '#111827' }}>TEKLİF</h2>
                                <p style={{ marginTop: '0.5rem', margin: '8px 0 0 0' }}><span style={{ fontWeight: '600' }}>Teklif No:</span> {proposal.quoteNumber}</p>
                                <p style={{ margin: '4px 0 0 0' }}><span style={{ fontWeight: '600' }}>Tarih:</span> {formatDate(proposal.createdAt)}</p>
                            </div>
                        </div>

                         <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                            <div style={{ border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', borderBottom: '1px solid #d1d5db', paddingBottom: '0.5rem' }}>Müşteri Bilgileri</h3>
                                <p style={{ fontWeight: '700', fontSize: '0.875rem', color: '#111827' }}>{customer.name}</p>
                                <p style={{ marginTop: '0.25rem' }}>{customer.address || 'Adres belirtilmemiş'}</p>
                                <p style={{ marginTop: '0.25rem' }}>{customer.email} | {customer.phone || 'Telefon belirtilmemiş'}</p>
                                {customer.taxNumber && <p style={{marginTop: '0.25rem' }}>Vergi No/TCKN: {customer.taxNumber}</p>}
                            </div>
                            <div style={{ border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', borderBottom: '1px solid #d1d5db', paddingBottom: '0.5rem' }}>Proje Bilgisi</h3>
                                <p style={{ fontWeight: '700', fontSize: '0.875rem', color: '#111827' }}>{proposal.projectName}</p>
                            </div>
                        </div>

                        <div style={{ marginTop: '3rem', padding: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>Sayın {customer.name},</h3>
                            <p style={{ marginTop: '0.75rem', lineHeight: '1.6', fontSize: '11px' }}>
                                Firmanızın ihtiyaçları doğrultusunda, en güncel teknoloji ve mühendislik standartları göz önünde bulundurularak hazırlanan mekanik tesisat teklifimiz ekte sunulmuştur. Projenizin her aşamasında kalite, verimlilik ve zamanında teslimat ilkeleriyle çalışmayı taahhüt ederiz. Detaylı keşif ve projelendirme sonrası oluşturulan bu teklifin, projenizin başarısına önemli katkı sağlayacağına inanıyoruz.
                            </p>
                            <p style={{ marginTop: '1rem', fontWeight: '600' }}>İMS Mühendislik | Teşekkür Ederiz!</p>
                        </div>
                    </div>

                    <div className="page-footer">
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
                             <div>
                                <p style={{ fontWeight: 600, margin: 0, marginBottom: '4px' }}>Teklif Koşulları:</p>
                                <ul style={{ listStylePosition: 'inside', paddingLeft: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <li>Teklifin geçerlilik süresi 15 gündür.</li>
                                    <li>Fiyatlarımıza KDV dahildir.</li>
                                    <li>Hesaplamada kullanılan kurlar: 1 EUR = {proposal.exchangeRates.EUR.toFixed(4)} TL, 1 USD = {proposal.exchangeRates.USD.toFixed(4)} TL</li>
                                </ul>
                            </div>
                            <div style={{ position: 'relative', width: '10rem', height: 'auto', textAlign: 'right' }}>
                                 {/* eslint-disable-next-line @next/next/no-img-element */}
                               <img src="/kase.png" alt="Firma Kaşesi" style={{ width: '120px', height: '80px', objectFit: 'contain' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Repeating Header for Content Pages --- */}
                <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.png" alt="Firma Logosu" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                        <div>
                            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>İMS Mühendislik</h2>
                            <p style={{ fontSize: '10px', marginTop: '2px', margin: '2px 0 0 0' }}>Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0 }}><span style={{ fontWeight: '600' }}>Teklif No:</span> {proposal.quoteNumber}</p>
                        <p style={{ margin: '2px 0 0 0' }}><span style={{ fontWeight: '600' }}>Tarih:</span> {formatDate(proposal.createdAt)}</p>
                    </div>
                </header>

                <footer className="page-footer">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <p style={{ margin: 0 }}>İMS Mühendislik | Teşekkür Ederiz!</p>
                        <p style={{ margin: 0 }}>Sayfa <span className="pageNumber"></span> / <span className="totalPages"></span></p>
                    </div>
                </footer>

                {/* --- Main Content Section --- */}
                <main className="content-page">
                    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {sortedGroups.map(([groupName, groupItems]) => (
                            <div key={groupName} style={{breakInside: 'avoid-page'}}>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', padding: '0.25rem 0.5rem', backgroundColor: '#f3f4f6', borderRadius: '0.375rem 0.375rem 0 0', borderBottom: '2px solid #d1d5db' }}>{groupName}</h3>
                                <table style={{ width: '100%', fontSize: '10px', textAlign: 'left', borderCollapse: 'collapse' }}>
                                     <thead>
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
                                            <tr key={item.id} style={{ breakInside: 'avoid' }}>
                                                <td style={{ padding: '2px 8px', verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>{index + 1}</td>
                                                <td style={{ padding: '2px 8px', verticalAlign: 'top', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>{item.name}</td>
                                                <td style={{ padding: '2px 8px', verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>{item.brand}</td>
                                                <td style={{ padding: '2px 8px', verticalAlign: 'top', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>{item.quantity}</td>
                                                <td style={{ padding: '2px 8px', verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>{item.unit}</td>
                                                <td style={{ padding: '2px 8px', verticalAlign: 'top', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>{formatCurrency(item.unitPrice, 'TRY')}</td>
                                                <td style={{ padding: '2px 8px', verticalAlign: 'top', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>{formatCurrency(item.total, 'TRY')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 700, breakInside: 'avoid' }}>
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

                     <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '1rem', breakInside: 'avoid' }}>
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
                </main>
            </body>
        </html>
    );
    return `<!DOCTYPE html>${renderToStaticMarkup(<PrintComponent />)}`;
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
            const aNum = parseInt(a.split('.')[0], 10);
            const bNum = parseInt(b.split('.')[0], 10);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
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

        const htmlContent = generatePrintHTML(proposal, customer, sortedGroups, totals);
        const printWindow = window.open('', '_blank');
        
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        } else {
            alert("Lütfen bu site için pop-up'ları etkinleştirin.");
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
                <p className="text-red-500">Yazdırma için gerekli veriler yüklenemedi. Lütfen sekmeyi kapatıp tekrar deneyin.</p>
            </div>
        );
    }

    return (
         <div className="flex h-screen w-full items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Yazdırma sayfası yeni sekmede açılıyor...</p>
                <p className="text-sm text-gray-400">Sayfa açılmazsa, lütfen pop-up engelleyicinizi kontrol edin.</p>
            </div>
        </div>
    );
}

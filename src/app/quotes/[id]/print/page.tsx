'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
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
    id: string;
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

    const { calculatedItems, sortedGroups, totals } = useMemo(() => {
        if (!proposal || !items) {
            return { calculatedItems: [], sortedGroups: [], totals: null };
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

        return { calculatedItems, sortedGroups, totals: calculatedTotals };
    }, [proposal, items]);


    if (isProposalLoading || areItemsLoading || isCustomerLoading) {
         return (
            <div className="flex h-screen w-full items-center justify-center bg-white">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!proposal || !items || !customer || !totals) {
        return <div className="p-8 text-red-500">Yazdırma için gerekli veriler yüklenemedi.</div>;
    }

    return (
        <div className="print-layout bg-white text-black min-h-screen text-xs p-8 font-body">
            <header className="flex justify-between items-start mb-6 pb-4 border-b">
                <div className="flex items-start gap-4">
                    <Image src="/logo.png" alt="Firma Logosu" width={100} height={100} style={{objectFit: 'contain'}} />
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">İMS Mühendislik</h2>
                        <p className="text-xs font-semibold text-gray-600">Isıtma-Soğutma ve Mekanik Tesisat Çözümleri</p>
                        <p className="text-xs max-w-xs mt-2">
                            Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA
                        </p>
                        <p className="text-xs mt-1">ims.m.muhendislik@gmail.com | (553) 469 75 01</p>
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <h2 className="text-xl font-bold uppercase tracking-wider">TEKLİF</h2>
                    <p className="mt-1">
                        <span className="font-semibold">Teklif No:</span> {proposal.quoteNumber}
                    </p>
                    <p>
                        <span className="font-semibold">Tarih:</span> {formatDate(proposal.createdAt)}
                    </p>
                </div>
            </header>

            <section className="mb-6 grid grid-cols-2 gap-4">
                <div className="border p-3 rounded-md bg-gray-50">
                    <h3 className="text-base font-semibold mb-1">Müşteri Bilgileri</h3>
                    <p className="font-bold text-sm">{customer.name}</p>
                    <p>{customer.address || 'Adres belirtilmemiş'}</p>
                    <p>{customer.email} | {customer.phone || 'Telefon belirtilmemiş'}</p>
                    {customer.taxNumber && <p>Vergi No/TCKN: {customer.taxNumber}</p>}
                </div>
                 <div className="border p-3 rounded-md bg-gray-50">
                     <h3 className="text-base font-semibold mb-1">Proje Bilgisi</h3>
                    <p className="font-bold text-sm">{proposal.projectName}</p>
                </div>
            </section>
            
             <section className="mb-6 space-y-6">
                {sortedGroups.map(([groupName, groupItems]) => (
                    <div key={groupName} className="break-inside-avoid">
                        <h3 className="text-base font-bold mb-2 p-2 bg-gray-100 rounded-t-md border-b-2 border-gray-300">{groupName}</h3>
                        <table className="w-full text-xs text-left" style={{ borderCollapse: 'collapse', width: '100%'}}>
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-2 font-semibold">#</th>
                                    <th className="p-2 font-semibold w-2/5">Açıklama</th>
                                    <th className="p-2 font-semibold">Marka</th>
                                    <th className="p-2 text-center font-semibold">Miktar</th>
                                    <th className="p-2 font-semibold">Birim</th>
                                    <th className="p-2 text-right font-semibold">Birim Fiyat</th>
                                    <th className="p-2 text-right font-semibold">Toplam Tutar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupItems.map((item, index) => (
                                    <tr key={item.id} className="border-b">
                                        <td className="p-2">{index + 1}</td>
                                        <td className="p-2 font-medium">{item.name}</td>
                                        <td className="p-2">{item.brand}</td>
                                        <td className="p-2 text-center">{item.quantity}</td>
                                        <td className="p-2">{item.unit}</td>
                                        <td className="p-2 text-right">{formatCurrency(item.unitPrice, 'TRY')}</td>
                                        <td className="p-2 text-right font-semibold">{formatCurrency(item.total, 'TRY')}</td>
                                    </tr>
                                ))}
                            </tbody>
                             <tfoot>
                                <tr className="bg-gray-100 font-bold">
                                    <td colSpan={6} className="p-2 text-right">Grup Toplamı (KDV Hariç):</td>
                                    <td className="p-2 text-right">
                                        {formatCurrency(groupItems.reduce((sum, item) => sum + item.total, 0), 'TRY')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ))}
            </section>

            <section className="flex justify-between items-start mb-6 break-inside-avoid">
                <div className="w-full sm:w-1/3 lg:w-1/2"></div>
                <div className="w-full sm:w-2/3 lg:w-1/2 space-y-4">
                    <div className="border-b pb-2">
                        <div className="flex justify-between">
                            <span className="font-semibold">Ara Toplam (TL):</span>
                            <span>{formatCurrency(totals.grandTotalInTRY.subtotal, 'TRY')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">KDV (%20) (TL):</span>
                            <span>{formatCurrency(totals.grandTotalInTRY.vat, 'TRY')}</span>
                        </div>
                        <div style={{height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0'}} />
                        <div className="flex justify-between text-base font-bold text-blue-700">
                            <span>Genel Toplam (TL):</span>
                            <span>{formatCurrency(totals.grandTotalInTRY.grandTotal, 'TRY')}</span>
                        </div>
                    </div>
                    
                    {(Object.keys(totals.byCurrency).length > 0) && (
                        <div className="pt-2">
                        <h4 className="font-semibold text-sm mb-1">Para Birimi Bazında Özet (KDV Dahil)</h4>
                        {Object.entries(totals.byCurrency).map(([currency, currencyTotals]) => (
                             <div className={cn(
                                "flex justify-between text-sm",
                                currency === 'USD' && 'text-green-600',
                                currency === 'EUR' && 'text-blue-600'
                             )} key={currency}>
                                <span>Toplam ({currency}):</span>
                                <span className="font-mono font-semibold">{formatCurrency(currencyTotals.grandTotal, currency)}</span>
                             </div>
                        ))}
                        </div>
                    )}
                </div>
            </section>
            
            <div className="flex justify-between items-end mt-16 pt-4 border-t break-inside-avoid">
                <footer className="text-xs text-gray-500 space-y-2">
                    <p className='font-semibold'>Teklif Koşulları:</p>
                    <ul className="list-disc list-inside">
                        <li>Teklifin geçerlilik süresi 15 gündür.</li>
                        <li>Fiyatlarımıza KDV dahildir.</li>
                        <li>Hesaplamada kullanılan kurlar: 1 EUR = {proposal.exchangeRates.EUR.toFixed(4)} TL, 1 USD = {proposal.exchangeRates.USD.toFixed(4)} TL</li>
                    </ul>
                    <p className="mt-4 font-semibold text-sm">İMS Mühendislik | Teşekkür Ederiz!</p>
                </footer>
                <div style={{ position: 'relative', width: '12rem', height: 'auto' }}>
                   <Image src="/kase.png" alt="Firma Kaşesi" width={150} height={100} style={{ objectFit: 'contain' }} />
                </div>
            </div>

        </div>
    );
}

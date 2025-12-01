'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { Loader2, Printer } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { calculatePrice } from '@/lib/pricing';


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
};

type Customer = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
};

export default function PrintQuotePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const proposalId = params.id as string;
    const customerId = searchParams.get('customerId');

    // Fetch Proposal
    const proposalRef = useMemoFirebase(
        () => (firestore && proposalId ? doc(firestore, 'proposals', proposalId) : null),
        [firestore, proposalId]
    );
    const { data: proposal, isLoading: isProposalLoading } = useDoc<Proposal>(proposalRef);

    // Fetch Proposal Items
    const itemsRef = useMemoFirebase(
        () => (firestore && proposalId ? collection(firestore, 'proposals', proposalId, 'proposal_items') : null),
        [firestore, proposalId]
    );
    const { data: items, isLoading: areItemsLoading } = useCollection<ProposalItem>(itemsRef);

    // Fetch customer details
    const customerRef = useMemoFirebase(
        () => (firestore && customerId ? doc(firestore, 'customers', customerId) : null),
        [firestore, customerId]
    );
    const { data: customer, isLoading: isCustomerLoading } = useDoc<Customer>(customerRef);
    
    useEffect(() => {
        if (proposal && items && customer) {
          // You might want to trigger print automatically or just ensure data is ready.
          // window.print();
        }
    }, [proposal, items, customer]);


    const isLoading = isProposalLoading || areItemsLoading || isCustomerLoading;

    const allDataLoaded = !!proposal && !!items && !!customer;

    
    const formatDate = (timestamp?: { seconds: number }) => {
        if (!timestamp) return '-';
        return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR');
    }

    const formatCurrency = (amount: number, currency: string = 'TRY') => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
    }
    
    const calculatedItems = useMemo(() => {
        if (!items || !proposal) return [];
        return items.map(item => {
            const exchangeRate =
                item.currency === 'USD'
                ? proposal.exchangeRates.USD
                : item.currency === 'EUR'
                ? proposal.exchangeRates.EUR
                : 1;

            const priceInfo = calculatePrice({
                listPrice: item.listPrice,
                discountRate: item.discountRate,
                profitMargin: item.profitMargin,
                exchangeRate: exchangeRate,
            });

            return {
                ...item,
                unitPrice: priceInfo.tlSellPrice,
                total: priceInfo.tlSellPrice * item.quantity,
            };
        });
    }, [items, proposal]);
    
    const totals = useMemo(() => {
        if (!calculatedItems.length || !proposal) return { subtotal: 0, vat: 0, grandTotal: proposal?.totalAmount || 0 };
        
        const grandTotal = proposal.totalAmount;
        const subTotalBeforeVat = grandTotal / 1.20;
        const vatAmount = grandTotal - subTotalBeforeVat;

        return {
            subtotal: subTotalBeforeVat,
            vat: vatAmount,
            grandTotal: grandTotal,
        };
    }, [calculatedItems, proposal]);


    return (
        <div className="bg-white text-black min-h-screen text-xs print:p-0 p-8">
            {isLoading ? (
                 <div className="flex h-screen items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="ml-4 text-lg">Teklif verileri yükleniyor...</p>
                </div>
            ) : allDataLoaded ? (
                <>
                <div className="fixed top-4 right-4 print:hidden z-50">
                    <Button onClick={() => window.print()}>
                        <Printer className="mr-2" /> Yazdır veya PDF Olarak Kaydet
                    </Button>
                </div>
                <div className="max-w-4xl mx-auto p-4 sm:p-8">
                    <header className="flex justify-between items-start mb-6 pb-4 border-b">
                        <div className="flex items-center gap-4">
                             {/* Logo might not be present, so handle that */}
                            {/* <Image src="/logo-header.png" alt="Firma Logosu" width={80} height={80} className="rounded-md" /> */}
                            <div>
                                <h2 className="text-xl font-bold text-primary">İMS Mühendislik</h2>
                                <p className="text-xs font-semibold text-gray-600">Isıtma-Soğutma ve Mekanik Tesisat Çözümleri</p>
                                <p className="text-xs max-w-xs mt-2">
                                    Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA
                                </p>
                                <p className="text-xs mt-1">ims.m.muhendislik@gmail.com | (553) 469 75 01</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold uppercase tracking-wider">TEKLİF</h2>
                            <p className="mt-1">
                                <span className="font-semibold">Teklif No:</span> {proposal.quoteNumber}
                            </p>
                            <p>
                                <span className="font-semibold">Tarih:</span> {formatDate(proposal.createdAt)}
                            </p>
                        </div>
                    </header>

                    <section className="mb-6">
                        <div className="border p-3 rounded-md bg-gray-50">
                            <h3 className="text-base font-semibold mb-1">Müşteri Bilgileri</h3>
                            <p className="font-bold text-base">{customer.name}</p>
                            <p>{customer.address || 'Adres belirtilmemiş'}</p>
                            <p>{customer.email} | {customer.phone || 'Telefon belirtilmemiş'}</p>
                            {customer.taxNumber && <p>Vergi No: {customer.taxNumber}</p>}
                            
                        </div>
                        <div className="mt-3">
                            <span className="font-semibold">Proje:</span> {proposal.projectName}
                        </div>
                    </section>

                    <section className="mb-6">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2 font-semibold">#</th>
                                    <th className="p-2 font-semibold">Açıklama</th>
                                    <th className="p-2 font-semibold">Marka</th>
                                    <th className="p-2 text-center font-semibold">Miktar</th>
                                    <th className="p-2 font-semibold">Birim</th>
                                    <th className="p-2 text-right font-semibold">Birim Fiyat (TL)</th>
                                    <th className="p-2 text-right font-semibold">Toplam Tutar (TL)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calculatedItems.map((item, index) => (
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
                        </table>
                    </section>

                    <section className="flex justify-end mb-6">
                        <div className="w-full sm:w-1/2 lg:w-2/5 space-y-1">
                            <div className="flex justify-between">
                                <span className="font-semibold">Ara Toplam:</span>
                                <span>{formatCurrency(totals.subtotal, 'TRY')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold">KDV (%20):</span>
                                <span>{formatCurrency(totals.vat, 'TRY')}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-base font-bold text-primary">
                                <span>Genel Toplam:</span>
                                <span>{formatCurrency(totals.grandTotal, 'TRY')}</span>
                            </div>
                        </div>
                    </section>

                    <footer className="w-full mt-8 pt-4 border-t">
                        <div className="text-xs text-gray-500 text-center">
                            <p>
                                Teklifin geçerlilik süresi 15 gündür. Fiyatlarımıza KDV dahildir.
                            </p>
                            <p className="mt-2 font-semibold">İMS Mühendislik | Teşekkür Ederiz!</p>
                        </div>
                    </footer>
                </div>
                </>
            ) : (
                 <div className="flex h-screen items-center justify-center">
                    <p className="text-lg text-destructive">Teklif verileri yüklenemedi veya eksik. Lütfen tekrar deneyin.</p>
                </div>
            )}
        </div>
    );
}

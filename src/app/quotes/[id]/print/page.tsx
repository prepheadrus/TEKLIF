
'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useEffect } from 'react';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { calculateItemTotals } from '@/lib/pricing';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

// Re-importing components as we are building a self-contained page
import { QuoteHeader } from '@/components/app/quote-header';
import { QuoteCustomerInfo } from '@/components/app/quote-customer-info';
import { QuoteItemsTable } from '@/components/app/quote-items-table';
import { QuoteFooter } from '@/components/app/quote-footer';


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
    versionNote?: string;
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

export default function PrintQuotePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const printRef = React.useRef<HTMLDivElement>(null);
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
    
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Teklif-${proposal?.quoteNumber || 'detay'}`,
    });

    const { groupedItems, grandTotal, grandTotalWithVAT, vatAmount } = useMemo(() => {
        if (!proposal || !items) {
            return { groupedItems: [], grandTotal: 0, grandTotalWithVAT: 0, vatAmount: 0 };
        }
        
        let subtotal = 0;

        const calculatedItems: CalculatedItem[] = items.map(item => {
            const totals = calculateItemTotals({
                ...item,
                exchangeRate: item.currency === 'USD' ? (proposal.exchangeRates?.USD || 1) : item.currency === 'EUR' ? (proposal.exchangeRates?.EUR || 1) : 1,
            });
            subtotal += totals.totalTlSell;
            return {
                ...item,
                unitPrice: totals.tlSellPrice,
                total: totals.totalTlSell,
            };
        });

        const grouped = calculatedItems.reduce((acc, item) => {
          const groupName = item.groupName || 'Diğer';
          if (!acc[groupName]) {
            acc[groupName] = [];
          }
          acc[groupName].push(item);
          return acc;
        }, {} as Record<string, CalculatedItem[]>);
        
        const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
            if (a === 'Diğer') return 1;
            if (b === 'Diğer') return -1;
            return a.localeCompare(b);
        });

        const calculatedVat = subtotal * 0.20;
        const totalWithVat = subtotal + calculatedVat;
        
        return { groupedItems: sortedGroups, grandTotal: subtotal, grandTotalWithVAT: totalWithVat, vatAmount: calculatedVat };
    }, [proposal, items]);


    const isLoading = isProposalLoading || areItemsLoading || isCustomerLoading;

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center gap-4 text-center p-8">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h1 className="text-xl font-semibold">Teklif Verileri Yükleniyor</h1>
                    <p className="text-muted-foreground max-w-md">
                       Lütfen bekleyin...
                    </p>
                </div>
            </div>
        );
    }
    
    if (!proposal || !customer || !items) {
         return (
             <div className="flex h-screen w-full items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center gap-4 text-center p-8">
                    <h1 className="text-xl font-semibold text-destructive">Veri Hatası</h1>
                    <p className="text-muted-foreground max-w-md">
                       Teklif, müşteri veya kalem bilgileri yüklenemedi. Lütfen tekrar deneyin.
                    </p>
                </div>
            </div>
         )
    }

    return (
        <div className="bg-gray-200">
             <div className="container mx-auto py-6 print:hidden">
                <Button onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Yazdır / PDF Olarak Kaydet
                </Button>
            </div>
            
            {/* Yazdırılacak Alan */}
            <div ref={printRef} className="bg-white p-[15mm] screen:max-w-[210mm] screen:mx-auto screen:my-8 screen:shadow-lg">
                <header className="mb-8">
                    <QuoteHeader
                        firmaLogo="/logo.png"
                        firmaAdi="İMS Mühendislik"
                        firmaAltBaslik="Isıtma-Soğutma ve Mekanik Tesisat Çözümleri"
                        firmaAdres="Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA"
                        firmaEmail="ims.m.muhendislik@gmail.com"
                        firmaTelefon="(553) 469 75 01"
                        teklifNo={proposal.quoteNumber}
                        tarih={formatDate(proposal.createdAt)}
                    />
                </header>

                <main>
                    <section className="mb-8">
                         <QuoteCustomerInfo
                            customer={{
                                ad: customer.name,
                                adres: customer.address,
                                email: customer.email,
                                telefon: customer.phone,
                                vergiNo: customer.taxNumber,
                            }}
                            projectName={proposal.projectName}
                        />
                    </section>
                    
                    <section className="mb-8">
                        {groupedItems.map(([groupName, groupItems]) => (
                            <div key={groupName} className="print-avoid-break mb-6">
                                <h3 className="font-bold text-lg mb-2 p-2 bg-slate-100 border-b-2 border-slate-300">{groupName}</h3>
                                <QuoteItemsTable
                                    items={groupItems.map((item, index) => ({
                                        ...item,
                                        sira: index + 1,
                                        aciklama: item.name,
                                        birimFiyat: item.unitPrice,
                                    }))}
                                    totals={{
                                        araToplam: groupItems.reduce((sum, item) => sum + item.total, 0),
                                        kdvOrani: 20,
                                        kdvTutari: groupItems.reduce((sum, item) => sum + item.total, 0) * 0.2,
                                        genelToplam: groupItems.reduce((sum, item) => sum + item.total, 0) * 1.2,
                                    }}
                                    currency="TRY"
                                    className="mb-6"
                                />
                            </div>
                        ))}
                    </section>
                </main>
                
                <footer className="pt-8 border-t-2 border-slate-300">
                    <div className="flex justify-end mb-8">
                        <div className="w-[350px] space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="font-semibold">Ara Toplam:</span>
                                <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(grandTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold">KDV (%20):</span>
                                <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(vatAmount)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold pt-2 border-t mt-2">
                                <span>Genel Toplam:</span>
                                <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(grandTotalWithVAT)}</span>
                            </div>
                        </div>
                    </div>
                     <QuoteFooter
                        notlar={proposal.termsAndConditions}
                        kosullar={[]}
                        firmaKase="/kase.png"
                        className="text-xs"
                    />
                </footer>
            </div>
        </div>
    );
}

    

'use client';

import React, { useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Loader2, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';

// App-specific print components
import { QuoteHeader } from '@/components/app/quote-header';
import { QuoteCustomerInfo } from '@/components/app/quote-customer-info';
import { QuoteItemsTable } from '@/components/app/quote-items-table';
import { QuoteFooter } from '@/components/app/quote-footer';
import { calculateItemTotals } from '@/lib/pricing';


// --- Type Definitions ---
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
    email?: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
};

type CalculatedItem = ProposalItem & {
    unitPrice: number;
    total: number;
};

// --- Helper Functions ---
const formatDate = (timestamp?: { seconds: number }) => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR');
};

const formatCurrency = (value: number, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(value);
};


// --- Main Component ---
export default function PrintQuotePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const printRef = useRef<HTMLDivElement>(null);

    const proposalId = params.id as string;
    const customerId = searchParams.get('customerId');
    
    // --- Data Fetching ---
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
    
    // --- Print Hook ---
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Teklif-${proposal?.quoteNumber || 'detay'}`,
    });

    // --- Memoized Calculations ---
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

    // --- Render Logic ---
    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center gap-4 text-center p-8">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h1 className="text-xl font-semibold">Teklif Verileri Yükleniyor...</h1>
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
                       Teklif, müşteri veya kalem bilgileri yüklenemedi.
                    </p>
                </div>
            </div>
         );
    }

    return (
        <div className="bg-gray-200">
             <div className="container mx-auto py-6 print:hidden">
                <Button onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Yazdır / PDF Olarak Kaydet
                </Button>
            </div>
            
            {/* --- PRINT AREA START --- */}
            <div ref={printRef} className="bg-white p-[15mm] screen:max-w-[210mm] screen:mx-auto screen:my-8 screen:shadow-lg">
                
                {/* 1. Header Section */}
                <QuoteHeader
                    className="print-header"
                    firmaLogo="/logo.png"
                    firmaAdi="İMS Mühendislik"
                    firmaAltBaslik="Isıtma-Soğutma ve Mekanik Tesisat Çözümleri"
                    firmaAdres="Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA"
                    firmaEmail="ims.m.muhendislik@gmail.com"
                    firmaTelefon="(553) 469 75 01"
                    teklifNo={proposal.quoteNumber}
                    tarih={formatDate(proposal.createdAt)}
                />

                <main>
                    {/* 2. Customer and Project Info Section */}
                    <QuoteCustomerInfo
                        className="print-customer-project"
                        customer={{
                            ad: customer.name,
                            adres: customer.address,
                            email: customer.email,
                            telefon: customer.phone,
                            vergiNo: customer.taxNumber,
                        }}
                        projectName={proposal.projectName}
                    />
                    
                    {/* 3. Items Section (Groups and Tables) */}
                    <section>
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
                                    className="print-table mb-6"
                                />
                            </div>
                        ))}
                    </section>

                     {/* 4. Totals and Footer Section */}
                    <footer className="pt-8 border-t-2 border-slate-300">
                        <div className="flex justify-end mb-8 print-totals">
                            <div className="w-[350px] space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-semibold">Ara Toplam:</span>
                                    <span>{formatCurrency(grandTotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">KDV (%20):</span>
                                    <span>{formatCurrency(vatAmount)}</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold pt-2 border-t mt-2">
                                    <span>Genel Toplam:</span>
                                    <span>{formatCurrency(grandTotalWithVAT)}</span>
                                </div>
                            </div>
                        </div>
                        <QuoteFooter
                            notlar={proposal.termsAndConditions?.replace(/\\n/g, '\n')}
                            kosullar={[]}
                            firmaKase="/kase.png"
                            className="print-kase text-xs"
                        />
                    </footer>
                </main>
            </div>
             {/* --- PRINT AREA END --- */}
        </div>
    );
}

    

'use client';

import React, { useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PrintDocument } from '@/components/app/print-document';
import { calculateItemTotals } from '@/lib/pricing';
import { usePrintQuote } from '@/hooks/use-print-quote';


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

// --- Main Component ---
export default function PrintQuotePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    
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
    const { printRef, handlePrint } = usePrintQuote({
        teklifNo: proposal?.quoteNumber || 'teklif',
    });

    // --- Memoized Calculations ---
    const calculatedData = useMemo(() => {
        if (!proposal || !items) {
            return null;
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
        
        return { ...proposal, items: calculatedItems, groupedItems: sortedGroups, grandTotal: subtotal, grandTotalWithVAT: totalWithVat, vatAmount: calculatedVat };
    }, [proposal, items]);


    const isLoading = isProposalLoading || areItemsLoading || isCustomerLoading;
    
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
    
    if (!calculatedData || !customer) {
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
    
    const firmaData = {
        logo: "/logo.png",
        ad: "İMS Mühendislik",
        altBaslik: "Isıtma-Soğutma ve Mekanik Tesisat Çözümleri",
        adres: "Hacı Bayram Mah. Rüzgarlı Cad. Uçar2 İşhanı No:26/46 Altındağ/ANKARA",
        email: "ims.m.muhendislik@gmail.com",
        telefon: "(553) 469 75 01",
        kase: "/kase.png"
    };

    return (
        <div className="bg-gray-200">
             <div className="container mx-auto py-6 print:hidden">
                <Button onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Yazdır / PDF Olarak Kaydet
                </Button>
            </div>
            
            <PrintDocument 
                ref={printRef}
                teklif={calculatedData as any}
                customer={customer}
                firma={firmaData}
            />
        </div>
    );
}

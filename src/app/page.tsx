'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Users, FileText, Package } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

// Define types for our Firestore documents
type Proposal = {
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
};

type Customer = {}; // We only need to count them
type Product = {};  // We only need to count them

export default function DashboardPage() {
  const firestore = useFirestore();

  // Fetch all necessary data collections
  const proposalsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'proposals') : null),
    [firestore]
  );
  const { data: proposals, isLoading: isLoadingProposals } = useCollection<Proposal>(proposalsRef);

  const customersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersRef);

  const productsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);
  
  const stats = useMemo(() => {
    const totalProposalAmount = proposals?.reduce((sum, p) => sum + (p.totalAmount || 0), 0) || 0;
    const approvedQuotesCount = proposals?.filter(p => p.status === 'Approved').length || 0;
    const customerCount = customers?.length || 0;
    const productCount = products?.length || 0;

    return {
      totalProposalAmount,
      approvedQuotesCount,
      customerCount,
      productCount,
    };
  }, [proposals, customers, products]);

  const isLoading = isLoadingProposals || isLoadingCustomers || isLoadingProducts;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Anasayfa</h1>
        <p className="text-muted-foreground">Genel bakış ve son aktiviteler.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Toplam Teklif Tutarı
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-3/4" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.totalProposalAmount)}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Tüm zamanlar
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Müşteriler</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.customerCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Toplam kayıtlı müşteri
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onaylanan Teklifler</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.approvedQuotesCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Tüm zamanlar
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Ürün</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.productCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Toplam kayıtlı ürün
            </p>
          </CardContent>
        </Card>
      </div>
       <Card>
        <CardHeader>
            <CardTitle>Son Aktiviteler</CardTitle>
            <CardDescription>Sistemdeki son hareketler.</CardDescription>
        </CardHeader>
        <CardContent>
            <p>Yakında burada son aktiviteleriniz listelenecektir.</p>
        </CardContent>
       </Card>
    </div>
  );
}

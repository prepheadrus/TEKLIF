
'use client';

import { useMemo, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Users, FileText, Package, TrendingUp, Award } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';


// --- Type Definitions ---
type Proposal = {
  id: string;
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
  customerId: string;
  customerName: string;
};

type ProposalItem = {
    productId: string;
    name: string;
    brand: string;
    quantity: number;
}

type Customer = {};
type Product = { id: string; name: string; brand: string };

type TopProduct = {
    id: string;
    name: string;
    brand: string;
    totalQuantity: number;
};

type TopCustomer = {
    customerId: string;
    customerName: string;
    totalAmount: number;
};

// --- Main Component ---
export function DashboardContent() {
  const firestore = useFirestore();
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoadingTopProducts, setIsLoadingTopProducts] = useState(true);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [isLoadingTopCustomers, setIsLoadingTopCustomers] = useState(true);

  // --- Data Fetching ---
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
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);
  
  // --- Memoized Stats Calculation ---
  const stats = useMemo(() => {
    const totalProposalAmount = proposals?.filter(p => p.status === 'Approved').reduce((sum, p) => sum + (p.totalAmount || 0), 0) || 0;
    const approvedQuotesCount = proposals?.filter(p => p.status === 'Approved').length || 0;
    const customerCount = customers?.length || 0;
    const productCount = allProducts?.length || 0;

    return {
      totalProposalAmount,
      approvedQuotesCount,
      customerCount,
      productCount,
    };
  }, [proposals, customers, allProducts]);

  // --- Top Products & Customers Calculation Effect ---
  useEffect(() => {
    if (!proposals || isLoadingProposals) {
        return;
    }
    
    // --- Top Customers Calculation ---
    const calculateTopCustomers = () => {
        setIsLoadingTopCustomers(true);
        const approvedProposals = proposals.filter(p => p.status === 'Approved');

        const customerTotals: Record<string, { name: string, total: number }> = {};

        approvedProposals.forEach(proposal => {
            if (proposal.customerId && proposal.totalAmount) {
                if (!customerTotals[proposal.customerId]) {
                    customerTotals[proposal.customerId] = { name: proposal.customerName, total: 0 };
                }
                customerTotals[proposal.customerId].total += proposal.totalAmount;
            }
        });

        const sortedCustomers = Object.entries(customerTotals)
            .map(([customerId, data]) => ({
                customerId,
                customerName: data.name,
                totalAmount: data.total,
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 3);
            
        setTopCustomers(sortedCustomers);
        setIsLoadingTopCustomers(false);
    };

    // --- Top Products Calculation ---
    const calculateTopProducts = async () => {
        if (!firestore) return;
        setIsLoadingTopProducts(true);
        const approvedProposals = proposals.filter(p => p.status === 'Approved');
        if (approvedProposals.length === 0) {
            setTopProducts([]);
            setIsLoadingTopProducts(false);
            return;
        }

        const productQuantities: Record<string, number> = {};

        for (const proposal of approvedProposals) {
            const itemsRef = collection(firestore, 'proposals', proposal.id, 'proposal_items');
            const itemsSnapshot = await getDocs(itemsRef);
            itemsSnapshot.forEach(doc => {
                const item = doc.data() as ProposalItem;
                if (item.productId && item.quantity) {
                    productQuantities[item.productId] = (productQuantities[item.productId] || 0) + item.quantity;
                }
            });
        }
        
        const sortedProductIds = Object.entries(productQuantities)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
        
        const topProductsData: TopProduct[] = sortedProductIds.map(([productId, totalQuantity]) => {
            const productDetails = allProducts?.find(p => p.id === productId);
            return {
                id: productId,
                name: productDetails?.name || 'Bilinmeyen Ürün',
                brand: productDetails?.brand || 'Bilinmeyen Marka',
                totalQuantity,
            };
        });
        
        setTopProducts(topProductsData);
        setIsLoadingTopProducts(false);
    };

    calculateTopCustomers();
    calculateTopProducts();

  }, [proposals, allProducts, firestore, isLoadingProposals]);

  const isLoading = isLoadingProposals || isLoadingCustomers || isLoadingProducts;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
  };

  const StatCard = ({ title, value, icon, description, isLoading }: { title: string, value: string, icon: React.ReactNode, description: string, isLoading: boolean }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-1" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Yönetim Paneli</h1>
        <p className="text-muted-foreground">Genel bakış ve son aktiviteler.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard
            title="Toplam Teklif Tutarı"
            value={formatCurrency(stats.totalProposalAmount)}
            description="Onaylanmış tüm teklifler"
            isLoading={isLoading}
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
         <StatCard
            title="Onaylanan Teklifler"
            value={`${stats.approvedQuotesCount}`}
            description="Toplam onaylanan teklif sayısı"
            isLoading={isLoading}
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
            title="Müşteriler"
            value={`${stats.customerCount}`}
            description="Toplam kayıtlı müşteri"
            isLoading={isLoading}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
            title="Toplam Ürün"
            value={`${stats.productCount}`}
            description="Toplam kayıtlı ürün"
            isLoading={isLoading}
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>En Çok Tercih Edilen Ürünler (Top 5)</CardTitle>
                 <CardDescription>Onaylanmış tekliflerde en çok kullanılan ürünler.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoadingTopProducts ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                ) : topProducts.length > 0 ? (
                    <div className="space-y-4">
                        {topProducts.map((product, index) => (
                        <div key={product.id} className="flex items-center">
                            <div className="w-1/2">
                            <p className="font-medium truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.brand}</p>
                            </div>
                            <div className="w-1/2 flex items-center justify-end gap-4">
                                <Badge variant="secondary" className="w-24 justify-center">
                                    {product.totalQuantity} adet
                                </Badge>
                                <Progress 
                                    value={(product.totalQuantity / topProducts[0].totalQuantity) * 100} 
                                    className="w-[100px] h-2" 
                                />
                            </div>
                        </div>
                        ))}
                    </div>
                ) : (
                    <p className="p-4 text-sm text-center text-muted-foreground">Henüz analiz edilecek onaylanmış teklif bulunmuyor.</p>
                )}
            </CardContent>
        </Card>
         <Card className="col-span-3">
            <CardHeader>
                <CardTitle>En Değerli Müşteriler</CardTitle>
                <CardDescription>Onaylanmış teklif tutarına göre en iyi müşterileriniz.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingTopCustomers ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : topCustomers.length > 0 ? (
                     <div className="space-y-4">
                        {topCustomers.map((customer, index) => (
                            <div key={customer.customerId} className="flex items-center gap-4">
                                <Avatar className="h-9 w-9">
                                    <AvatarFallback>{customer.customerName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="text-sm font-medium leading-none truncate">{customer.customerName}</p>
                                    <p className="text-sm text-muted-foreground">{formatCurrency(customer.totalAmount)}</p>
                                </div>
                                <div className="flex items-center gap-1 text-amber-500">
                                    <Award className="h-5 w-5" />
                                    <span className="font-bold text-lg">{index + 1}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="p-4 text-sm text-center text-muted-foreground">Henüz analiz edilecek onaylanmış teklif bulunmuyor.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardContentPage() {
    return <DashboardContent />;
}


'use client';

import { useMemo, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Users, FileText, Package, TrendingUp, Award, Target, CalendarDays, Coins, ShoppingCart } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { calculateItemTotals } from '@/lib/pricing';


// --- Type Definitions ---
type Proposal = {
  id: string;
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
  customerId: string;
  customerName: string;
  projectName: string;
  createdAt: Timestamp; // Changed to Timestamp for easier date comparison
  exchangeRates: { USD: number, EUR: number };
};

type ProposalItem = {
    productId: string;
    name: string;
    brand: string;
    quantity: number;
    listPrice: number;
    currency: 'TRY' | 'USD' | 'EUR';
    discountRate: number;
    profitMargin: number;
}

type Customer = {};
type Product = { id: string; name: string; brand: string };

type TopProduct = {
    id: string;
    name: string;
    brand: string;
    totalQuantity: number;
    totalRevenue: number;
};

type TopCustomer = {
    customerId: string;
    customerName: string;
    totalAmount: number;
};

// --- Helper Functions ---
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
};

const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return '-';
    return timestamp.toDate().toLocaleDateString('tr-TR');
};

const getStatusBadge = (status: Proposal['status']) => {
  switch (status) {
    case 'Approved':
      return <Badge variant="default" className="bg-green-600 hover:bg-green-600/80">Onaylandı</Badge>;
    case 'Sent':
      return <Badge variant="secondary">Gönderildi</Badge>;
    case 'Rejected':
      return <Badge variant="destructive">Reddedildi</Badge>;
    case 'Draft':
    default:
      return <Badge variant="outline">Taslak</Badge>;
  }
}

// --- Main Component ---
export function DashboardContent() {
  const firestore = useFirestore();
  const router = useRouter();

  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoadingTopProducts, setIsLoadingTopProducts] = useState(true);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [isLoadingTopCustomers, setIsLoadingTopCustomers] = useState(true);

  // --- Data Fetching ---
  const proposalsRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'proposals'), orderBy('createdAt', 'desc')) : null),
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
  const { stats, recentProposals, monthlyTarget } = useMemo(() => {
    if (!proposals) return { stats: {}, recentProposals: [], monthlyTarget: {} };
    
    // --- General Stats ---
    const approvedProposals = proposals.filter(p => p.status === 'Approved');
    const totalProposalAmount = approvedProposals.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const approvedQuotesCount = approvedProposals.length;
    const customerCount = customers?.length || 0;
    const productCount = allProducts?.length || 0;
    
    const sortedRecentProposals = proposals.slice(0, 5);
    
    // --- Monthly Target Stats ---
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const approvedThisMonth = approvedProposals.filter(p => {
        const proposalDate = p.createdAt?.toDate();
        return proposalDate && proposalDate >= startOfMonth && proposalDate <= endOfMonth;
    });
    
    const targetAmount = 6000000;
    const realizedAmount = approvedThisMonth.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const progressPercentage = (realizedAmount / targetAmount) * 100;
    const remainingAmount = targetAmount - realizedAmount;
    const daysLeft = endOfMonth.getDate() - now.getDate();

    let progressColor = 'bg-red-500'; // Default to red
    if (progressPercentage >= 80) {
      progressColor = 'bg-green-500';
    } else if (progressPercentage >= 60) {
      progressColor = 'bg-yellow-500';
    }

    return {
      stats: {
        totalProposalAmount,
        approvedQuotesCount,
        customerCount,
        productCount,
      },
      recentProposals: sortedRecentProposals,
      monthlyTarget: {
          targetAmount,
          realizedAmount,
          progressPercentage,
          remainingAmount,
          daysLeft,
          progressColor
      }
    };
  }, [proposals, customers, allProducts]);

  // --- Top Products & Customers Calculation Effect ---
  useEffect(() => {
    if (!proposals || isLoadingProposals || !firestore) {
        return;
    }
    
    const approvedProposals = proposals.filter(p => p.status === 'Approved');

    // --- Top Customers Calculation ---
    const calculateTopCustomers = () => {
        setIsLoadingTopCustomers(true);
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
        setIsLoadingTopProducts(true);
        if (approvedProposals.length === 0) {
            setTopProducts([]);
            setIsLoadingTopProducts(false);
            return;
        }

        const productStats: Record<string, { totalQuantity: number; totalRevenue: number; }> = {};

        for (const proposal of approvedProposals) {
            const itemsRef = collection(firestore, 'proposals', proposal.id, 'proposal_items');
            const itemsSnapshot = await getDocs(itemsRef);
            
            itemsSnapshot.forEach(doc => {
                const item = doc.data() as ProposalItem;
                if (item.productId && item.quantity) {
                    if (!productStats[item.productId]) {
                        productStats[item.productId] = { totalQuantity: 0, totalRevenue: 0 };
                    }
                    
                    productStats[item.productId].totalQuantity += item.quantity;
                    
                    const itemTotals = calculateItemTotals({
                        ...item,
                        exchangeRate: item.currency === 'USD' ? (proposal.exchangeRates?.USD || 1) : item.currency === 'EUR' ? (proposal.exchangeRates?.EUR || 1) : 1,
                    });
                    productStats[item.productId].totalRevenue += itemTotals.totalTlSell;
                }
            });
        }
        
        const sortedProductIds = Object.entries(productStats)
            .sort(([, a], [, b]) => b.totalQuantity - a.totalQuantity)
            .slice(0, 6); // Get top 6
        
        const topProductsData: TopProduct[] = sortedProductIds.map(([productId, stats]) => {
            const productDetails = allProducts?.find(p => p.id === productId);
            return {
                id: productId,
                name: productDetails?.name || 'Bilinmeyen Ürün',
                brand: productDetails?.brand || 'Bilinmeyen Marka',
                totalQuantity: stats.totalQuantity,
                totalRevenue: stats.totalRevenue
            };
        });
        
        setTopProducts(topProductsData);
        setIsLoadingTopProducts(false);
    };

    calculateTopCustomers();
    calculateTopProducts();

  }, [proposals, allProducts, firestore, isLoadingProposals]);

  const isLoading = isLoadingProposals || isLoadingCustomers || isLoadingProducts;

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle>Aylık Hedef Durumu</CardTitle>
                <CardDescription>{new Date().toLocaleString('tr-TR', { month: 'long' })} ayı hedef ilerlemesi</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-24 w-full" />
                ) : (
                    <>
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-lg font-bold text-green-600">{formatCurrency(monthlyTarget.realizedAmount || 0)}</span>
                                <span className="text-sm text-muted-foreground">Hedef: {formatCurrency(monthlyTarget.targetAmount || 0)}</span>
                            </div>
                            <Progress value={monthlyTarget.progressPercentage || 0} indicatorClassName={monthlyTarget.progressColor} />
                            <div className="flex justify-between items-center mt-2 text-sm font-medium">
                                <span>%{monthlyTarget.progressPercentage?.toFixed(1) || '0.0'}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-sm text-muted-foreground">Kalan Tutar</p>
                                <p className="text-lg font-bold">{formatCurrency(monthlyTarget.remainingAmount || 0)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Kalan Gün</p>
                                <p className="text-lg font-bold">{monthlyTarget.daysLeft} gün</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Gerçekleşme</p>
                                <p className="text-lg font-bold">%{monthlyTarget.progressPercentage?.toFixed(1) || '0.0'}</p>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
        <StatCard
            title="Toplam Teklif Tutarı"
            value={formatCurrency(stats.totalProposalAmount || 0)}
            description="Onaylanmış tüm teklifler"
            isLoading={isLoading}
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
         <StatCard
            title="Onaylanan Teklifler"
            value={`${stats.approvedQuotesCount || 0}`}
            description="Toplam onaylanan teklif sayısı"
            isLoading={isLoading}
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
            title="Müşteriler"
            value={`${stats.customerCount || 0}`}
            description="Toplam kayıtlı müşteri"
            isLoading={isLoading}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
            title="Toplam Ürün"
            value={`${stats.productCount || 0}`}
            description="Toplam kayıtlı ürün"
            isLoading={isLoading}
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
            <CardHeader className="p-0 mb-4">
                <CardTitle>En Çok Tercih Edilen Ürünler</CardTitle>
                <CardDescription>Onaylanmış tekliflerde en çok kullanılan ürünler.</CardDescription>
            </CardHeader>
            {isLoadingTopProducts ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
                </div>
            ) : topProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {topProducts.map(product => (
                        <Card key={product.id}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base truncate" title={product.name}>{product.name}</CardTitle>
                                <CardDescription>{product.brand}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-sm text-muted-foreground">Satış Adedi</span>
                                    <span className="font-bold text-lg">{product.totalQuantity}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-sm text-muted-foreground">Toplam Gelir</span>
                                    <span className="font-bold text-lg text-green-600">{formatCurrency(product.totalRevenue)}</span>
                                </div>
                                <Button variant="outline" size="sm" className="mt-2">Detay</Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Analiz edilecek ürün verisi bulunamadı.</CardContent></Card>
            )}
        </div>
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
      <Card>
        <CardHeader>
            <CardTitle>Son Aktiviteler</CardTitle>
            <CardDescription>En son oluşturulan veya güncellenen teklifler.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoadingProposals ? (
                 <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            ) : recentProposals.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Müşteri</TableHead>
                            <TableHead>Proje</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Tarih</TableHead>
                            <TableHead className="text-right">Tutar</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recentProposals.map(p => (
                            <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/quotes/${p.id}`)}>
                                <TableCell>
                                    <div className="font-medium">{p.customerName}</div>
                                </TableCell>
                                <TableCell>{p.projectName}</TableCell>
                                <TableCell>{getStatusBadge(p.status)}</TableCell>
                                <TableCell>{formatDate(p.createdAt)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(p.totalAmount)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="text-center text-muted-foreground p-8">
                    Henüz hiç teklif oluşturulmamış.
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardContentPage() {
    return <DashboardContent />;
}

    
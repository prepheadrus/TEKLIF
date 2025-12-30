
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useDoc, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Mail, Phone, MapPin, FileText, DollarSign, CheckSquare, TrendingUp, Copy } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { QuickAddCustomer } from '@/components/app/quick-add-customer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { availableTags, getTagClassName } from '@/lib/tags';
import { cn } from '@/lib/utils';
import { getStatusBadge } from '@/app/quotes/quotes-client-page'; // Re-use from quotes page
import type { Proposal } from '@/app/quotes/quotes-client-page'; // Re-use from quotes page

// --- Type Definitions ---
type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: {
    city?: string;
    district?: string;
    neighborhood?: string;
    street?: string;
    buildingName?: string;
    buildingNumber?: string;
    apartmentNumber?: string;
    postalCode?: string;
  };
  taxNumber?: string;
  status: 'Aktif' | 'Pasif';
  tags?: string[];
};

const StatCard = ({ title, value, icon, isLoading }: { title: string, value: string | number, icon: React.ReactNode, isLoading: boolean }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="h-8 w-1/2 bg-gray-200 animate-pulse rounded-md" /> : <div className="text-2xl font-bold">{value}</div>}
      </CardContent>
    </Card>
);

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
};
const formatDate = (timestamp?: { seconds: number } | Timestamp) => {
    if (!timestamp) return '-';
    if (timestamp instanceof Timestamp) {
        return timestamp.toDate().toLocaleDateString('tr-TR');
    }
    return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR');
};


export function CustomerDetailClientPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const customerId = params.id as string;

  // --- Data Fetching ---
  const customerRef = useMemoFirebase(
    () => (firestore && customerId ? doc(firestore, 'customers', customerId) : null),
    [firestore, customerId]
  );
  const { data: customer, isLoading: isCustomerLoading, error } = useDoc<Customer>(customerRef);
  
  const proposalsQuery = useMemoFirebase(
    () => (firestore && customerId ? query(collection(firestore, 'proposals'), where('customerId', '==', customerId), orderBy('createdAt', 'desc')) : null),
    [firestore, customerId]
  );
  const { data: proposals, isLoading: areProposalsLoading } = useCollection<Proposal>(proposalsQuery);
  
  // --- Memoized Calculations ---
  const { stats, proposalGroups } = useMemo(() => {
    if (!proposals) return { stats: {}, proposalGroups: [] };
    
    const approvedProposals = proposals.filter(p => p.status === 'Approved');
    const totalSpending = approvedProposals.reduce((sum, p) => sum + p.totalAmount, 0);

    const groups: Record<string, Proposal[]> = {};
    proposals.forEach(p => {
        if (!groups[p.rootProposalId]) {
            groups[p.rootProposalId] = [];
        }
        groups[p.rootProposalId].push(p);
    });

    const sortedGroups = Object.values(groups).map(versions => {
        versions.sort((a,b) => (b.version || 0) - (a.version || 0));
        return versions;
    }).sort((a,b) => (b[0].createdAt?.seconds || 0) - (a[0].createdAt?.seconds || 0));

    return {
        stats: {
            totalSpending,
            totalProposals: proposals.length,
            approvedProposalsCount: approvedProposals.length,
        },
        proposalGroups: sortedGroups
    };

  }, [proposals]);

  const fullAddress = useMemo(() => {
    if (!customer?.address) return 'Adres bilgisi yok';
    const { street, neighborhood, buildingName, buildingNumber, apartmentNumber, district, city, postalCode } = customer.address;
    const parts = [street, neighborhood, buildingName, `${buildingNumber || ''}${apartmentNumber ? '/' + apartmentNumber : ''}`, `${district || ''} / ${city || ''}`, postalCode];
    return parts.filter(Boolean).join(', ');
  }, [customer]);
  
  const isLoading = isCustomerLoading || areProposalsLoading;

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-4">Müşteri detayları yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-8">Hata: {error.message}</div>;
  }

  if (!customer) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Müşteri Bulunamadı</h1>
        <p className="text-muted-foreground">Aradığınız müşteri mevcut değil veya silinmiş olabilir.</p>
        <Button onClick={() => router.push('/customers')}>
          <ArrowLeft className="mr-2" /> Müşteri Listesine Geri Dön
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
       <header className="flex-shrink-0 bg-background/95 backdrop-blur-sm border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/customers')}>
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">
                Müşteri Detay Merkezi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/quotes?customer=${customer.id}`)} disabled>
              <FileText className="mr-2 h-4 w-4"/> Yeni Teklif Oluştur
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle>Müşteri Kartı</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground"/>
                        <a href={`mailto:${customer.email}`} className="text-primary hover:underline">{customer.email || 'E-posta yok'}</a>
                    </div>
                     <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground"/>
                        <span>{customer.phone || 'Telefon yok'}</span>
                    </div>
                     <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5"/>
                        <span>{fullAddress}</span>
                    </div>
                    <Separator/>
                    <div className="flex flex-wrap gap-2">
                         <Badge variant={customer.status === 'Aktif' ? 'secondary' : 'outline'} className={customer.status === 'Aktif' ? 'bg-green-100 text-green-800' : ''}>
                           {customer.status}
                         </Badge>
                        {customer.tags?.map(tagId => {
                            const tagInfo = availableTags.find(t => t.id === tagId);
                            if (!tagInfo) return null;
                            return (
                                <Badge key={tagId} className={cn("text-xs", getTagClassName(tagInfo.color))}>
                                    {tagInfo.name}
                                </Badge>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Toplam Harcama" value={formatCurrency(stats.totalSpending || 0)} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
                <StatCard title="Onaylanan Teklifler" value={stats.approvedProposalsCount || 0} icon={<CheckSquare className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
                <StatCard title="Toplam Teklif Sayısı" value={stats.totalProposals || 0} icon={<FileText className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
            </div>
        </section>

        <Card>
            <CardHeader>
                <CardTitle>Teklif Geçmişi</CardTitle>
                <CardDescription>Bu müşteriye ait tüm teklifler ve revizyonları.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Teklif No</TableHead>
                            <TableHead>Versiyon</TableHead>
                            <TableHead>Proje Adı</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Tarih</TableHead>
                            <TableHead className="text-right">Tutar</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={6} className="p-2"><div className="h-8 bg-gray-200 animate-pulse rounded-md"/></TableCell></TableRow>)
                        ) : proposalGroups.length > 0 ? (
                            proposalGroups.flatMap(group => 
                                group.map((proposal, index) => (
                                    <TableRow 
                                        key={proposal.id} 
                                        onClick={() => router.push(`/quotes/${proposal.id}`)}
                                        className={cn("cursor-pointer", index > 0 && "bg-slate-50 dark:bg-slate-800/50", index === 0 && "border-t-2 border-slate-300 dark:border-slate-700")}
                                    >
                                        <TableCell className={cn("font-medium", index > 0 && "pl-12")}>
                                            {index === 0 ? proposal.quoteNumber : ''}
                                        </TableCell>
                                        <TableCell><Badge variant="secondary">v{proposal.version}</Badge></TableCell>
                                        <TableCell>{proposal.projectName}</TableCell>
                                        <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                                        <TableCell>{formatDate(proposal.createdAt)}</TableCell>
                                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(proposal.totalAmount)}</TableCell>
                                    </TableRow>
                                ))
                            )
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Bu müşteri için henüz teklif oluşturulmamış.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

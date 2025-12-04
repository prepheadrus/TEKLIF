
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDoc, collection, doc, serverTimestamp, getDocs, query, orderBy, where, writeBatch, setDoc, updateDoc } from 'firebase/firestore';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusCircle, MoreHorizontal, Copy, Trash2, Loader2, Search, ChevronDown, Eye, AlertTriangle, FileText, DollarSign, Calculator, CheckSquare, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { fetchExchangeRates } from '@/ai/flows/fetch-exchange-rates';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';


const newQuoteSchema = z.object({
  customerId: z.string().min(1, 'Müşteri seçimi zorunludur.'),
  projectName: z.string().min(2, 'Proje adı en az 2 karakter olmalıdır.'),
});

type NewQuoteFormValues = z.infer<typeof newQuoteSchema>;

type Customer = {
  id: string;
  name: string;
};

type Proposal = {
    id: string;
    quoteNumber: string;
    customerName: string;
    projectName: string;
    totalAmount: number;
    status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
    createdAt: { seconds: number } | null;
    version: number;
    rootProposalId: string;
    customerId: string;
    exchangeRates: { USD: number, EUR: number };
    versionNote: string;
};

type ProposalGroup = {
    rootProposalId: string;
    latestProposal: Proposal;
    versions: Proposal[];
}

function getStatusBadge(status: Proposal['status']) {
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

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
};

const formatDate = (timestamp: { seconds: number } | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR');
};


const statusFilterOptions: { label: string; value: Proposal['status'] | 'All' }[] = [
    { label: 'Tümü', value: 'All' },
    { label: 'Taslak', value: 'Draft' },
    { label: 'Gönderildi', value: 'Sent' },
    { label: 'Onaylandı', value: 'Approved' },
    { label: 'Reddedildi', value: 'Rejected' },
];

const dateFilterOptions: { label: string; value: 'all' | 'last30days' | 'last90days' }[] = [
    { label: 'Tümü', value: 'all' },
    { label: 'Son 30 Gün', value: 'last30days' },
    { label: 'Son 90 Gün', value: 'last90days' },
];

const statusOptions: { label: string; value: Proposal['status'] }[] = [
    { label: 'Taslak', value: 'Draft' },
    { label: 'Gönderildi', value: 'Sent' },
    { label: 'Onaylandı', value: 'Approved' },
    { label: 'Reddedildi', value: 'Rejected' },
];

const StatCard = ({ title, value, icon, isLoading }: { title: string, value: string, icon: React.ReactNode, isLoading: boolean }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
);


export default function QuotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRevising, setIsRevising] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Proposal['status'] | 'All'>('All');
  const [dateFilter, setDateFilter] = useState<'all' | 'last30days' | 'last90days'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());


  const form = useForm<NewQuoteFormValues>({
    resolver: zodResolver(newQuoteSchema),
    defaultValues: {
      customerId: '',
      projectName: '',
    },
  });

  const proposalsRef = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'proposals')) : null),
      [firestore]
  );
  const { data: proposals, isLoading: isLoadingProposals, refetch: refetchProposals } = useCollection<Proposal>(proposalsRef);
  
  const customersRef = useMemoFirebase(() => (firestore ? collection(firestore, 'customers') : null), [firestore]);
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersRef);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, dateFilter, searchTerm, sortOrder]);


  const groupedProposals = useMemo((): ProposalGroup[] => {
    if (!proposals) return [];

    const groups: Record<string, Proposal[]> = {};
    
    proposals.forEach(p => {
        if (!p.rootProposalId) return;
        if (!groups[p.rootProposalId]) {
            groups[p.rootProposalId] = [];
        }
        groups[p.rootProposalId].push(p);
    });

    return Object.values(groups).map(versions => {
        versions.sort((a, b) => (b.version || 0) - (a.version || 0));
        return {
            rootProposalId: versions[0].rootProposalId,
            latestProposal: versions[0],
            versions: versions
        };
    }).sort((a, b) => {
        const timeA = a.latestProposal.createdAt?.seconds ?? 0;
        const timeB = b.latestProposal.createdAt?.seconds ?? 0;
        
        if (timeA === 0 && timeB !== 0) return 1;
        if (timeB === 0 && timeA !== 0) return -1;
        
        if (sortOrder === 'newest') {
          return timeB - timeA;
        } else {
          return timeA - timeB;
        }
    });
}, [proposals, sortOrder]);
  
  const flatFilteredProposals = useMemo(() => {
    if (!proposals) return [];
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime();
    const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90).getTime();

    return proposals.filter(p => {
        const searchMatch = 
            p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase());
        if (!searchMatch) return false;

        if (dateFilter !== 'all' && p.createdAt) {
            const proposalDate = p.createdAt.seconds * 1000;
            if (dateFilter === 'last30days' && proposalDate < thirtyDaysAgo) return false;
            if (dateFilter === 'last90days' && proposalDate < ninetyDaysAgo) return false;
        }
        
        if (statusFilter !== 'All') {
          return p.status === statusFilter;
        }

        return true;
    }).sort((a, b) => {
        const timeA = a.createdAt?.seconds ?? 0;
        const timeB = b.createdAt?.seconds ?? 0;
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [proposals, searchTerm, statusFilter, dateFilter, sortOrder]);


  const filteredProposalGroups = useMemo(() => {
    if (statusFilter !== 'All') {
        return []; // Don't use grouped view when a specific status is filtered
    }
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime();
    const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90).getTime();

    return groupedProposals.filter(g => {
      const searchMatch = 
          g.latestProposal.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          g.latestProposal.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          g.latestProposal.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase());
      if (!searchMatch) return false;

      if (dateFilter !== 'all' && g.latestProposal.createdAt) {
          const proposalDate = g.latestProposal.createdAt.seconds * 1000;
          if (dateFilter === 'last30days' && proposalDate < thirtyDaysAgo) return false;
          if (dateFilter === 'last90days' && proposalDate < ninetyDaysAgo) return false;
      }
      
      return true;
    });
  }, [groupedProposals, searchTerm, statusFilter, dateFilter]);
  

  const filteredStats = useMemo(() => {
    const listToProcess = statusFilter === 'All' 
        ? filteredProposalGroups.map(g => g.latestProposal) 
        : flatFilteredProposals;

    const count = listToProcess.length;
    const totalAmount = listToProcess.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const averageAmount = count > 0 ? totalAmount / count : 0;

    return {
      count,
      totalAmount,
      averageAmount,
    };
  }, [filteredProposalGroups, flatFilteredProposals, statusFilter]);

  const handleCreateNewQuote = async (values: NewQuoteFormValues) => {
    if (!firestore) {
        toast({ variant: "destructive", title: "Hata", description: "Veritabanı bağlantısı kurulamadı." });
        return;
    }
    setIsSubmitting(true);
    try {
        const selectedCustomer = customers?.find(c => c.id === values.customerId);
        if (!selectedCustomer) throw new Error("Müşteri bulunamadı.");

        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const year = now.getFullYear().toString().slice(-2);

        const proposalsInMonthQuery = query(
            collection(firestore, 'proposals'),
            where('quoteNumber', '>=', `${month}${year}/001`),
            where('quoteNumber', '<', `${month}${year}/999`)
        );
        const monthProposalsSnap = await getDocs(proposalsInMonthQuery);
        const nextId = (monthProposalsSnap.size + 1).toString().padStart(3, '0');
        const quoteNumber = `${month}${year}/${nextId}`;

        const exchangeRates = await fetchExchangeRates();
        const newProposalRef = doc(collection(firestore, 'proposals'));
        
        const newProposalData = {
            rootProposalId: newProposalRef.id,
            version: 1,
            customerId: values.customerId,
            customerName: selectedCustomer.name,
            projectName: values.projectName,
            quoteNumber: quoteNumber,
            totalAmount: 0,
            status: 'Draft' as const,
            createdAt: serverTimestamp(),
            exchangeRates: exchangeRates,
            versionNote: "İlk Versiyon"
        };
        
        await setDoc(newProposalRef, newProposalData);

        toast({ title: "Başarılı!", description: "Yeni teklif taslağı oluşturuldu." });
        setIsDialogOpen(false);
        form.reset();
        router.push(`/quotes/${newProposalRef.id}`);

    } catch (error: any) {
        console.error("Teklif oluşturma hatası:", error);
        toast({ variant: "destructive", title: "Hata", description: `Teklif oluşturulamadı: ${error.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };
  
 const handleDuplicateProposal = async (proposalToClone: Proposal) => {
    if (!firestore) return;
    setIsRevising(proposalToClone.rootProposalId);
    toast({ title: 'Revizyon oluşturuluyor...' });

    try {
        const versionsQuery = query(
            collection(firestore, 'proposals'),
            where('rootProposalId', '==', proposalToClone.rootProposalId)
        );
        const versionsSnap = await getDocs(versionsQuery);
        const latestVersionNumber = versionsSnap.size > 0 ? versionsSnap.docs.map(doc => doc.data().version).reduce((a, b) => Math.max(a, b)) : 0;


        const newProposalRef = doc(collection(firestore, 'proposals'));
        const newRates = await fetchExchangeRates();

        const { id, ...originalData } = proposalToClone;

        const newProposalData = {
            ...originalData,
            version: latestVersionNumber + 1,
            status: 'Draft' as const,
            createdAt: serverTimestamp(),
            versionNote: `Revizyon (v${proposalToClone.version}'dan kopyalandı)`,
            exchangeRates: newRates,
        };
        
        const batch = writeBatch(firestore);
        batch.set(newProposalRef, newProposalData);

        const itemsRef = collection(firestore, 'proposals', proposalToClone.id, 'proposal_items');
        const itemsSnap = await getDocs(itemsRef);
        itemsSnap.forEach(itemDoc => {
            const newItemRef = doc(collection(firestore, 'proposals', newProposalRef.id, 'proposal_items'));
            batch.set(newItemRef, itemDoc.data());
        });

        await batch.commit();

        toast({ title: "Başarılı!", description: `Teklif revize edildi. Yeni versiyon: v${latestVersionNumber + 1}` });
        router.push(`/quotes/${newProposalRef.id}`);

    } catch (error: any) {
        console.error("Teklif revizyon hatası:", error);
        toast({ variant: "destructive", title: "Hata", description: `Revizyon oluşturulamadı: ${error.message}` });
    } finally {
        setIsRevising(null);
    }
}
  
  const handleDeleteProposal = async (idToDelete: string, rootId: string, isGroupDelete: boolean) => {
    if (!firestore) return;
    try {
        const batch = writeBatch(firestore);
        let idsToDelete: string[] = [];

        if (isGroupDelete) {
            const versionsQuery = query(collection(firestore, 'proposals'), where('rootProposalId', '==', rootId));
            const versionsSnap = await getDocs(versionsQuery);
            versionsSnap.forEach(doc => idsToDelete.push(doc.id));
        } else {
            idsToDelete.push(idToDelete);
        }

        for (const id of idsToDelete) {
            const docRef = doc(firestore, 'proposals', id);
            batch.delete(docRef);
            
            const itemsRef = collection(firestore, 'proposals', id, 'proposal_items');
            const itemsSnap = await getDocs(itemsRef);
            itemsSnap.forEach(itemDoc => batch.delete(itemDoc.ref));
        }

        await batch.commit();
        toast({ title: "Başarılı", description: "Teklif ve ilgili kalemler silindi." });
        refetchProposals();
    } catch (error: any) {
        console.error("Teklif silme hatası:", error);
        toast({ variant: "destructive", title: "Hata", description: `Teklif silinemedi: ${error.message}` });
    }
  };

  const handleStatusChange = async (proposalId: string, newStatus: Proposal['status']) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'proposals', proposalId);
    try {
        await updateDoc(docRef, { status: newStatus });
        toast({ title: "Başarılı", description: "Teklif durumu güncellendi." });
        refetchProposals();
    } catch (error: any) {
        console.error("Durum güncelleme hatası:", error);
        toast({ variant: "destructive", title: "Hata", description: `Durum güncellenemedi: ${error.message}` });
    }
  };
  
    const handleBulkStatusChange = async (newStatus: Proposal['status']) => {
        if (!firestore || selectedIds.size === 0) return;
        
        toast({title: 'Güncelleniyor...', description: `${selectedIds.size} teklifin durumu değiştiriliyor.`});

        try {
            const batch = writeBatch(firestore);
            selectedIds.forEach(id => {
                const docRef = doc(firestore, 'proposals', id);
                batch.update(docRef, { status: newStatus });
            });
            await batch.commit();
            toast({title: 'Başarılı!', description: 'Teklif durumları güncellendi.'});
            setSelectedIds(new Set());
            refetchProposals();
        } catch (error: any) {
            toast({variant: 'destructive', title: 'Hata', description: `Durumlar güncellenemedi: ${error.message}`});
        }
    };

    const handleBulkDelete = async () => {
        if (!firestore || selectedIds.size === 0) return;

        toast({title: 'Siliniyor...', description: `${selectedIds.size} teklif siliniyor.`});

        try {
            const batch = writeBatch(firestore);
            // Need to fetch rootProposalId for each selected item to potentially delete sub-items
            for (const id of selectedIds) {
                const docRef = doc(firestore, 'proposals', id);
                batch.delete(docRef);

                const itemsRef = collection(firestore, 'proposals', id, 'proposal_items');
                const itemsSnap = await getDocs(itemsRef);
                itemsSnap.forEach(itemDoc => batch.delete(itemDoc.ref));
            }
            await batch.commit();

            toast({title: 'Başarılı!', description: 'Seçili teklifler ve kalemleri silindi.'});
            setSelectedIds(new Set());
            refetchProposals();

        } catch (error: any) {
            toast({variant: 'destructive', title: 'Hata', description: `Teklifler silinemedi: ${error.message}`});
        }
    };

    const toggleAllSelection = (isChecked: boolean) => {
        const newSelectedIds = new Set<string>();
        if (isChecked) {
            const itemsToSelect = statusFilter === 'All' ? filteredProposalGroups.map(g => g.latestProposal.id) : flatFilteredProposals.map(p => p.id);
            itemsToSelect.forEach(id => newSelectedIds.add(id));
        }
        setSelectedIds(newSelectedIds);
    };

    const toggleSelection = (id: string, isChecked: boolean) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    };

    const currentList = statusFilter === 'All' ? filteredProposalGroups.map(g => g.latestProposal) : flatFilteredProposals;
    const allVisibleSelected = currentList.length > 0 && selectedIds.size === currentList.length;
    const someVisibleSelected = selectedIds.size > 0 && selectedIds.size < currentList.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teklif Arşivi</h2>
          <p className="text-muted-foreground">
            Mevcut tekliflerinizi yönetin ve yeni teklifler oluşturun.
          </p>
        </div>
        <div className="flex items-center space-x-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Yeni Teklif Oluştur
                </Button>
              </DialogTrigger>
              <DialogContent>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateNewQuote)} className="space-y-4">
                        <DialogHeader>
                          <DialogTitle>Yeni Teklif Başlat</DialogTitle>
                          <DialogDescription>
                            Yeni bir teklif oluşturmak için müşteri ve proje adı seçin. Güncel döviz kurları otomatik olarak çekilecektir.
                          </DialogDescription>
                        </DialogHeader>

                        <FormField
                            control={form.control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Müşteri</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger disabled={isLoadingCustomers}>
                                        <SelectValue placeholder={isLoadingCustomers ? "Müşteriler yükleniyor..." : "Bir müşteri seçin"} />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {customers?.map((customer) => (
                                        <SelectItem key={customer.id} value={customer.id}>
                                            {customer.name}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="projectName"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Proje Adı</FormLabel>
                                <FormControl>
                                    <Input placeholder="Örn: Villa Mekanik Tesisat" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">İptal</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Teklifi Oluştur
                            </Button>
                        </DialogFooter>
                    </form>
                 </Form>
              </DialogContent>
            </Dialog>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
          <StatCard 
              title="Teklif Sayısı" 
              value={`${filteredStats.count} Adet`}
              isLoading={isLoadingProposals}
              icon={<FileText className="h-4 w-4 text-muted-foreground" />} 
          />
           <StatCard 
              title="Toplam Tutar" 
              value={formatCurrency(filteredStats.totalAmount)}
              isLoading={isLoadingProposals}
              icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} 
          />
           <StatCard 
              title="Ortalama Tutar" 
              value={formatCurrency(filteredStats.averageAmount)}
              isLoading={isLoadingProposals}
              icon={<Calculator className="h-4 w-4 text-muted-foreground" />} 
          />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtreler ve Arama</CardTitle>
           <div className="pt-4 space-y-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Müşteri, proje veya teklif no ara..." 
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Durum:</span>
                      {statusFilterOptions.map(option => (
                          <Button 
                              key={option.value}
                              variant={statusFilter === option.value ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => setStatusFilter(option.value)}
                          >
                              {option.label}
                          </Button>
                      ))}
                      <Separator orientation="vertical" className="h-6 mx-2"/>
                      <span className="text-sm font-medium text-muted-foreground">Tarih:</span>
                       {dateFilterOptions.map(option => (
                          <Button 
                              key={option.value}
                              variant={dateFilter === option.value ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => setDateFilter(option.value)}
                          >
                              {option.label}
                          </Button>
                      ))}
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Sıralama:</span>
                       <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Sırala" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">En Yeni</SelectItem>
                                <SelectItem value="oldest">En Eski</SelectItem>
                            </SelectContent>
                        </Select>
                  </div>
                </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
             {selectedIds.size > 0 && (
                <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-primary">
                        {selectedIds.size} teklif seçildi.
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <CheckSquare className="mr-2 h-4 w-4" />
                                    Durum Değiştir
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {statusOptions.map(opt => (
                                    <DropdownMenuItem key={opt.value} onClick={() => handleBulkStatusChange(opt.value)}>
                                        {opt.label} olarak ayarla
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="destructive" size="sm">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Seçilenleri Sil
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Bu işlem geri alınamaz. Seçilen {selectedIds.size} teklifi ve tüm revizyonlarını kalıcı olarak silecektir.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                                        Evet, Sil
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>


                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedIds(new Set())}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
            <div className="space-y-2">
                {isLoadingProposals ? (
                     <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin" />
                     </div>
                ) : statusFilter === 'All' ? (
                    // -------- GROUPED VIEW --------
                    filteredProposalGroups.length > 0 ? (
                        filteredProposalGroups.map((group) => (
                            <Collapsible key={group.rootProposalId} asChild>
                                <Card className="rounded-none shadow-none border-x-0 border-t-0 last:border-b-0">
                                    <div className="flex items-center p-3">
                                         <div className="px-2">
                                            <Checkbox
                                                checked={selectedIds.has(group.latestProposal.id)}
                                                onCheckedChange={(checked) => toggleSelection(group.latestProposal.id, !!checked)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-6 gap-4 flex-1 items-center">
                                            <div className="font-semibold">{group.latestProposal.quoteNumber}</div>
                                            <div className="col-span-2 text-muted-foreground">{group.latestProposal.customerName}</div>
                                            <div className="col-span-2 font-medium">{group.latestProposal.projectName}</div>
                                            <div className="font-semibold text-right">{formatCurrency(group.latestProposal.totalAmount)}</div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-6">
                                            {getStatusBadge(group.latestProposal.status)}
                                            <Badge variant="secondary">
                                                <Copy className="mr-2 h-3 w-3"/>
                                                {group.versions.length} Revizyon
                                            </Badge>
                                            <Button variant="outline" size="sm" onClick={() => router.push(`/quotes/${group.latestProposal.id}`)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Görüntüle
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={isRevising === group.rootProposalId}>
                                                        {isRevising === group.rootProposalId ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleDuplicateProposal(group.latestProposal)} disabled={isRevising === group.rootProposalId}>
                                                        <Copy className="mr-2 h-4 w-4" />
                                                        Yeni Revizyon Oluştur
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:bg-red-100 focus:text-red-700">
                                                                <AlertTriangle className="mr-2 h-4 w-4" />
                                                                Teklif Grubunu Sil
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Tüm Teklif Grubunu Silmek Üzeresiniz!</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Bu işlem geri alınamaz. "{group.latestProposal.projectName}" projesine ait <strong>tüm {group.versions.length} versiyon</strong> kalıcı olarak silinecektir. Emin misiniz?
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteProposal(group.latestProposal.id, group.rootProposalId, true)} className="bg-destructive hover:bg-destructive/90">
                                                                    Evet, Hepsini Sil
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                                </Button>
                                            </CollapsibleTrigger>
                                        </div>
                                    </div>
                                    <CollapsibleContent>
                                        <div className="bg-slate-50 border-t p-2">
                                             <Table size="sm">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="py-1">Versiyon</TableHead>
                                                        <TableHead className="py-1">Tutar</TableHead>
                                                        <TableHead className="py-1">Durum</TableHead>
                                                        <TableHead className="py-1">Tarih</TableHead>
                                                        <TableHead className="w-[40%] py-1">Not</TableHead>
                                                        <TableHead className="text-right py-1">İşlemler</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.versions.map(v => (
                                                        <TableRow key={v.id} className={cn("h-auto", v.id === group.latestProposal.id && "bg-blue-50/50")}>
                                                            <TableCell className="py-1.5"><Badge variant={v.id === group.latestProposal.id ? "default" : "secondary"}>v{v.version}</Badge></TableCell>
                                                            <TableCell className="py-1.5">{formatCurrency(v.totalAmount)}</TableCell>
                                                            <TableCell className="py-1.5">
                                                                <Select onValueChange={(newStatus: Proposal['status']) => handleStatusChange(v.id, newStatus)} defaultValue={v.status}>
                                                                    <SelectTrigger className={cn("h-auto w-[120px] border-0 bg-transparent focus:ring-0", 
                                                                        v.status === 'Approved' && 'text-green-700',
                                                                        v.status === 'Rejected' && 'text-red-700',
                                                                        v.status === 'Sent' && 'text-blue-700',
                                                                        )}>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {statusOptions.map(opt => (
                                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                                {opt.label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            <TableCell className="py-1.5">{formatDate(v.createdAt)}</TableCell>
                                                            <TableCell className="text-muted-foreground text-xs py-1.5">{v.versionNote}</TableCell>
                                                            <TableCell className="text-right py-1.5">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <Button variant="ghost" size="sm" onClick={() => router.push(`/quotes/${v.id}`)}>Görüntüle</Button>
                                                                    <Button variant="ghost" size="sm" onClick={() => router.push(`/quotes/${v.id}/print?customerId=${v.customerId}`)}>Yazdır</Button>
                                                                    <Button variant="outline" size="sm" onClick={() => handleDuplicateProposal(v)} disabled={isRevising === group.rootProposalId}><Copy className="mr-2 h-3 w-3"/>Revize Et</Button>
                                                                    
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="destructive" size="sm" disabled={group.versions.length <= 1}>
                                                                                <Trash2 className="mr-2 h-3 w-3" /> Sil
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle>v{v.version} Versiyonunu Silmek İstediğinize Emin misiniz?</AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    Bu işlem geri alınamaz. Bu teklif versiyonu kalıcı olarak silinecektir.
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleDeleteProposal(v.id, group.rootProposalId, false)} className="bg-destructive hover:bg-destructive/90">
                                                                                    Evet, Sil
                                                                                </AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>

                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        ))
                    ) : (
                        <div className="text-center text-muted-foreground p-12">
                           Henüz teklif bulunmuyor veya aramanızla eşleşen sonuç yok.
                        </div>
                    )
                ) : (
                    // -------- FLAT LIST VIEW --------
                    <Table>
                        <TableHeader>
                            <TableRow>
                                 <TableHead className="w-12">
                                     <Checkbox
                                        checked={allVisibleSelected}
                                        onCheckedChange={toggleAllSelection}
                                        aria-label="Tümünü seç"
                                        data-state={someVisibleSelected ? 'indeterminate' : (allVisibleSelected ? 'checked' : 'unchecked')}
                                     />
                                 </TableHead>
                                <TableHead>Teklif No</TableHead>
                                <TableHead>Müşteri</TableHead>
                                <TableHead>Proje</TableHead>
                                <TableHead>Versiyon</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">Tutar</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {flatFilteredProposals.length > 0 ? (
                            flatFilteredProposals.map(v => (
                                <TableRow key={v.id} data-state={selectedIds.has(v.id) ? 'selected' : undefined}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(v.id)}
                                            onCheckedChange={(checked) => toggleSelection(v.id, !!checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{v.quoteNumber}</TableCell>
                                    <TableCell className="text-muted-foreground">{v.customerName}</TableCell>
                                    <TableCell>{v.projectName}</TableCell>
                                    <TableCell><Badge variant="secondary">v{v.version}</Badge></TableCell>
                                    <TableCell>{getStatusBadge(v.status)}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(v.totalAmount)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="outline" size="sm" onClick={() => router.push(`/quotes/${v.id}`)}>
                                                <Eye className="mr-2 h-4 w-4" /> Görüntüle
                                            </Button>
                                            <Button variant="secondary" size="sm" onClick={() => handleDuplicateProposal(v)} disabled={isRevising === v.rootProposalId}>
                                                <Copy className="mr-2 h-3 w-3"/> Revize Et
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground p-12">
                                    Bu filtrelerle eşleşen teklif bulunamadı.
                                </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

    
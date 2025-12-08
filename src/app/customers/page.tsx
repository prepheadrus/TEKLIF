
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  where,
  Timestamp,
  updateDoc,
  doc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
  PlusCircle,
  Loader2,
  Search,
  ArrowUpDown,
  ChevronDown,
  Tag,
  Users,
  DollarSign,
  TrendingUp,
  BarChart,
  Award,
  MoreHorizontal,
  Edit,
  Trash2,
  FilePlus,
  Mail,
  CheckSquare,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QuickAddCustomer } from '@/components/app/quick-add-customer';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { availableTags, getTagClassName } from '@/lib/tags';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarFallback } from '@/lib/placeholder-images';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

// --- Types ---
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
  status: 'Aktif' | 'Pasif';
  tags?: string[];
};

type Proposal = {
    id: string;
    customerId: string;
    customerName: string;
    totalAmount: number;
    status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
    createdAt: Timestamp;
}

type EnrichedCustomer = Customer & {
    lastProposalDate: Date | null;
    totalSpending: number;
}

type SortConfig = {
    key: keyof EnrichedCustomer | 'address.city' | 'tags';
    direction: 'ascending' | 'descending';
}

type EditingCell = {
  customerId: string;
  field: 'email' | 'phone';
} | null;

const ITEMS_PER_PAGE = 50;

const StatCard = ({ title, value, icon, isLoading }: { title: string, value: string | number, icon: React.ReactNode, isLoading: boolean }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{value}</div>}
      </CardContent>
    </Card>
);


// --- Main Component ---
export function CustomersPageContent() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  // --- State Management ---
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<('Aktif' | 'Pasif')[]>(['Aktif']);
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // --- Data Fetching ---
  const customersQuery = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'customers'), orderBy('name', 'asc')) : null),
      [firestore]
  );
  const { data: customers, isLoading: isLoadingCustomers, refetch: refetchCustomers } = useCollection<Customer>(customersQuery);

  const proposalsQuery = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'proposals')) : null),
      [firestore]
  );
  const { data: proposals, isLoading: isLoadingProposals } = useCollection<Proposal>(proposalsQuery);
  
  // --- Effects ---
  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(1); // Reset page on filter change
  }, [statusFilter, cityFilter, tagFilter, searchTerm, sortConfig]);


  // --- Data Enrichment and Processing ---
  const enrichedCustomers = useMemo((): EnrichedCustomer[] => {
    if (!customers || !proposals) return [];
    
    const proposalDataByCustomer = proposals.reduce((acc, proposal) => {
        if (!acc[proposal.customerId]) {
            acc[proposal.customerId] = { totalSpending: 0, dates: [] };
        }
        if (proposal.status === 'Approved') {
            acc[proposal.customerId].totalSpending += proposal.totalAmount;
        }
        acc[proposal.customerId].dates.push(proposal.createdAt.toDate());
        return acc;
    }, {} as Record<string, { totalSpending: number, dates: Date[] }>);

    return customers.map(customer => {
        const customerData = proposalDataByCustomer?.[customer.id];
        const lastProposalDate = customerData ? new Date(Math.max(...customerData.dates.map(d => d.getTime()))) : null;
        
        return {
            ...customer,
            status: customer.status || 'Aktif', // Default to Aktif if not set
            tags: customer.tags || [],
            lastProposalDate,
            totalSpending: customerData?.totalSpending || 0
        };
    });
  }, [customers, proposals]);
  
  const analytics = useMemo(() => {
    const totalCustomers = customers?.length || 0;
    const activeCustomers = customers?.filter(c => c.status === 'Aktif').length || 0;
    const activeCustomerRate = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;
    
    const approvedProposals = proposals?.filter(p => p.status === 'Approved') || [];
    const totalProposalValue = approvedProposals.reduce((sum, p) => sum + p.totalAmount, 0);
    const averageProposalValue = approvedProposals.length > 0 ? totalProposalValue / approvedProposals.length : 0;

    const topSpenders = [...enrichedCustomers].sort((a,b) => b.totalSpending - a.totalSpending).slice(0, 5).filter(c => c.totalSpending > 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentProposals = proposals?.filter(p => p.createdAt.toDate() > sevenDaysAgo)
      .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
      .slice(0, 5);

    return {
        totalCustomers,
        activeCustomerRate,
        averageProposalValue,
        topSpenders,
        recentProposals,
    }

  }, [customers, proposals, enrichedCustomers]);


  const uniqueCities = useMemo(() => {
    if (!customers) return [];
    const cities = customers.map(c => c.address?.city).filter(Boolean) as string[];
    return [...new Set(cities)];
  }, [customers]);


  const filteredAndSortedCustomers = useMemo(() => {
    return enrichedCustomers
      .filter(c => {
        const searchLower = searchTerm.toLocaleLowerCase('tr-TR');
        const searchMatch = searchLower === '' ||
            c.name.toLocaleLowerCase('tr-TR').includes(searchLower) ||
            (c.email && c.email.toLocaleLowerCase('tr-TR').includes(searchLower)) ||
            (c.phone && c.phone.includes(searchLower)) ||
            (c.address?.city && c.address.city.toLocaleLowerCase('tr-TR').includes(searchLower)) ||
            (c.address?.district && c.address.district.toLocaleLowerCase('tr-TR').includes(searchLower));

        const statusMatch = statusFilter.length === 0 || statusFilter.includes(c.status);
        const cityMatch = cityFilter.length === 0 || (c.address?.city && cityFilter.includes(c.address.city));
        const tagMatch = tagFilter.length === 0 || c.tags?.some(tag => tagFilter.includes(tag));
        
        return searchMatch && statusMatch && cityMatch && tagMatch;
      })
      .sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'address.city') {
          aValue = a.address?.city;
          bValue = b.address?.city;
        } else {
          aValue = a[sortConfig.key as keyof EnrichedCustomer];
          bValue = b[sortConfig.key as keyof EnrichedCustomer];
        }
        
        let comparison = 0;

        if (sortConfig.key === 'tags') {
            const aTags = (a.tags || []).join(', ');
            const bTags = (b.tags || []).join(', ');
            comparison = aTags.localeCompare(bTags, 'tr');
        } else if (aValue === null || aValue === undefined) {
            comparison = 1;
        } else if (bValue === null || bValue === undefined) {
            comparison = -1;
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue, 'tr');
        } else if (aValue instanceof Date && bValue instanceof Date) {
            comparison = aValue.getTime() - bValue.getTime();
        } else {
           if ((aValue as any) < (bValue as any)) comparison = -1;
           if ((aValue as any) > (bValue as any)) comparison = 1;
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
  }, [enrichedCustomers, searchTerm, statusFilter, cityFilter, tagFilter, sortConfig]);

  // --- Pagination Logic ---
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedCustomers.slice(startIndex, endIndex);
  }, [filteredAndSortedCustomers, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredAndSortedCustomers.length / ITEMS_PER_PAGE);
  }, [filteredAndSortedCustomers]);


  // --- Handlers ---
  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  };

  const handleOpenAddDialog = () => {
    setEditingCustomer(null);
    setIsCustomerDialogOpen(true);
  };
  
  const handleOpenEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsCustomerDialogOpen(true);
  };
  
  const handleSuccess = () => {
    refetchCustomers();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
  };
  
  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return date.toLocaleDateString('tr-TR');
  }
  
  const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    if (phoneNumberLength < 11) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)} ${phoneNumber.slice(6, 8)} ${phoneNumber.slice(8)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)} ${phoneNumber.slice(6, 8)} ${phoneNumber.slice(8, 10)}`;
  };

  const handleCellClick = (customer: Customer, field: 'email' | 'phone') => {
    setEditingCell({ customerId: customer.id, field });
    setEditValue(customer[field] || '');
  }

  const handleInlineEditSave = async () => {
    if (!editingCell || !firestore) return;
    const { customerId, field } = editingCell;
    const docRef = doc(firestore, 'customers', customerId);
    try {
        await updateDoc(docRef, { [field]: editValue });
        refetchCustomers();
    } catch (error) {
        console.error("Inline edit failed:", error);
    }
    setEditingCell(null);
    setEditValue('');
  }

  const handleInlineEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleInlineEditSave();
    } else if (e.key === 'Escape') {
        setEditingCell(null);
        setEditValue('');
    }
  }

  const handleDeleteCustomer = async (customerId: string) => {
    if (!firestore) return;
    try {
        // Also delete interactions subcollection
        const interactionsRef = collection(firestore, 'customers', customerId, 'interactions');
        const interactionsSnap = await getDocs(interactionsRef);
        const batch = writeBatch(firestore);
        interactionsSnap.forEach(doc => batch.delete(doc.ref));
        batch.delete(doc(firestore, 'customers', customerId));
        await batch.commit();
        
        toast({ title: "Başarılı", description: "Müşteri ve ilgili tüm verileri silindi." });
        refetchCustomers();
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(customerId);
            return newSet;
        });

    } catch (error: any) {
        toast({ variant: 'destructive', title: "Hata", description: `Müşteri silinemedi: ${error.message}` });
    }
  }

  const handleBulkDelete = async () => {
    if (!firestore || selectedIds.size === 0) return;

    toast({title: 'Siliniyor...', description: `${selectedIds.size} müşteri siliniyor.`});

    try {
        const batch = writeBatch(firestore);
        for (const id of selectedIds) {
            batch.delete(doc(firestore, 'customers', id));
            // Note: Deleting subcollections in a single batch like this can be complex.
            // For production, a Cloud Function triggered on customer delete is more robust.
            // This client-side approach is for simplicity here.
        }
        await batch.commit();

        toast({title: 'Başarılı!', description: 'Seçili müşteriler silindi.'});
        setSelectedIds(new Set());
        refetchCustomers();

    } catch (error: any) {
        toast({variant: 'destructive', title: 'Hata', description: `Müşteriler silinemedi: ${error.message}`});
    }
};

  
  const SortableHeader = ({ title, sortKey }: { title: string; sortKey: SortConfig['key'] }) => (
    <TableHead onClick={() => handleSort(sortKey)} className="cursor-pointer hover:bg-accent">
        <div className="flex items-center gap-2">
            {title}
            <ArrowUpDown className={`h-4 w-4 transition-transform ${sortConfig.key === sortKey ? 'text-foreground' : 'text-muted-foreground'}`} />
        </div>
    </TableHead>
  );

  const toggleAllSelection = (isChecked: boolean) => {
    const newSelectedIds = new Set<string>();
    if (isChecked) {
        filteredAndSortedCustomers.forEach(p => newSelectedIds.add(p.id));
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

  const allVisibleSelected = filteredAndSortedCustomers.length > 0 && selectedIds.size >= filteredAndSortedCustomers.length && filteredAndSortedCustomers.every(c => selectedIds.has(c.id));
  const someVisibleSelected = selectedIds.size > 0 && !allVisibleSelected;


  const isLoading = isLoadingCustomers || isLoadingProposals;

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
                Sayfa {currentPage} / {totalPages} ({filteredAndSortedCustomers.length} sonuç)
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Önceki
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                    Sonraki <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Müşteriler</h2>
          <p className="text-muted-foreground">
            Müşterilerinizi arayın, filtreleyin ve yönetin.
          </p>
        </div>
        <div className="flex items-center space-x-2">
            <Button onClick={handleOpenAddDialog}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Yeni Müşteri
            </Button>
        </div>
      </div>
      
        <Card>
            <CardHeader>
                <CardTitle>Müşteri Analitiği</CardTitle>
                <CardDescription>Müşteri tabanınızın genel durumu ve önemli metrikler.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Toplam Müşteri" value={analytics.totalCustomers} icon={<Users className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
                <StatCard title="Aktif Müşteri Oranı" value={`${analytics.activeCustomerRate.toFixed(0)}%`} icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
                <StatCard title="Ort. Onaylanan Teklif" value={formatCurrency(analytics.averageProposalValue)} icon={<BarChart className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center"><Award className="h-5 w-5 mr-2 text-amber-500"/> En Çok Harcayanlar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-24 w-full" /> : (
                            <div className="space-y-2">
                                {analytics.topSpenders.map(c => (
                                    <div key={c.id} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6"><AvatarFallback>{getAvatarFallback(c.name)}</AvatarFallback></Avatar>
                                            <span className="font-medium">{c.name}</span>
                                        </div>
                                        <span className="font-mono font-semibold">{formatCurrency(c.totalSpending)}</span>
                                    </div>
                                ))}
                                {analytics.topSpenders.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Henüz veri yok.</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </CardContent>
            <CardContent>
                <Card>
                    <CardHeader className="pb-2">
                         <CardTitle className="text-base">Son Teklif Alanlar (7 Gün)</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Skeleton className="h-24 w-full" /> : (
                            <div className="space-y-2">
                                {analytics.recentProposals?.map(p => (
                                    <div key={p.id} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6"><AvatarFallback>{getAvatarFallback(p.customerName)}</AvatarFallback></Avatar>
                                            <span className="font-medium">{p.customerName}</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="font-mono font-semibold">{formatCurrency(p.totalAmount)}</span>
                                            <span className="text-xs text-muted-foreground">{formatDate(p.createdAt.toDate())}</span>
                                        </div>
                                    </div>
                                ))}
                                {analytics.recentProposals?.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Son 7 günde teklif oluşturulmadı.</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </CardContent>
        </Card>


      <Card>
        <CardHeader>
          <CardTitle>Müşteri Listesi</CardTitle>
          <CardDescription>Tüm kayıtlı müşterileriniz.</CardDescription>
           <div className="flex flex-col gap-4 pt-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Ad, e-posta, telefon, ilçe veya şehir ara..." 
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                           <Button variant="outline">
                                Durum <ChevronDown className="ml-2 h-4 w-4" />
                           </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent>
                            <DropdownMenuCheckboxItem checked={statusFilter.includes('Aktif')} onCheckedChange={(checked) => setStatusFilter(prev => checked ? [...prev, 'Aktif'] : prev.filter(s => s !== 'Aktif'))}>
                                Aktif
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={statusFilter.includes('Pasif')} onCheckedChange={(checked) => setStatusFilter(prev => checked ? [...prev, 'Pasif'] : prev.filter(s => s !== 'Pasif'))}>
                                Pasif
                            </DropdownMenuCheckboxItem>
                       </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                           <Button variant="outline" disabled={uniqueCities.length === 0}>
                                Şehir <ChevronDown className="ml-2 h-4 w-4" />
                           </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent>
                            {uniqueCities.map(city => (
                                <DropdownMenuCheckboxItem key={city} checked={cityFilter.includes(city)} onCheckedChange={(checked) => setCityFilter(prev => checked ? [...prev, city] : prev.filter(s => s !== city))}>
                                    {city}
                                </DropdownMenuCheckboxItem>
                            ))}
                       </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                           <Button variant="outline">
                               <Tag className="mr-2 h-4 w-4" />
                                Etiketler <ChevronDown className="ml-2 h-4 w-4" />
                           </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent>
                            <DropdownMenuLabel>Etikete Göre Filtrele</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {availableTags.map(tag => (
                                <DropdownMenuCheckboxItem key={tag.id} checked={tagFilter.includes(tag.id)} onCheckedChange={(checked) => setTagFilter(prev => checked ? [...prev, tag.id] : prev.filter(t => t !== tag.id))}>
                                    {tag.name}
                                </DropdownMenuCheckboxItem>
                            ))}
                       </DropdownMenuContent>
                    </DropdownMenu>


                    <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter(['Aktif']); setCityFilter([]); setTagFilter([]); }}>
                        Filtreleri Temizle
                    </Button>
                </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          {selectedIds.size > 0 && (
            <div className="bg-primary/10 border-y border-primary/20 px-4 py-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-primary">
                    {selectedIds.size} müşteri seçildi.
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled>
                        <Tag className="mr-2" /> Toplu Etiketle
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2" /> Seçilenleri Sil
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Bu işlem geri alınamaz. Seçilen {selectedIds.size} müşteri kalıcı olarak silinecektir.
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
                        <X />
                    </Button>
                </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="px-4">
                        <Checkbox
                            checked={allVisibleSelected}
                            onCheckedChange={(checked) => toggleAllSelection(!!checked)}
                            aria-label="Tümünü seç"
                            data-state={someVisibleSelected ? 'indeterminate' : (allVisibleSelected ? 'checked' : 'unchecked')}
                        />
                    </TableHead>
                    <SortableHeader title="Ad / Unvan" sortKey="name" />
                    <TableHead>İletişim</TableHead>
                    <SortableHeader title="Şehir" sortKey="address.city" />
                    <SortableHeader title="Etiketler" sortKey="tags" />
                    <SortableHeader title="Son Teklif Tarihi" sortKey="lastProposalDate" />
                    <SortableHeader title="Toplam Harcama" sortKey="totalSpending" />
                    <SortableHeader title="Durum" sortKey="status" />
                    <TableHead className="text-right">Eylemler</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                          <TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                ) : paginatedCustomers.length > 0 ? (
                    paginatedCustomers.map((customer) => (
                    <TableRow key={customer.id} data-state={selectedIds.has(customer.id) ? 'selected' : undefined}>
                        <TableCell className="px-4">
                          <Checkbox
                              checked={selectedIds.has(customer.id)}
                              onCheckedChange={(checked) => toggleSelection(customer.id, !!checked)}
                              aria-label={`${customer.name} seç`}
                          />
                        </TableCell>
                        <TableCell className="font-medium" onClick={() => handleOpenEditDialog(customer)}>
                          {customer.name}
                          {(customer.address?.district || customer.address?.city) && (
                            <div className="text-xs text-muted-foreground">
                                {customer.address.district}{customer.address.district && customer.address.city && ' / '}{customer.address.city}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                           {editingCell?.customerId === customer.id && editingCell?.field === 'email' ? (
                                <Input 
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleInlineEditSave}
                                    onKeyDown={handleInlineEditKeyDown}
                                    autoFocus
                                    className="h-8"
                                    type="email"
                                />
                           ) : (
                                <div className="text-sm cursor-pointer hover:bg-gray-100 p-1 rounded" onClick={() => handleCellClick(customer, 'email')}>{customer.email}</div>
                           )}
                           {editingCell?.customerId === customer.id && editingCell?.field === 'phone' ? (
                                <Input 
                                    value={editValue}
                                    onChange={(e) => setEditValue(formatPhoneNumber(e.target.value))}
                                    onBlur={handleInlineEditSave}
                                    onKeyDown={handleInlineEditKeyDown}
                                    autoFocus
                                    className="h-8 mt-1"
                                    type="tel"
                                    maxLength={15}
                                />
                           ) : (
                                <div className="text-xs text-muted-foreground cursor-pointer hover:bg-gray-100 p-1 rounded mt-1" onClick={() => handleCellClick(customer, 'phone')}>{customer.phone}</div>
                           )}
                        </TableCell>
                         <TableCell>{customer.address?.city || '-'}</TableCell>
                         <TableCell>
                            <div className="flex flex-wrap gap-1">
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
                         </TableCell>
                         <TableCell>{formatDate(customer.lastProposalDate)}</TableCell>
                         <TableCell className="font-mono text-right">{formatCurrency(customer.totalSpending)}</TableCell>
                        <TableCell>
                           <Badge variant={customer.status === 'Aktif' ? 'secondary' : 'outline'} className={customer.status === 'Aktif' ? 'bg-green-100 text-green-800' : ''}>
                             {customer.status}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Menüyü aç</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleOpenEditDialog(customer)}>
                                <Edit /> Düzenle / Not Ekle
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                <FilePlus /> Teklif Oluştur
                              </DropdownMenuItem>
                               <DropdownMenuItem onClick={() => window.location.href = `mailto:${customer.email}`}>
                                <Mail /> E-posta Gönder
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:bg-red-100 focus:text-red-700">
                                    <Trash2 /> Sil
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                        <AlertDialogDescription>Bu işlem geri alınamaz. "{customer.name}" adlı müşteriyi kalıcı olarak silecektir.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteCustomer(customer.id)} className="bg-destructive hover:bg-destructive/90">Evet, Sil</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                       Arama kriterlerine uygun müşteri bulunamadı.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
           </div>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter>
                <PaginationControls />
            </CardFooter>
        )}
      </Card>
      <QuickAddCustomer 
        isOpen={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        onCustomerAdded={handleSuccess}
        existingCustomer={editingCustomer}
      />
    </div>
  );
}

export default function CustomersPage() {
    return <CustomersPageContent />;
}

    

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  where,
  Timestamp
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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QuickAddCustomer } from '@/components/app/quick-add-customer';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// --- Types ---
type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  status: 'Aktif' | 'Pasif';
};

type Proposal = {
    id: string;
    customerId: string;
    totalAmount: number;
    status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
    createdAt: Timestamp;
}

type EnrichedCustomer = Customer & {
    lastProposalDate: Date | null;
    totalSpending: number;
}

type SortConfig = {
    key: keyof EnrichedCustomer;
    direction: 'ascending' | 'descending';
}

// --- Main Component ---
export function CustomersPageContent() {
  const router = useRouter();
  const firestore = useFirestore();

  // --- State Management ---
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<('Aktif' | 'Pasif')[]>(['Aktif']);
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  // --- Data Fetching ---
  const customersQuery = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'customers'), orderBy('name', 'asc')) : null),
      [firestore]
  );
  const { data: customers, isLoading: isLoadingCustomers, refetch: refetchCustomers } = useCollection<Customer>(customersQuery);

  const proposalsQuery = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'proposals'), where('status', '==', 'Approved')) : null),
      [firestore]
  );
  const { data: proposals, isLoading: isLoadingProposals } = useCollection<Proposal>(proposalsQuery);

  // --- Data Enrichment and Processing ---
  const enrichedCustomers = useMemo((): EnrichedCustomer[] => {
    if (!customers) return [];
    
    const proposalDataByCustomer = proposals?.reduce((acc, proposal) => {
        if (!acc[proposal.customerId]) {
            acc[proposal.customerId] = { totalSpending: 0, dates: [] };
        }
        acc[proposal.customerId].totalSpending += proposal.totalAmount;
        acc[proposal.customerId].dates.push(proposal.createdAt.toDate());
        return acc;
    }, {} as Record<string, { totalSpending: number, dates: Date[] }>);

    return customers.map(customer => {
        const customerData = proposalDataByCustomer?.[customer.id];
        const lastProposalDate = customerData ? new Date(Math.max(...customerData.dates.map(d => d.getTime()))) : null;
        
        return {
            ...customer,
            status: customer.status || 'Aktif', // Default to Aktif if not set
            lastProposalDate,
            totalSpending: customerData?.totalSpending || 0
        };
    });
  }, [customers, proposals]);
  
  const uniqueCities = useMemo(() => {
    if (!customers) return [];
    return [...new Set(customers.map(c => c.city).filter(Boolean))] as string[];
  }, [customers]);


  const filteredAndSortedCustomers = useMemo(() => {
    return enrichedCustomers
      .filter(c => {
        const searchLower = searchTerm.toLowerCase();
        const searchMatch = searchLower === '' ||
            c.name.toLowerCase().includes(searchLower) ||
            c.email.toLowerCase().includes(searchLower) ||
            (c.phone && c.phone.includes(searchLower)) ||
            (c.city && c.city.toLowerCase().includes(searchLower));

        const statusMatch = statusFilter.length === 0 || statusFilter.includes(c.status);
        const cityMatch = cityFilter.length === 0 || (c.city && cityFilter.includes(c.city));
        
        return searchMatch && statusMatch && cityMatch;
      })
      .sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        let comparison = 0;
        if (aValue === null || aValue === undefined) comparison = 1;
        else if (bValue === null || bValue === undefined) comparison = -1;
        else if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue, 'tr');
        } else if (aValue instanceof Date && bValue instanceof Date) {
            comparison = aValue.getTime() - bValue.getTime();
        }
        else {
           if (aValue < bValue) comparison = -1;
           if (aValue > bValue) comparison = 1;
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
  }, [enrichedCustomers, searchTerm, statusFilter, cityFilter, sortConfig]);

  // --- Handlers ---
  const handleSort = (key: keyof EnrichedCustomer) => {
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
  
  const SortableHeader = ({ title, sortKey }: { title: string; sortKey: keyof EnrichedCustomer }) => (
    <TableHead onClick={() => handleSort(sortKey)} className="cursor-pointer hover:bg-accent">
        <div className="flex items-center gap-2">
            {title}
            <ArrowUpDown className={`h-4 w-4 transition-transform ${sortConfig.key === sortKey ? 'text-foreground' : 'text-muted-foreground'}`} />
        </div>
    </TableHead>
  );

  const isLoading = isLoadingCustomers || isLoadingProposals;

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
          <CardTitle>Müşteri Listesi</CardTitle>
          <CardDescription>Tüm kayıtlı müşterileriniz.</CardDescription>
           <div className="flex flex-col gap-4 pt-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Ad, e-posta, telefon veya şehir ara..." 
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

                    <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter(['Aktif']); setCityFilter([]) }}>
                        Filtreleri Temizle
                    </Button>
                </div>
           </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <SortableHeader title="Ad / Unvan" sortKey="name" />
                    <TableHead>İletişim</TableHead>
                    <SortableHeader title="Şehir" sortKey="city" />
                    <SortableHeader title="Son Teklif Tarihi" sortKey="lastProposalDate" />
                    <SortableHeader title="Toplam Harcama" sortKey="totalSpending" />
                    <SortableHeader title="Durum" sortKey="status" />
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    <TableRow>
                    <TableCell colSpan={6} className="text-center">
                        <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                    </TableCell>
                    </TableRow>
                ) : filteredAndSortedCustomers.length > 0 ? (
                    filteredAndSortedCustomers.map((customer) => (
                    <TableRow key={customer.id} onClick={() => handleOpenEditDialog(customer)} className="cursor-pointer">
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>
                            <div className="text-sm">{customer.email}</div>
                            <div className="text-xs text-muted-foreground">{customer.phone}</div>
                        </TableCell>
                         <TableCell>{customer.city || '-'}</TableCell>
                         <TableCell>{formatDate(customer.lastProposalDate)}</TableCell>
                         <TableCell className="font-mono text-right">{formatCurrency(customer.totalSpending)}</TableCell>
                        <TableCell>
                           <Badge variant={customer.status === 'Aktif' ? 'secondary' : 'outline'} className={customer.status === 'Aktif' ? 'bg-green-100 text-green-800' : ''}>
                             {customer.status}
                           </Badge>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                       Arama kriterlerine uygun müşteri bulunamadı.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
           </div>
        </CardContent>
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

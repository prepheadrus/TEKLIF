
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
  doc
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
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QuickAddCustomer } from '@/components/app/quick-add-customer';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { availableTags, getTagClassName } from '@/lib/tags';

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
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState('');

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
            tags: customer.tags || [],
            lastProposalDate,
            totalSpending: customerData?.totalSpending || 0
        };
    });
  }, [customers, proposals]);
  
  const uniqueCities = useMemo(() => {
    if (!customers) return [];
    const cities = customers.map(c => c.address?.city).filter(Boolean) as string[];
    return [...new Set(cities)];
  }, [customers]);


  const filteredAndSortedCustomers = useMemo(() => {
    return enrichedCustomers
      .filter(c => {
        const searchLower = searchTerm.toLowerCase();
        const searchMatch = searchLower === '' ||
            c.name.toLowerCase().includes(searchLower) ||
            (c.email && c.email.toLowerCase().includes(searchLower)) ||
            (c.phone && c.phone.includes(searchLower)) ||
            (c.address?.city && c.address.city.toLowerCase().includes(searchLower)) ||
            (c.address?.district && c.address.district.toLowerCase().includes(searchLower));

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

  
  const SortableHeader = ({ title, sortKey }: { title: string; sortKey: SortConfig['key'] }) => (
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
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <SortableHeader title="Ad / Unvan" sortKey="name" />
                    <TableHead>İletişim</TableHead>
                    <SortableHeader title="Şehir" sortKey="address.city" />
                    <SortableHeader title="Etiketler" sortKey="tags" />
                    <SortableHeader title="Son Teklif Tarihi" sortKey="lastProposalDate" />
                    <SortableHeader title="Toplam Harcama" sortKey="totalSpending" />
                    <SortableHeader title="Durum" sortKey="status" />
                    <TableHead>Eylemler</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    <TableRow>
                    <TableCell colSpan={8} className="text-center">
                        <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                    </TableCell>
                    </TableRow>
                ) : filteredAndSortedCustomers.length > 0 ? (
                    filteredAndSortedCustomers.map((customer) => (
                    <TableRow key={customer.id} >
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
                         <TableCell onClick={() => handleOpenEditDialog(customer)}>{customer.address?.city || '-'}</TableCell>
                         <TableCell onClick={() => handleOpenEditDialog(customer)}>
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
                         <TableCell onClick={() => handleOpenEditDialog(customer)}>{formatDate(customer.lastProposalDate)}</TableCell>
                         <TableCell onClick={() => handleOpenEditDialog(customer)} className="font-mono text-right">{formatCurrency(customer.totalSpending)}</TableCell>
                        <TableCell onClick={() => handleOpenEditDialog(customer)}>
                           <Badge variant={customer.status === 'Aktif' ? 'secondary' : 'outline'} className={customer.status === 'Aktif' ? 'bg-green-100 text-green-800' : ''}>
                             {customer.status}
                           </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(customer)}>Düzenle</Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
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

    

'use client';

import { useState, useMemo } from 'react';
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
  Search,
  MoreHorizontal,
  ChevronDown,
  ClipboardCheck,
  CircleDollarSign,
  CalendarClock,
  Wallet,
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  orderBy,
} from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarFallback } from '@/lib/placeholder-images';
import { ManagePaymentsDialog } from '@/components/app/manage-payments-dialog';

// --- Types ---
type Personnel = { id: string; name: string };
type Proposal = { id: string; projectName: string; customerName: string };
type Payment = {
    amount: number;
    date: { seconds: number };
    note?: string;
}

export type JobAssignment = {
  id: string;
  proposalId: string;
  personnelId: string;
  assignedAmount: number;
  paymentStatus: 'Ödenmedi' | 'Kısmi Ödendi' | 'Ödendi';
  notes?: string;
  assignedAt: { seconds: number };
  paymentHistory?: Payment[];
};

type EnrichedJobAssignment = JobAssignment & {
  personnelName: string;
  projectName: string;
  customerName: string;
  totalPaid: number;
  remainingBalance: number;
};

// --- Helper Functions ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount);
};

const formatDate = (timestamp: { seconds: number }) => {
  return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR');
};

const getStatusBadge = (status: JobAssignment['paymentStatus']) => {
  switch (status) {
    case 'Ödendi':
      return <Badge className="bg-green-100 text-green-800">Ödendi</Badge>;
    case 'Kısmi Ödendi':
      return <Badge className="bg-yellow-100 text-yellow-800">Kısmi Ödendi</Badge>;
    case 'Ödenmedi':
    default:
      return <Badge variant="destructive">Ödenmedi</Badge>;
  }
};

const paymentStatusOptions: JobAssignment['paymentStatus'][] = ['Ödenmedi', 'Kısmi Ödendi', 'Ödendi'];

export function AssignmentsPageContent() {
  const firestore = useFirestore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | JobAssignment['paymentStatus']>('All');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<EnrichedJobAssignment | null>(null);

  // --- Data Fetching ---
  const { data: assignments, isLoading: isLoadingAssignments, refetch: refetchAssignments } = useCollection<JobAssignment>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, 'job_assignments'), orderBy('assignedAt', 'desc')) : null), [firestore])
  );
  const { data: personnel, isLoading: isLoadingPersonnel } = useCollection<Personnel>(
    useMemoFirebase(() => (firestore ? collection(firestore, 'personnel') : null), [firestore])
  );
  const { data: proposals, isLoading: isLoadingProposals } = useCollection<Proposal>(
    useMemoFirebase(() => (firestore ? collection(firestore, 'proposals') : null), [firestore])
  );
  
  // --- Data Enrichment ---
  const enrichedAssignments = useMemo((): EnrichedJobAssignment[] => {
    if (!assignments || !personnel || !proposals) return [];
    
    const personnelMap = new Map(personnel.map(p => [p.id, p.name]));
    const proposalMap = new Map(proposals.map(p => [p.id, { projectName: p.projectName, customerName: p.customerName }]));

    return assignments.map(assignment => {
      const totalPaid = (assignment.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
      const remainingBalance = assignment.assignedAmount - totalPaid;
      
      return {
        ...assignment,
        personnelName: personnelMap.get(assignment.personnelId) || 'Bilinmeyen Usta',
        projectName: proposalMap.get(assignment.proposalId)?.projectName || 'Bilinmeyen Proje',
        customerName: proposalMap.get(assignment.proposalId)?.customerName || 'Bilinmeyen Müşteri',
        totalPaid,
        remainingBalance
      };
    });
  }, [assignments, personnel, proposals]);
  
  const filteredAssignments = useMemo(() => {
    return enrichedAssignments.filter(a => {
        const searchMatch = searchTerm === '' ||
            a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.personnelName.toLowerCase().includes(searchTerm.toLowerCase());

        const statusMatch = statusFilter === 'All' || a.paymentStatus === statusFilter;
        
        return searchMatch && statusMatch;
    })
  }, [enrichedAssignments, searchTerm, statusFilter]);
  
    const analytics = useMemo(() => {
        const totalAssignedValue = enrichedAssignments.reduce((sum, a) => sum + a.assignedAmount, 0);
        const totalPaid = enrichedAssignments.reduce((sum, a) => sum + a.totalPaid, 0);
        const totalOutstanding = totalAssignedValue - totalPaid;
        return { totalAssignedValue, totalPaid, totalOutstanding };
    }, [enrichedAssignments]);
    
  const handleOpenPaymentDialog = (assignment: EnrichedJobAssignment) => {
    setSelectedAssignment(assignment);
    setIsPaymentDialogOpen(true);
  }

  const isLoading = isLoadingAssignments || isLoadingPersonnel || isLoadingProposals;

  return (
    <>
      <div className="flex flex-col gap-4 p-8">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">İş Atamaları & Hakedişler</h2>
            <p className="text-muted-foreground">
              Ustalara atanan işleri ve ödeme durumlarını takip edin.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Toplam Hakediş</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>{isLoading ? <Skeleton className="h-8 w-3/4"/> : <div className="text-2xl font-bold">{formatCurrency(analytics.totalAssignedValue)}</div>}</CardContent>
              </Card>
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Ödenen Toplam</CardTitle>
                      <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>{isLoading ? <Skeleton className="h-8 w-3/4"/> : <div className="text-2xl font-bold text-green-600">{formatCurrency(analytics.totalPaid)}</div>}</CardContent>
              </Card>
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Bekleyen Ödeme</CardTitle>
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>{isLoading ? <Skeleton className="h-8 w-3/4"/> : <div className="text-2xl font-bold text-red-600">{formatCurrency(analytics.totalOutstanding)}</div>}</CardContent>
              </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Atama Listesi</CardTitle>
            <div className="pt-4 flex justify-between">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Proje, müşteri veya usta adı ara..."
                  className="pl-8 w-96"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="outline">Durum: {statusFilter === 'All' ? 'Tümü' : statusFilter} <ChevronDown className="ml-2 h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setStatusFilter('All')}>Tümü</DropdownMenuItem>
                      {paymentStatusOptions.map(status => (
                          <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)}>{status}</DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usta</TableHead>
                  <TableHead>Proje / Müşteri</TableHead>
                  <TableHead>Hakediş</TableHead>
                  <TableHead>Ödenen</TableHead>
                  <TableHead>Kalan</TableHead>
                  <TableHead>Ödeme Durumu</TableHead>
                  <TableHead className="text-right">Eylemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredAssignments.length > 0 ? (
                  filteredAssignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getAvatarFallback(a.personnelName)}
                            </AvatarFallback>
                          </Avatar>
                          {a.personnelName}
                        </div>
                      </TableCell>
                      <TableCell>
                          <div className="font-medium">{a.projectName}</div>
                          <div className="text-sm text-muted-foreground">{a.customerName}</div>
                      </TableCell>
                      <TableCell className="font-mono">{formatCurrency(a.assignedAmount)}</TableCell>
                      <TableCell className="font-mono text-green-600">{formatCurrency(a.totalPaid)}</TableCell>
                      <TableCell className="font-mono font-bold text-red-600">{formatCurrency(a.remainingBalance)}</TableCell>
                      <TableCell>{getStatusBadge(a.paymentStatus)}</TableCell>
                      <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleOpenPaymentDialog(a)}>
                            <Wallet className="mr-2 h-4 w-4" />
                            Ödemeleri Yönet
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Henüz iş ataması yapılmamış.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <ManagePaymentsDialog
        isOpen={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        assignment={selectedAssignment}
        onSuccess={() => {
            refetchAssignments();
            setIsPaymentDialogOpen(false);
        }}
      />
    </>
  );
}

    
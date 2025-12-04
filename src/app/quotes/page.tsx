
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDoc, collection, doc, serverTimestamp, getDocs, query, orderBy, where, getDoc, writeBatch } from 'firebase/firestore';

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
import { PlusCircle, MoreHorizontal, Copy, Trash2, Loader2, Search, ChevronDown, ChevronRight, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { fetchExchangeRates } from '@/ai/flows/fetch-exchange-rates';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';


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
    createdAt: { seconds: number } | null; // Allow null for serverTimestamp
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

export default function QuotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openCollapsibles, setOpenCollapsibles] = useState<Record<string, boolean>>({});
  const [isRevising, setIsRevising] = useState<string | null>(null);


  const form = useForm<NewQuoteFormValues>({
    resolver: zodResolver(newQuoteSchema),
    defaultValues: {
      customerId: '',
      projectName: '',
    },
  });

  const proposalsRef = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'proposals'), orderBy('createdAt', 'desc')) : null),
      [firestore]
  );
  const { data: proposals, isLoading: isLoadingProposals, refetch: refetchProposals } = useCollection<Proposal>(proposalsRef);
  
  const customersRef = useMemoFirebase(() => (firestore ? collection(firestore, 'customers') : null), [firestore]);
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersRef);

    const groupedProposals = useMemo((): ProposalGroup[] => {
        if (!proposals) return [];

        const groups: Record<string, Proposal[]> = {};
        
        proposals.forEach(p => {
            const rootId = p.rootProposalId || `legacy-${p.id}`;
            if (!groups[rootId]) {
                groups[rootId] = [];
            }
            groups[rootId].push(p);
        });

        return Object.values(groups).map(versions => {
            // Sort versions within the group to find the latest one reliably
            versions.sort((a, b) => b.version - a.version);
            return {
                rootProposalId: versions[0].rootProposalId || `legacy-${versions[0].id}`,
                latestProposal: versions[0],
                versions: versions
            };
        }).sort((a, b) => {
            // SAFE SORTING: Handle cases where createdAt might be null (due to serverTimestamp latency)
            const timeA = a.latestProposal.createdAt?.seconds ?? 0;
            const timeB = b.latestProposal.createdAt?.seconds ?? 0;
            return timeB - timeA;
        });

  }, [proposals]);


  const handleCreateNewQuote = async (values: NewQuoteFormValues) => {
    if (!firestore) {
        toast({ variant: "destructive", title: "Hata", description: "Veritabanı bağlantısı kurulamadı." });
        return;
    }
    setIsSubmitting(true);
    try {
        const selectedCustomer = customers?.find(c => c.id === values.customerId);
        if (!selectedCustomer) {
            throw new Error("Müşteri bulunamadı.");
        }

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
            status: 'Draft',
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
        const errorMessage = error.code === 'auth/network-request-failed' 
            ? "Ağ bağlantısı hatası nedeniyle teklif oluşturulamadı. Lütfen internet bağlantınızı kontrol edin."
            : `Teklif oluşturulamadı: ${error.message}`;
        toast({ variant: "destructive", title: "Hata", description: errorMessage });
    } finally {
        setIsSubmitting(false);
    }
  };
  
    const handleDuplicateProposal = async (proposalToClone: Proposal) => {
        if (!firestore || !proposalToClone) return;
        setIsRevising(proposalToClone.rootProposalId);
        toast({ title: 'Revizyon oluşturuluyor...' });

        try {
            const versionsQuery = query(
                collection(firestore, 'proposals'),
                where('rootProposalId', '==', proposalToClone.rootProposalId)
            );
            const versionsSnap = await getDocs(versionsQuery);
            const latestVersionNumber = versionsSnap.size; // simpler way to get the count for the next version

            const batch = writeBatch(firestore);
            const newProposalRef = doc(collection(firestore, 'proposals'));
            const newRates = await fetchExchangeRates();

            const newProposalData = {
                ...proposalToClone,
                id: newProposalRef.id,
                version: latestVersionNumber + 1,
                status: 'Draft' as const,
                createdAt: serverTimestamp(),
                versionNote: `Revizyon (v${proposalToClone.version}'dan kopyalandı)`,
                exchangeRates: newRates,
            };
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
        if (isGroupDelete) {
            const versionsQuery = query(collection(firestore, 'proposals'), where('rootProposalId', '==', rootId));
            const versionsSnap = await getDocs(versionsQuery);
            
            for (const versionDoc of versionsSnap.docs) {
                batch.delete(versionDoc.ref);
                const itemsRef = collection(firestore, 'proposals', versionDoc.id, 'proposal_items');
                const itemsSnap = await getDocs(itemsRef);
                itemsSnap.forEach(itemDoc => batch.delete(itemDoc.ref));
            }
        } else {
            const docRef = doc(firestore, 'proposals', idToDelete);
            batch.delete(docRef);
            const itemsRef = collection(firestore, 'proposals', idToDelete, 'proposal_items');
            const itemsSnap = await getDocs(itemsRef);
            itemsSnap.forEach(itemDoc => batch.delete(itemDoc.ref));
        }

        await batch.commit();
        toast({ title: "Başarılı", description: "Teklif ve ilgili tüm kalemler silindi." });
        await refetchProposals();
    } catch (error: any) {
        console.error("Teklif silme hatası:", error);
        toast({ variant: "destructive", title: "Hata", description: `Teklif silinemedi: ${error.message}` });
    }
};

  
  const filteredProposalGroups = useMemo(() => {
      if (!groupedProposals) return [];
      return groupedProposals.filter(g => 
            g.latestProposal.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            g.latestProposal.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            g.latestProposal.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [groupedProposals, searchTerm]);


  return (
    <>
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
      <Card>
        <CardHeader>
          <CardTitle>Teklifler</CardTitle>
          <CardDescription>Tüm tekliflerinizin listesi.</CardDescription>
           <div className="relative pt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Müşteri, proje veya teklif no ara..." 
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]"></TableHead>
                <TableHead>Teklif No</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Proje Adı</TableHead>
                <TableHead>Versiyonlar</TableHead>
                <TableHead>Tutar (Son V.)</TableHead>
                <TableHead>Durum (Son V.)</TableHead>
                <TableHead>Tarih (Son V.)</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingProposals ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filteredProposalGroups && filteredProposalGroups.length > 0 ? (
                filteredProposalGroups.map((group) => (
                    <Collapsible asChild key={group.rootProposalId} onOpenChange={(isOpen) => setOpenCollapsibles(prev => ({...prev, [group.rootProposalId]: isOpen}))}>
                        <React.Fragment>
                            <TableRow className="font-medium bg-slate-50 hover:bg-slate-100 data-[state=open]:bg-slate-100">
                                <TableCell>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm" className="w-full justify-start">
                                            {openCollapsibles[group.rootProposalId] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <span className="ml-2">Detaylar</span>
                                        </Button>
                                    </CollapsibleTrigger>
                                </TableCell>
                                <TableCell>{group.latestProposal.quoteNumber}</TableCell>
                                <TableCell>{group.latestProposal.customerName}</TableCell>
                                <TableCell>{group.latestProposal.projectName}</TableCell>
                                <TableCell>
                                    <Badge variant="default">{group.versions.length} Versiyon</Badge>
                                </TableCell>
                                <TableCell>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(group.latestProposal.totalAmount)}</TableCell>
                                <TableCell>{getStatusBadge(group.latestProposal.status)}</TableCell>
                                <TableCell>{group.latestProposal.createdAt ? new Date(group.latestProposal.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-'}</TableCell>
                                <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => router.push(`/quotes/${group.latestProposal.id}`)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Son Versiyonu Görüntüle
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isRevising === group.rootProposalId}>
                                            {isRevising === group.rootProposalId ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                                            <span className="sr-only">Menüyü aç</span>
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
                                                    <DropdownMenuItem
                                                    onSelect={(e) => e.preventDefault()}
                                                    className="text-red-600 focus:bg-red-100 focus:text-red-700"
                                                    >
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

                                        {group.versions.length > 1 && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                   <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Son Versiyonu Sil (v{group.latestProposal.version})
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Son Versiyonu Silmek İstediğinizden Emin misiniz?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Bu işlem geri alınamaz. Sadece <strong>v{group.latestProposal.version}</strong> versiyonu silinecektir. Grubun önceki versiyonları korunacaktır.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteProposal(group.latestProposal.id, group.rootProposalId, false)} className="bg-destructive hover:bg-destructive/90">
                                                            Evet, Sadece Son Versiyonu Sil
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild>
                                <TableRow>
                                    <TableCell colSpan={9} className="p-0">
                                        <div className="bg-white p-4 border-t-4 border-blue-200">
                                            <h4 className="font-semibold mb-2 px-4">Teklif Versiyonları ({group.latestProposal.projectName})</h4>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Versiyon</TableHead>
                                                        <TableHead>Tutar</TableHead>
                                                        <TableHead>Durum</TableHead>
                                                        <TableHead>Tarih</TableHead>
                                                        <TableHead>Not</TableHead>
                                                        <TableHead className="text-right">İşlemler</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.versions.map(v => (
                                                        <TableRow key={v.id} className="hover:bg-slate-50">
                                                            <TableCell><Badge variant="secondary">v{v.version}</Badge></TableCell>
                                                            <TableCell>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v.totalAmount)}</TableCell>
                                                            <TableCell>{getStatusBadge(v.status)}</TableCell>
                                                            <TableCell>{v.createdAt ? new Date(v.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-'}</TableCell>
                                                            <TableCell className="text-muted-foreground text-xs">{v.versionNote}</TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button variant="ghost" size="sm" onClick={() => router.push(`/quotes/${v.id}`)}>Görüntüle</Button>
                                                                    <Button variant="ghost" size="sm" onClick={() => router.push(`/quotes/${v.id}/print?customerId=${v.customerId}`)}>Yazdır</Button>
                                                                    <Button variant="outline" size="sm" onClick={() => handleDuplicateProposal(v)} disabled={isRevising === group.rootProposalId}><Copy className="mr-2 h-3 w-3"/>Revize Et</Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </CollapsibleContent>
                        </React.Fragment>
                    </Collapsible>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    Henüz teklif bulunmuyor veya aramanızla eşleşen sonuç yok.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

    
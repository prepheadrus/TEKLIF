'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDoc, collection, doc, serverTimestamp, getDocs, query, orderBy, where, getDoc, writeBatch, deleteDoc, setDoc } from 'firebase/firestore';

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
import { PlusCircle, MoreHorizontal, Copy, Trash2, Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


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
    createdAt: { seconds: number };
    version: number;
    rootProposalId: string;
    customerId: string;
};

function getStatusBadge(status: Proposal['status']) {
  switch (status) {
    case 'Approved':
      return <Badge variant="default" className="bg-green-500">Onaylandı</Badge>;
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

  const handleCreateNewQuote = async (values: NewQuoteFormValues) => {
    if (!firestore) {
        toast({ variant: "destructive", title: "Hata", description: "Veritabanı bağlantısı kurulamadı." });
        return;
    }
    setIsSubmitting(true);
    try {
        // Find customer name
        const selectedCustomer = customers?.find(c => c.id === values.customerId);
        if (!selectedCustomer) {
            throw new Error("Müşteri bulunamadı.");
        }

        // Generate Quote Number
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

        // Create initial proposal document
        const newProposalRef = doc(collection(firestore, 'proposals'));
        const newProposalData = {
            rootProposalId: newProposalRef.id, // The first proposal is its own root
            version: 1,
            customerId: values.customerId,
            customerName: selectedCustomer.name,
            projectName: values.projectName,
            quoteNumber: quoteNumber,
            totalAmount: 0,
            status: 'Draft',
            createdAt: serverTimestamp(),
            exchangeRates: { USD: 32.5, EUR: 35.0 }, // Dummy rates, should be updated.
            versionNote: "İlk Versiyon"
        };
        await setDoc(newProposalRef, newProposalData);

        toast({ title: "Başarılı!", description: "Yeni teklif taslağı oluşturuldu." });
        setIsDialogOpen(false);
        form.reset();
        refetchProposals();
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

  const handleDuplicateProposal = async (proposalId: string) => {
    if (!firestore) return;
    try {
        const originalProposalRef = doc(firestore, 'proposals', proposalId);
        const originalProposalSnap = await getDoc(originalProposalRef);

        if (!originalProposalSnap.exists()) {
            throw new Error("Orijinal teklif bulunamadı.");
        }
        const originalData = originalProposalSnap.data() as Proposal;

        // Find the latest version in the chain
        const versionsQuery = query(
            collection(firestore, 'proposals'),
            where('rootProposalId', '==', originalData.rootProposalId),
            orderBy('version', 'desc')
        );
        const versionsSnap = await getDocs(versionsQuery);
        const latestVersion = versionsSnap.docs.length > 0 ? (versionsSnap.docs[0].data() as Proposal).version : 0;

        const batch = writeBatch(firestore);

        // Create new proposal version
        const newProposalRef = doc(collection(firestore, 'proposals'));
        const newProposalData = {
            ...originalData,
            version: latestVersion + 1,
            status: 'Draft',
            createdAt: serverTimestamp(),
            versionNote: `Revizyon (v${originalData.version}'dan kopyalandı)`,
            totalAmount: originalData.totalAmount, // Copy total amount for reference
        };
        batch.set(newProposalRef, newProposalData);

        // Copy items
        const itemsRef = collection(firestore, 'proposals', proposalId, 'proposal_items');
        const itemsSnap = await getDocs(itemsRef);
        itemsSnap.forEach(itemDoc => {
            const newItemRef = doc(collection(firestore, 'proposals', newProposalRef.id, 'proposal_items'));
            batch.set(newItemRef, itemDoc.data());
        });

        await batch.commit();

        toast({ title: "Başarılı!", description: `Teklif revize edildi. Yeni versiyon: v${latestVersion + 1}` });
        refetchProposals();
        router.push(`/quotes/${newProposalRef.id}`);

    } catch (error: any) {
        console.error("Teklif revizyon hatası:", error);
        toast({ variant: "destructive", title: "Hata", description: `Revizyon oluşturulamadı: ${error.message}` });
    }
  }
  
  const handleDeleteProposal = async (proposalId: string) => {
    if (!firestore) return;
    try {
        // Here you might also want to delete subcollections, but for simplicity, we delete the main doc.
        await deleteDoc(doc(firestore, 'proposals', proposalId));
        toast({ title: "Başarılı", description: "Teklif silindi." });
        refetchProposals();
    } catch (error: any) {
        console.error("Teklif silme hatası:", error);
        toast({ variant: "destructive", title: "Hata", description: `Teklif silinemedi: ${error.message}` });
    }
  }
  
  const filteredProposals = proposals?.filter(p => 
        p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                            Yeni bir teklif oluşturmak için müşteri ve proje adı seçin.
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
                <TableHead>Teklif No</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Proje Adı</TableHead>
                <TableHead>Versiyon</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead><span className="sr-only">İşlemler</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingProposals ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filteredProposals && filteredProposals.length > 0 ? (
                filteredProposals.map((proposal) => (
                  <TableRow 
                    key={proposal.id} 
                    className="cursor-pointer"
                    onClick={() => router.push(`/quotes/${proposal.id}`)}
                  >
                    <TableCell className="font-medium">{proposal.quoteNumber}</TableCell>
                    <TableCell>{proposal.customerName}</TableCell>
                    <TableCell>{proposal.projectName}</TableCell>
                     <TableCell>v{proposal.version}</TableCell>
                    <TableCell>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(proposal.totalAmount)}</TableCell>
                    <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                    <TableCell>{proposal.createdAt ? new Date(proposal.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-'}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" className="h-8 w-8 p-0">
                               <span className="sr-only">Menüyü aç</span>
                               <MoreHorizontal className="h-4 w-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                             <DropdownMenuItem onClick={() => router.push(`/quotes/${proposal.id}`)}>
                               Görüntüle / Düzenle
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => router.push(`/quotes/${proposal.id}/print?customerId=${proposal.customerId}`)}>
                               Yazdır / İndir
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleDuplicateProposal(proposal.id)}>
                                <Copy className="mr-2 h-4 w-4" />
                               Revize Et
                             </DropdownMenuItem>
                             <DropdownMenuSeparator />
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Sil
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Bu işlem geri alınamaz. Bu teklifi kalıcı olarak silecektir.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteProposal(proposal.id)} className="bg-destructive hover:bg-destructive/90">
                                            Evet, Sil
                                        </AlertDialogAction>
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
                  <TableCell colSpan={8} className="h-24 text-center">
                    Henüz teklif bulunmuyor.
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

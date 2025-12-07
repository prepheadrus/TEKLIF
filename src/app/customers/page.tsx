
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, doc, deleteDoc, setDoc, query, orderBy, updateDoc } from 'firebase/firestore';

import {
  Table,
  TableBody,
  TableCell,
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
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { QuickAddCustomer } from '@/components/app/quick-add-customer';


type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
};

type EditingCell = {
  customerId: string;
  field: 'email' | 'phone';
} | null;

export function CustomersPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for inline editing
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);


  const customersQuery = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'customers'), orderBy('name', 'asc')) : null),
      [firestore]
  );
  const { data: customers, isLoading, error, refetch } = useCollection<Customer>(customersQuery);

  useEffect(() => {
    if (editingCell && inlineInputRef.current) {
        inlineInputRef.current.focus();
    }
  }, [editingCell]);


  const handleOpenAddDialog = () => {
    setEditingCustomer(null);
    setIsCustomerDialogOpen(true);
  };

  const handleOpenEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsCustomerDialogOpen(true);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'customers', customerId));
        toast({ title: "Başarılı", description: "Müşteri silindi." });
        refetch();
    } catch (error: any) {
        console.error("Müşteri silme hatası:", error);
        toast({ variant: "destructive", title: "Hata", description: `Müşteri silinemedi: ${error.message}` });
    }
  }

  const handleCellClick = (customer: Customer, field: 'email' | 'phone') => {
    setEditingCell({ customerId: customer.id, field });
    setEditValue(customer[field] || '');
  }

  const handleInlineEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }

  const handleInlineEditSave = async () => {
    if (!editingCell || !firestore) return;

    const { customerId, field } = editingCell;
    const docRef = doc(firestore, 'customers', customerId);

    try {
        await updateDoc(docRef, { [field]: editValue });
        toast({ title: "Güncellendi", description: `${field === 'email' ? 'E-posta' : 'Telefon'} güncellendi.` });
        refetch(); // Veriyi yeniden çekerek UI'ı güncelle
    } catch (error: any) {
        console.error("Inline düzenleme hatası:", error);
        toast({ variant: "destructive", title: "Hata", description: `Güncelleme başarısız: ${error.message}` });
    } finally {
        setEditingCell(null);
        setEditValue('');
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleInlineEditSave();
    } else if (e.key === 'Escape') {
        setEditingCell(null);
        setEditValue('');
    }
  }

  const filteredCustomers = (customers || []).filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Müşteriler</h2>
          <p className="text-muted-foreground">
            Mevcut müşterilerinizi yönetin ve yenilerini ekleyin.
          </p>
        </div>
        <div className="flex items-center space-x-2">
            <Button onClick={handleOpenAddDialog}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Yeni Müşteri Ekle
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Müşteri Listesi</CardTitle>
          <CardDescription>Tüm kayıtlı müşterileriniz. Düzenlemek için e-posta veya telefon alanına tıklayın.</CardDescription>
           <div className="relative pt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Müşteri adı, e-posta veya telefon ara..." 
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
                <TableHead>Ad / Unvan</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead><span className="sr-only">İşlemler</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-red-600">
                        Müşteriler yüklenirken bir hata oluştu: {error.message}
                    </TableCell>
                </TableRow>
              ) : filteredCustomers && filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    
                    <TableCell onClick={() => handleCellClick(customer, 'email')} className="cursor-pointer">
                        {editingCell?.customerId === customer.id && editingCell?.field === 'email' ? (
                            <Input 
                                ref={inlineInputRef}
                                value={editValue}
                                onChange={handleInlineEditChange}
                                onBlur={handleInlineEditSave}
                                onKeyDown={handleInlineKeyDown}
                                className="h-8"
                            />
                        ) : (
                            customer.email
                        )}
                    </TableCell>

                    <TableCell onClick={() => handleCellClick(customer, 'phone')} className="cursor-pointer">
                         {editingCell?.customerId === customer.id && editingCell?.field === 'phone' ? (
                            <Input 
                                ref={inlineInputRef}
                                value={editValue}
                                onChange={handleInlineEditChange}
                                onBlur={handleInlineEditSave}
                                onKeyDown={handleInlineKeyDown}
                                className="h-8"
                            />
                        ) : (
                            customer.phone || '-'
                        )}
                    </TableCell>

                    <TableCell>
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
                                <Edit className="mr-2 h-4 w-4" />
                                Düzenle
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
                                            Bu işlem geri alınamaz. Bu müşteriyi kalıcı olarak silecektir.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteCustomer(customer.id)} className="bg-destructive hover:bg-destructive/90">
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
                  <TableCell colSpan={4} className="h-24 text-center">
                    Henüz müşteri bulunmuyor.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <QuickAddCustomer 
        isOpen={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        onCustomerAdded={refetch}
        existingCustomer={editingCustomer}
      />
    </div>
  );
}

export default function CustomersPage() {
    return <CustomersPageContent />;
}

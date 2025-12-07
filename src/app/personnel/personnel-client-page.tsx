
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, MoreHorizontal, Edit, Trash2, Search, HardHat, Mail, Phone, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarFallback } from '@/lib/placeholder-images';

// --- Types ---
type Personnel = {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  status: 'Aktif' | 'Pasif';
};

const personnelSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır."),
  role: z.string().min(2, "Rol en az 2 karakter olmalıdır."),
  phone: z.string().optional(),
  email: z.string().email("Geçerli bir e-posta adresi girin.").optional().or(z.literal('')),
  status: z.enum(['Aktif', 'Pasif']),
});

type PersonnelFormValues = z.infer<typeof personnelSchema>;

export function PersonnelPageContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const personnelQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'personnel'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: personnel, isLoading, refetch } = useCollection<Personnel>(personnelQuery);

  const filteredPersonnel = useMemo(() => {
    if (!personnel) return [];
    return personnel.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [personnel, searchTerm]);

  const handleOpenAddDialog = () => {
    setEditingPersonnel(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (p: Personnel) => {
    setEditingPersonnel(p);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'personnel', id));
      toast({ title: 'Başarılı', description: 'Personel silindi.' });
      refetch();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Hata', description: `Personel silinemedi: ${error.message}` });
    }
  };
  
  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ustalar ve Personel</h2>
          <p className="text-muted-foreground">Ekibinizi yönetin, iş atamaları yapın ve ödemeleri takip edin.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={handleOpenAddDialog}>
            <UserPlus className="mr-2 h-4 w-4" />
            Yeni Usta Ekle
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Personel Listesi</CardTitle>
          <div className="pt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="İsim veya role göre ara..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İsim</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Eylemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredPersonnel.length > 0 ? (
                filteredPersonnel.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                            <Avatar><AvatarFallback>{getAvatarFallback(p.name)}</AvatarFallback></Avatar>
                            {p.name}
                        </div>
                    </TableCell>
                    <TableCell>{p.role}</TableCell>
                    <TableCell>
                      {p.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground"/> {p.email}</div>}
                      {p.phone && <div className="flex items-center gap-2 text-xs mt-1"><Phone className="h-4 w-4 text-muted-foreground"/> {p.phone}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'Aktif' ? 'secondary' : 'outline'} className={p.status === 'Aktif' ? 'bg-green-100 text-green-800' : ''}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(p)}>
                            <Edit className="mr-2" /> Düzenle
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:bg-red-100 focus:text-red-700">
                                <Trash2 className="mr-2" /> Sil
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bu işlem geri alınamaz. "{p.name}" adlı personel kalıcı olarak silinecektir.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive hover:bg-destructive/90">
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
                  <TableCell colSpan={5} className="h-24 text-center">
                    Henüz personel eklenmemiş veya aramanızla eşleşen sonuç yok.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PersonnelFormDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={refetch}
        existingPersonnel={editingPersonnel}
      />
    </div>
  );
}

function PersonnelFormDialog({ isOpen, onOpenChange, onSuccess, existingPersonnel }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void; existingPersonnel: Personnel | null }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const form = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
  });

  useEffect(() => {
    if (isOpen) {
      if (existingPersonnel) {
        form.reset(existingPersonnel);
      } else {
        form.reset({ name: '', role: '', phone: '', email: '', status: 'Aktif' });
      }
    }
  }, [isOpen, existingPersonnel, form]);

  const onSubmit = async (values: PersonnelFormValues) => {
    if (!firestore) return;
    try {
      if (existingPersonnel) {
        await setDoc(doc(firestore, 'personnel', existingPersonnel.id), values, { merge: true });
        toast({ title: "Başarılı", description: "Personel bilgileri güncellendi." });
      } else {
        await addDoc(collection(firestore, 'personnel'), values);
        toast({ title: "Başarılı", description: "Yeni personel eklendi." });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Hata", description: `İşlem başarısız oldu: ${error.message}` });
    }
  };

  const isEditMode = !!existingPersonnel;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Personel Düzenle' : 'Yeni Personel Ekle'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Personel bilgilerini güncelleyin.' : 'Ekibinize yeni bir üye ekleyin.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>İsim Soyisim</FormLabel><FormControl><Input placeholder="Ahmet Yılmaz" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem><FormLabel>Rol / Unvan</FormLabel><FormControl><Input placeholder="Tesisat Ustası" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input type="tel" placeholder="(5xx) xxx xx xx" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>E-posta</FormLabel><FormControl><Input type="email" placeholder="ahmet@example.com" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Durum</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Aktif">Aktif</SelectItem>
                    <SelectItem value="Pasif">Pasif</SelectItem>
                  </SelectContent>
                </Select><FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <HardHat className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Güncelle' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

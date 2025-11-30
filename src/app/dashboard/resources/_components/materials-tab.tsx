'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

const materialSchema = z.object({
  name: z.string().min(2, "Malzeme adı en az 2 karakter olmalıdır."),
  unit: z.string().min(1, "Birim zorunludur."),
  basePrice: z.coerce.number().min(0, "Fiyat 0'dan büyük olmalıdır."),
  currency: z.enum(["TRY", "USD", "EUR"]),
  supplierId: z.string().min(1, "Tedarikçi seçimi zorunludur."),
});

type MaterialFormValues = z.infer<typeof materialSchema>;
type Supplier = { id: string; name: string; };
type Material = MaterialFormValues & { id: string; };

export function MaterialsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: "",
      unit: "Adet",
      basePrice: 0,
      currency: "TRY",
      supplierId: "",
    },
  });

  const suppliersQuery = useMemoFirebase(() =>
    firestore ? collection(firestore, 'suppliers') : null,
    [firestore]
  );
  const { data: suppliers, isLoading: areSuppliersLoading } = useCollection<Supplier>(suppliersQuery);

  const materialsQuery = useMemoFirebase(() =>
    firestore ? collection(firestore, 'materials') : null,
    [firestore]
  );
  const { data: materials, isLoading: areMaterialsLoading } = useCollection<Material>(materialsQuery);

  const onSubmit = (values: MaterialFormValues) => {
    if (!firestore) return;
    const materialsCollectionRef = collection(firestore, 'materials');
    addDocumentNonBlocking(materialsCollectionRef, values);
    toast({
      title: "Başarılı",
      description: "Yeni malzeme eklendi.",
    });
    form.reset();
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const materialDocRef = doc(firestore, 'materials', id);
    deleteDocumentNonBlocking(materialDocRef);
    toast({
      title: "Başarılı",
      description: "Malzeme silindi.",
    });
  };

  const getSupplierName = (supplierId: string) => {
    return suppliers?.find(s => s.id === supplierId)?.name || 'Bilinmiyor';
  };
  
  const formatCurrency = (price: number, currency: string) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(price);
  };

  const isLoading = areMaterialsLoading || areSuppliersLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Malzemeler</CardTitle>
            <CardDescription>Reçetelerde kullanılan ham madde ve ürünler.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2" />
                Yeni Malzeme Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <DialogHeader><DialogTitle>Yeni Malzeme</DialogTitle></DialogHeader>
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Malzeme Adı</FormLabel><FormControl><Input placeholder="PPRC Boru 20mm" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="supplierId" render={({ field }) => (
                    <FormItem><FormLabel>Tedarikçi</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder={areSuppliersLoading ? "Yükleniyor..." : "Tedarikçi Seçin"} /></SelectTrigger></FormControl>
                            <SelectContent>
                                {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    <FormMessage /></FormItem>
                    )} />
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="basePrice" render={({ field }) => (
                        <FormItem><FormLabel>Birim Fiyat</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="currency" render={({ field }) => (
                        <FormItem><FormLabel>Para Birimi</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="TRY">TL</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem>
                                </SelectContent>
                            </Select>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="unit" render={({ field }) => (
                        <FormItem><FormLabel>Birim</FormLabel><FormControl><Input placeholder="Metre" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Kaydet
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Tedarikçi</TableHead>
              <TableHead>Birim</TableHead>
              <TableHead>Birim Fiyat</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : materials && materials.length > 0 ? (
              materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell className="font-medium">{material.name}</TableCell>
                  <TableCell>{getSupplierName(material.supplierId)}</TableCell>
                  <TableCell>{material.unit}</TableCell>
                  <TableCell>{formatCurrency(material.basePrice, material.currency)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(material.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="text-center">Henüz malzeme eklenmemiş.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

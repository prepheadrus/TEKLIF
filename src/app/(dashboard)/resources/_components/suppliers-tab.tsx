
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
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

const supplierSchema = z.object({
  name: z.string().min(2, { message: "Tedarikçi adı en az 2 karakter olmalıdır." }),
  contactEmail: z.string().email({ message: "Geçersiz e-posta adresi." }),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export function SuppliersTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactEmail: "",
    },
  });

  const suppliersQuery = useMemoFirebase(() => 
    firestore ? collection(firestore, 'suppliers') : null, 
    [firestore]
  );
  const { data: suppliers, isLoading } = useCollection<SupplierFormValues>(suppliersQuery);

  const onSubmit = (values: SupplierFormValues) => {
    if (!firestore) return;
    const suppliersCollectionRef = collection(firestore, 'suppliers');
    addDocumentNonBlocking(suppliersCollectionRef, values);
    toast({
      title: "Başarılı",
      description: "Yeni tedarikçi eklendi.",
    });
    form.reset();
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const supplierDocRef = doc(firestore, 'suppliers', id);
    deleteDocumentNonBlocking(supplierDocRef);
    toast({
      title: "Başarılı",
      description: "Tedarikçi silindi.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tedarikçiler</CardTitle>
            <CardDescription>Malzeme temin ettiğiniz firmalar.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2" />
                Yeni Tedarikçi Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Yeni Tedarikçi</DialogTitle>
                  </DialogHeader>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tedarikçi Adı</FormLabel>
                        <FormControl>
                          <Input placeholder="Firma Adı" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>İletişim E-postası</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="iletisim@firma.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
              <TableHead>İletişim E-postası</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : suppliers && suppliers.length > 0 ? (
              suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.contactEmail}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(supplier.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={3} className="text-center">Henüz tedarikçi eklenmemiş.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

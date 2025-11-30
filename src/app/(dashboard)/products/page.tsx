
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
import { useCollection, useFirestore, useUser, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';

const productSchema = z.object({
  code: z.string().min(1, "Kod zorunludur."),
  name: z.string().min(2, "Ad en az 2 karakter olmalıdır."),
  brand: z.string().min(1, "Marka zorunludur."),
  category: z.string().min(1, "Kategori zorunludur."),
  installationTypeId: z.string().min(1, "Tesisat türü zorunludur."),
  unit: z.string().min(1, "Birim zorunludur."),
  listPrice: z.coerce.number().min(0, "Liste fiyatı 0'dan büyük olmalıdır."),
  currency: z.enum(["TRY", "USD", "EUR"]),
  discountRate: z.coerce.number().min(0).max(1, "İskonto oranı 0 ile 1 arasında olmalıdır."),
});

type ProductFormValues = z.infer<typeof productSchema>;
type InstallationType = { id: string, name: string };

export default function ProductsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: "",
      name: "",
      brand: "",
      category: "",
      installationTypeId: "",
      unit: "Adet",
      listPrice: 0,
      currency: "TRY",
      discountRate: 0,
    },
  });

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'products');
  }, [firestore]);

  const { data: products, isLoading: areProductsLoading } = useCollection<ProductFormValues>(productsQuery);

  const installationTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'installation_types');
  }, [firestore]);

  const { data: installationTypes, isLoading: areInstallationTypesLoading } = useCollection<InstallationType>(installationTypesQuery);


  const onSubmit = (values: ProductFormValues) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Veritabanı bağlantısı kurulamamış.",
      });
      return;
    }

    const productsCollectionRef = collection(firestore, 'products');
    addDocumentNonBlocking(productsCollectionRef, values);
    
    toast({
      title: "Başarılı",
      description: "Yeni ürün başarıyla eklendi.",
    });
    form.reset();
    setIsDialogOpen(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (!firestore) return;
    const productDocRef = doc(firestore, 'products', id);
    deleteDocumentNonBlocking(productDocRef);
    toast({
      title: "Başarılı",
      description: "Ürün silindi.",
    });
  };

  const isLoading = isUserLoading || areProductsLoading || areInstallationTypesLoading;

  const formatCurrency = (price: number, currency: string) => {
    const displayCurrency = currency === 'TL' ? 'TRY' : currency;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: displayCurrency }).format(price);
  }

  const getInstallationTypeName = (typeId: string) => {
    return installationTypes?.find(t => t.id === typeId)?.name || 'Bilinmiyor';
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Ürünler / Malzemeler</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2" />
              Yeni Ürün Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] grid-rows-[auto,1fr,auto]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Yeni Ürün Ekle</DialogTitle>
                  <DialogDescription>
                    Tekliflerinize eklemek için yeni bir ürün veya malzeme oluşturun.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="code" render={({ field }) => (
                        <FormItem><FormLabel>Kod</FormLabel><FormControl><Input placeholder="GRF-001" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Ad</FormLabel><FormControl><Input placeholder="UPS 25-60" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="brand" render={({ field }) => (
                        <FormItem><FormLabel>Marka</FormLabel><FormControl><Input placeholder="Grundfos" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="installationTypeId" render={({ field }) => (
                        <FormItem><FormLabel>Tesisat Türü</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={areInstallationTypesLoading ? "Yükleniyor..." : "Tesisat türü seçin"} /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {installationTypes?.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        <FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem><FormLabel>Kategori</FormLabel><FormControl><Input placeholder="Pompa" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="listPrice" render={({ field }) => (
                        <FormItem><FormLabel>Liste Fiyatı</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="currency" render={({ field }) => (
                        <FormItem><FormLabel>Para Birimi</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="TRY">TL</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="EUR">EUR</SelectItem>
                                </SelectContent>
                            </Select>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="unit" render={({ field }) => (
                        <FormItem><FormLabel>Birim</FormLabel><FormControl><Input placeholder="Adet" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="discountRate" render={({ field }) => (
                        <FormItem><FormLabel>İskonto Oranı (%15 için 0.15)</FormLabel><FormControl><Input type="number" step="0.01" min="0" max="1" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">İptal</Button>
                  </DialogClose>
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
      <Card>
        <CardHeader>
          <CardTitle>Ürün Listesi</CardTitle>
          <CardDescription>Kayıtlı ürün ve malzemelerinizi buradan yönetebilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Marka</TableHead>
                <TableHead>Tesisat Türü</TableHead>
                <TableHead>Liste Fiyatı</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : products && products.length > 0 ? (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.code}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.brand}</TableCell>
                    <TableCell>{getInstallationTypeName(product.installationTypeId)}</TableCell>
                    <TableCell>{formatCurrency(product.listPrice, product.currency)}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Henüz ürün eklenmemiş.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

    

    
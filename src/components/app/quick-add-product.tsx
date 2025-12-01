
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';

const productSchema = z.object({
  code: z.string().min(1, "Kod zorunludur."),
  name: z.string().min(2, "Ad en az 2 karakter olmalıdır."),
  brand: z.string().min(1, "Marka zorunludur."),
  category: z.string().min(1, "Kategori zorunludur."),
  installationTypeId: z.string().optional(), // Made optional for simplicity
  unit: z.string().min(1, "Birim zorunludur."),
  listPrice: z.coerce.number().min(0, "Liste fiyatı 0'dan büyük olmalıdır."),
  currency: z.enum(["TRY", "USD", "EUR"]),
  discountRate: z.coerce.number().min(0).max(1, "İskonto oranı 0 ile 1 arasında olmalıdır."),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface QuickAddProductProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onProductAdded: () => void;
}

export function QuickAddProduct({ isOpen, onOpenChange, onProductAdded }: QuickAddProductProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: "",
      name: "",
      brand: "",
      category: "",
      unit: "Adet",
      listPrice: 0,
      currency: "TRY",
      discountRate: 0,
    },
  });

  const onSubmit = async (values: ProductFormValues) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Veritabanı bağlantısı kurulamamış.",
      });
      return;
    }
    
    const productsCollectionRef = collection(firestore, 'products');
    addDocumentNonBlocking(productsCollectionRef, { ...values, installationTypeId: values.installationTypeId || "" });
    
    toast({
      title: "Başarılı",
      description: "Yeni ürün başarıyla eklendi.",
    });
    form.reset();
    onProductAdded(); // Notify parent to refresh product list
    onOpenChange(false); // Close dialog
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] grid-rows-[auto,1fr,auto]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Hızlı Ürün Ekle</DialogTitle>
              <DialogDescription>
                Teklifinize eklemek için yeni bir ürün veya malzeme oluşturun.
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
  );
}

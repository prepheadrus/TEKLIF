
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { Material, Supplier } from '@/app/resources/page';

const materialSchema = z.object({
  name: z.string().min(2, "Malzeme adı en az 2 karakter olmalıdır."),
  unit: z.string().min(1, "Birim zorunludur."),
  basePrice: z.coerce.number().min(0, "Birim fiyat 0 veya daha büyük olmalıdır."),
  currency: z.enum(["TRY", "USD", "EUR"]),
  supplierId: z.string().min(1, "Tedarikçi seçimi zorunludur."),
  categoryName: z.string().optional(),
});

type MaterialFormValues = z.infer<typeof materialSchema>;

interface QuickAddMaterialProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    existingMaterial?: Material | null;
}

export function QuickAddMaterial({ isOpen, onOpenChange, onSuccess, existingMaterial }: QuickAddMaterialProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const suppliersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'suppliers')) : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers, refetch: refetchSuppliers } = useCollection<Supplier>(suppliersQuery);

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialSchema),
  });
  
  useEffect(() => {
    if (isOpen) {
        if (existingMaterial) {
            form.reset(existingMaterial);
        } else {
            form.reset({
                name: "",
                unit: "adet",
                basePrice: 0,
                currency: "TRY",
                supplierId: "",
                categoryName: "",
            });
        }
    }
  }, [isOpen, existingMaterial, form]);

  const onSubmit = async (values: MaterialFormValues) => {
    if (!firestore) {
      toast({ variant: "destructive", title: "Hata", description: "Veritabanı bağlantısı kurulamamış." });
      return;
    }
    
    try {
        if (existingMaterial) {
            const materialDocRef = doc(firestore, 'materials', existingMaterial.id);
            setDocumentNonBlocking(materialDocRef, values, { merge: true });
            toast({ title: "Başarılı", description: "Malzeme başarıyla güncellendi." });
        } else {
            const materialsCollectionRef = collection(firestore, 'materials');
            addDocumentNonBlocking(materialsCollectionRef, values);
            toast({ title: "Başarılı", description: "Yeni malzeme başarıyla eklendi." });
        }
        
        onSuccess(); // This refetches the materials list on the main page
        onOpenChange(false);
    } catch(error: any) {
         toast({ variant: "destructive", title: "Hata", description: `İşlem başarısız oldu: ${error.message}` });
    }
  };

  const isEditMode = !!existingMaterial;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] grid-rows-[auto,1fr,auto]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Malzemeyi Düzenle' : 'Yeni Malzeme Ekle'}</DialogTitle>
              <DialogDescription>
                 {isEditMode ? 'Malzeme bilgilerini güncelleyin.' : 'Sisteme yeni bir malzeme ekleyin.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Malzeme Adı</FormLabel><FormControl><Input placeholder="Örn: Siyah Çelik Boru 1 inç" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                
                <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                        <FormLabel>Tedarikçi</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger disabled={isLoadingSuppliers}>
                                <SelectValue placeholder={isLoadingSuppliers ? "Tedarikçiler yükleniyor..." : "Bir tedarikçi seçin"} />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {suppliers?.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField control={form.control} name="basePrice" render={({ field }) => (
                    <FormItem><FormLabel>Birim Alış Fiyatı (KDV Hariç)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
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
                    <FormItem><FormLabel>Birim</FormLabel><FormControl><Input placeholder="adet, metre, kg" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="categoryName" render={({ field }) => (
                    <FormItem><FormLabel>Tesisat Kategorisi (Opsiyonel)</FormLabel><FormControl><Input placeholder="Örn: Isıtma Vana Grubu" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Güncelle' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


'use client';

import { useEffect, useMemo } from 'react';
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
import { collection, doc } from 'firebase/firestore';
import type { Product, Supplier } from '@/app/products/products-client-page';
import { Separator } from '../ui/separator';

const productSchema = z.object({
  // Core Info
  code: z.string().min(1, "Kod zorunludur."),
  name: z.string().min(2, "Ad en az 2 karakter olmalıdır."),
  brand: z.string().min(1, "Marka zorunludur."),
  model: z.string().optional(),
  unit: z.string().min(1, "Birim zorunludur."),
  
  // Cost Info
  basePrice: z.coerce.number().min(0, "Maliyet fiyatı 0 veya daha büyük olmalıdır."),
  supplierId: z.string().optional().nullable(),
  
  // Sales Info
  listPrice: z.coerce.number().min(0, "Liste fiyatı 0'dan büyük olmalıdır."),
  currency: z.enum(["TRY", "USD", "EUR"]),
  discountRate: z.coerce.number().min(0).max(1, "İskonto oranı 0 ile 1 arasında olmalıdır."),
  
  // Categorization
  category: z.string().min(1, "Kategori zorunludur."),
  installationTypeId: z.string().optional().nullable(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface QuickAddProductProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onProductAdded?: () => void; // Renamed from onSuccess for clarity
    onSuccess?: () => void; // Keep for backward compatibility if needed
    existingProduct?: Product | null;
}

type InstallationType = {
    id: string;
    name: string;
    parentId?: string | null;
}

const buildCategoryTree = (categories: InstallationType[]): { id: string; name: string }[] => {
    const categoryMap: { [id: string]: { id: string; name: string; children: any[] } } = {};
    if (categories) {
        categories.forEach(cat => {
            categoryMap[cat.id] = { ...cat, children: [] };
        });
    }

    const roots: { id: string; name: string; children: any[] }[] = [];
    if (categories) {
        categories.forEach(cat => {
            if (cat.parentId && categoryMap[cat.parentId]) {
                categoryMap[cat.parentId].children.push(categoryMap[cat.id]);
            } else {
                roots.push(categoryMap[cat.id]);
            }
        });
    }

    const flattenedList: { id: string; name: string }[] = [];
    const traverse = (node: { id: string; name: string; children: any[] }, prefix: string) => {
        const currentName = prefix ? `${prefix} > ${node.name}` : node.name;
        flattenedList.push({ id: node.id, name: currentName });
        node.children.sort((a, b) => a.name.localeCompare(b.name)).forEach(child => traverse(child, currentName));
    };

    roots.sort((a, b) => a.name.localeCompare(b.name)).forEach(root => traverse(root, ''));
    return flattenedList;
};

export function QuickAddProduct({ isOpen, onOpenChange, onSuccess, onProductAdded, existingProduct }: QuickAddProductProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const installationTypesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'installation_types') : null),
    [firestore]
  );
  const { data: installationTypes, isLoading: isLoadingInstallationTypes } = useCollection<InstallationType>(installationTypesRef);
  
  const suppliersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);

  const hierarchicalCategories = useMemo(() => {
    if (!installationTypes) return [];
    return buildCategoryTree(installationTypes);
  }, [installationTypes]);


  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  });
  
  useEffect(() => {
    if (isOpen) {
        if (existingProduct) {
            form.reset({
                ...existingProduct,
                installationTypeId: existingProduct.installationTypeId || null,
                supplierId: existingProduct.supplierId || null,
            });
        } else {
            form.reset({
                code: "", name: "", brand: "", model: "", category: "Genel", installationTypeId: null, unit: "Adet",
                listPrice: 0, currency: "TRY", discountRate: 0, basePrice: 0, supplierId: null,
            });
        }
    }
  }, [isOpen, existingProduct, form]);

  const onSubmit = async (values: ProductFormValues) => {
    if (!firestore) {
      toast({ variant: "destructive", title: "Hata", description: "Veritabanı bağlantısı kurulamamış." });
      return;
    }
    
    const dataToSave = { 
        ...values, 
        installationTypeId: values.installationTypeId || null,
        supplierId: values.supplierId || null,
    };
    
    try {
        if (existingProduct) {
            const productDocRef = doc(firestore, 'products', existingProduct.id);
            setDocumentNonBlocking(productDocRef, dataToSave, { merge: true });
            toast({ title: "Başarılı", description: "Ürün başarıyla güncellendi." });
        } else {
            const productsCollectionRef = collection(firestore, 'products');
            addDocumentNonBlocking(productsCollectionRef, dataToSave);
            toast({ title: "Başarılı", description: "Yeni ürün başarıyla eklendi." });
        }
        
        onSuccess?.();
        onProductAdded?.();
        onOpenChange(false);
    } catch(error: any) {
         toast({ variant: "destructive", title: "Hata", description: `İşlem başarısız oldu: ${error.message}` });
    }
  };

  const isEditMode = !!existingProduct;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl grid-rows-[auto,1fr,auto]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Ürünü Düzenle' : 'Yeni Ürün/Malzeme Ekle'}</DialogTitle>
              <DialogDescription>
                 {isEditMode ? 'Ürün bilgilerini güncelleyin.' : 'Sisteme yeni bir ürün, malzeme veya hizmet ekleyin.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 py-4 max-h-[60vh] overflow-y-auto px-1">
                <h4 className="md:col-span-2 text-lg font-semibold text-primary border-b pb-2 mb-2">Genel Bilgiler</h4>
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Ad</FormLabel><FormControl><Input placeholder="Duvar Tipi Yoğuşmalı Kazan 50 kW" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem><FormLabel>Kod</FormLabel><FormControl><Input placeholder="WS-YK-50" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem><FormLabel>Birim</FormLabel><FormControl><Input placeholder="Adet" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="brand" render={({ field }) => (
                    <FormItem><FormLabel>Marka</FormLabel><FormControl><Input placeholder="Warmhaus" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="model" render={({ field }) => (
                    <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="Ewa 50" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
               
                <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem><FormLabel>Genel Kategori</FormLabel><FormControl><Input placeholder="Kazan" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField
                    control={form.control}
                    name="installationTypeId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Tesisat Kategorisi (Opsiyonel)</FormLabel>
                        <Select 
                            onValueChange={(value) => field.onChange(value === "null" ? null : value)} 
                            value={field.value ?? ""}
                        >
                            <FormControl>
                            <SelectTrigger disabled={isLoadingInstallationTypes}>
                                <SelectValue placeholder={isLoadingInstallationTypes ? "Kategoriler yükleniyor..." : "Bir tesisat kategorisi seçin"} />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="null">Kategori Yok</SelectItem>
                                {hierarchicalCategories.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>
                                        {type.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <Separator className="md:col-span-2 my-4" />
                <h4 className="md:col-span-2 text-lg font-semibold text-primary border-b pb-2 mb-2">Maliyet Bilgileri</h4>
                <FormField control={form.control} name="basePrice" render={({ field }) => (
                    <FormItem><FormLabel>Birim Alış Fiyatı (KDV Hariç)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Tedarikçi</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "null" ? null : value)} value={field.value ?? ""}>
                            <FormControl>
                            <SelectTrigger disabled={isLoadingSuppliers}>
                                <SelectValue placeholder={isLoadingSuppliers ? "Yükleniyor..." : "Tedarikçi seçin"} />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="null">Tedarikçi Yok</SelectItem>
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

                <Separator className="md:col-span-2 my-4" />
                <h4 className="md:col-span-2 text-lg font-semibold text-primary border-b pb-2 mb-2">Satış Bilgileri</h4>

                <FormField control={form.control} name="listPrice" render={({ field }) => (
                    <FormItem><FormLabel>Birim Liste Satış Fiyatı</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem><FormLabel>Para Birimi</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="TRY">TL</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                        </Select>
                    <FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="discountRate" render={({ field }) => (
                    <FormItem><FormLabel>Genel İskonto Oranı (%15 için 0.15)</FormLabel><FormControl><Input type="number" step="0.01" min="0" max="1" {...field} /></FormControl><FormMessage /></FormItem>
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

    
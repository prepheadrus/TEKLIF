
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

const productSchema = z.object({
  code: z.string().min(1, "Kod zorunludur."),
  name: z.string().min(2, "Ad en az 2 karakter olmalıdır."),
  brand: z.string().min(1, "Marka zorunludur."),
  category: z.string().min(1, "Kategori zorunludur."),
  installationTypeId: z.string().optional().nullable(),
  unit: z.string().min(1, "Birim zorunludur."),
  listPrice: z.coerce.number().min(0, "Liste fiyatı 0'dan büyük olmalıdır."),
  currency: z.enum(["TRY", "USD", "EUR"]),
  discountRate: z.coerce.number().min(0).max(1, "İskonto oranı 0 ile 1 arasında olmalıdır."),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface QuickAddProductProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    existingProduct?: ProductFormValues & { id: string } | null;
}

type InstallationType = {
    id: string;
    name: string;
    parentId?: string | null;
}

const buildCategoryTree = (categories: InstallationType[]): { id: string; name: string }[] => {
    const categoryMap: { [id: string]: { id: string; name: string; children: any[] } } = {};
    categories.forEach(cat => {
        categoryMap[cat.id] = { ...cat, children: [] };
    });

    const roots: { id: string; name: string; children: any[] }[] = [];
    categories.forEach(cat => {
        if (cat.parentId && categoryMap[cat.parentId]) {
            categoryMap[cat.parentId].children.push(categoryMap[cat.id]);
        } else {
            roots.push(categoryMap[cat.id]);
        }
    });

    const flattenedList: { id: string; name: string }[] = [];
    const traverse = (node: { id: string; name: string; children: any[] }, prefix: string) => {
        const currentName = prefix ? `${prefix} > ${node.name}` : node.name;
        flattenedList.push({ id: node.id, name: currentName });
        node.children.sort((a, b) => a.name.localeCompare(b.name)).forEach(child => traverse(child, currentName));
    };

    roots.sort((a, b) => a.name.localeCompare(b.name)).forEach(root => traverse(root, ''));
    return flattenedList;
};

export function QuickAddProduct({ isOpen, onOpenChange, onSuccess, existingProduct }: QuickAddProductProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const installationTypesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'installation_types') : null),
    [firestore]
  );
  const { data: installationTypes, isLoading: isLoadingInstallationTypes } = useCollection<InstallationType>(installationTypesRef);

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
            });
        } else {
            form.reset({
                code: "", name: "", brand: "", category: "", installationTypeId: null, unit: "Adet",
                listPrice: 0, currency: "TRY", discountRate: 0,
            });
        }
    }
  }, [isOpen, existingProduct, form]);

  const onSubmit = async (values: ProductFormValues) => {
    if (!firestore) {
      toast({ variant: "destructive", title: "Hata", description: "Veritabanı bağlantısı kurulamamış." });
      return;
    }
    
    const dataToSave = { ...values, installationTypeId: values.installationTypeId || null };
    
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
        
        onSuccess();
        onOpenChange(false);
    } catch(error: any) {
         toast({ variant: "destructive", title: "Hata", description: `İşlem başarısız oldu: ${error.message}` });
    }
  };

  const isEditMode = !!existingProduct;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] grid-rows-[auto,1fr,auto]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</DialogTitle>
              <DialogDescription>
                 {isEditMode ? 'Ürün bilgilerini güncelleyin.' : 'Sisteme yeni bir ürün veya malzeme ekleyin.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
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
                    <FormItem><FormLabel>Genel Kategori</FormLabel><FormControl><Input placeholder="Pompa" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField
                    control={form.control}
                    name="installationTypeId"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                        <FormLabel>Tesisat Kategorisi</FormLabel>
                        <Select 
                            onValueChange={(value) => field.onChange(value)} 
                            value={field.value ?? ''}
                        >
                            <FormControl>
                            <SelectTrigger disabled={isLoadingInstallationTypes}>
                                <SelectValue placeholder={isLoadingInstallationTypes ? "Kategoriler yükleniyor..." : "Bir tesisat kategorisi seçin (isteğe bağlı)"} />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
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

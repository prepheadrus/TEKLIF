
'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Product, Supplier } from '@/app/products/products-client-page';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';

const productSchema = z.object({
  // Core Info
  code: z.string().min(1, "Kod zorunludur."),
  name: z.string().min(2, "Ad en az 2 karakter olmalıdır."),
  brand: z.string().min(1, "Marka zorunludur."),
  model: z.string().optional(),
  unit: z.string().min(1, "Birim zorunludur."),
  
  // Cost Info
  listPrice: z.coerce.number().min(0, "Liste fiyatı 0 veya daha büyük olmalıdır."),
  discountRate: z.coerce.number().min(0).max(1, "İskonto oranı 0 ile 100 arasında olmalıdır."),
  basePrice: z.coerce.number().min(0, "Maliyet fiyatı 0 veya daha büyük olmalıdır."),
  supplierId: z.string().optional().nullable(),
  
  // Sales Info - Satış fiyatı artık formda bir alan değil, hesaplanacak.
  currency: z.enum(["TRY", "USD", "EUR"]),
  
  // Categorization
  category: z.string().min(1, "Kategori zorunludur."),
  installationTypeId: z.string().optional().nullable(),

  // VAT Info
  priceIncludesVat: z.boolean().default(false),
  vatRate: z.coerce.number().min(0).max(1),

  // Detailed Info
  description: z.string().optional(),
  technicalSpecifications: z.string().optional(),
  brochureUrl: z.string().url("Geçerli bir URL girin.").optional().or(z.literal('')),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface QuickAddProductProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    existingProduct?: Product | null;
}

type InstallationType = {
    id: string;
    name: string;
    parentId?: string | null;
}

const buildCategoryTree = (categories: InstallationType[]): { id: string; name: string }[] => {
    if (!categories) return [];

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
        node.children.sort((a, b) => a.name.localeCompare(b.name, 'tr')).forEach(child => traverse(child, currentName));
    };

    roots.sort((a, b) => a.name.localeCompare(b.name, 'tr')).forEach(root => traverse(root, ''));
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
  
  // Watch for changes in listPrice and discountRate to calculate basePrice
  const watchedListPrice = form.watch('listPrice');
  const watchedDiscountRate = form.watch('discountRate');

  useEffect(() => {
    const listPrice = !isNaN(watchedListPrice) ? watchedListPrice : 0;
    const discountRate = !isNaN(watchedDiscountRate) ? watchedDiscountRate : 0;
    const calculatedBasePrice = listPrice * (1 - discountRate);
    form.setValue('basePrice', parseFloat(calculatedBasePrice.toFixed(2)));
  }, [watchedListPrice, watchedDiscountRate, form]);


  useEffect(() => {
    if (isOpen) {
        if (existingProduct) {
            form.reset({
                ...existingProduct,
                discountRate: existingProduct.discountRate ?? 0,
                description: existingProduct.description || '',
                technicalSpecifications: existingProduct.technicalSpecifications || '',
                installationTypeId: existingProduct.installationTypeId || null,
                supplierId: existingProduct.supplierId || null,
                brochureUrl: existingProduct.brochureUrl || '',
                vatRate: existingProduct.vatRate ?? 0.20,
                priceIncludesVat: existingProduct.priceIncludesVat ?? false
            });
        } else {
            form.reset({
                code: "", name: "", brand: "", model: "", category: "Genel", installationTypeId: null, unit: "Adet",
                listPrice: 0, currency: "TRY", discountRate: 0, basePrice: 0, supplierId: null,
                description: "", technicalSpecifications: "", brochureUrl: "",
                vatRate: 0.20, priceIncludesVat: false
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
        description: values.description || null,
        technicalSpecifications: values.technicalSpecifications || null,
        brochureUrl: values.brochureUrl || null,
        model: values.model || null,
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
        onOpenChange(false);
    } catch(error: any) {
         toast({ variant: "destructive", title: "Hata", description: `İşlem başarısız oldu: ${error.message}` });
    }
  };

  const isEditMode = !!existingProduct;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Ürünü Düzenle' : 'Yeni Ürün/Malzeme Ekle'}</DialogTitle>
          <DialogDescription>
             {isEditMode ? 'Ürün bilgilerini güncelleyin.' : 'Sisteme yeni bir ürün, malzeme veya hizmet ekleyin.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto pr-2">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 py-4 px-1">
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
                <h4 className="md:col-span-2 text-lg font-semibold text-primary border-b pb-2 mb-2">Maliyet ve Fiyat Bilgileri</h4>
                
                <div className="md:col-span-2 flex items-center space-x-2">
                    <FormField control={form.control} name="priceIncludesVat" render={({ field }) => (
                         <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="!mt-0">
                                Girdiğim Fiyatlara KDV Dahil
                            </FormLabel>
                        </FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="vatRate" render={({ field }) => (
                    <FormItem><FormLabel>KDV Oranı</FormLabel>
                        <Select onValueChange={(val) => field.onChange(parseFloat(val))} value={String(field.value)}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="0.20">%20</SelectItem>
                                <SelectItem value="0.10">%10</SelectItem>
                                <SelectItem value="0.01">%1</SelectItem>
                                <SelectItem value="0">KDV'siz</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
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
                
                <FormField control={form.control} name="listPrice" render={({ field }) => (
                    <FormItem><FormLabel>Liste Fiyatı (Tedarikçi)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Controller
                    control={form.control}
                    name="discountRate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>İskonto Oranı (%)</FormLabel>
                        <FormControl>
                            <Input
                            type="number"
                            placeholder="15"
                            value={(field.value || 0) * 100}
                            onChange={(e) => {
                                const numValue = parseFloat(e.target.value);
                                field.onChange(isNaN(numValue) ? 0 : numValue / 100);
                            }}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField control={form.control} name="basePrice" render={({ field }) => (
                    <FormItem><FormLabel>Birim Maliyet (Hesaplanan)</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>
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
                 <h4 className="md:col-span-2 text-lg font-semibold text-primary border-b pb-2 mb-2">Detaylı Bilgiler</h4>
                 
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Açıklama</FormLabel><FormControl><Textarea placeholder="Ürünle ilgili genel açıklamalar, kullanım alanları vb." {...field} /></FormControl><FormMessage /></FormItem>
                 )} />
                 <FormField control={form.control} name="technicalSpecifications" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Teknik Özellikler</FormLabel><FormControl><Textarea placeholder="Kapasite: 50 kW, Verim: %109, Ağırlık: 45 kg..." {...field} /></FormControl><FormMessage /></FormItem>
                 )} />
                 <FormField control={form.control} name="brochureUrl" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Broşür/Döküman Linki</FormLabel><FormControl><Input type="url" placeholder="https://example.com/urun-brosuru.pdf" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            
            <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background py-4">
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

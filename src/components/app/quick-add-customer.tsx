
'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { availableTags } from '@/lib/tags';
import { Separator } from '../ui/separator';

const customerSchema = z.object({
  name: z.string().min(2, "Müşteri adı en az 2 karakter olmalıdır."),
  email: z.string().email("Geçerli bir e-posta adresi girin."),
  phone: z.string().optional(),
  address: z.object({
    addressLine1: z.string().optional(),
    district: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  city: z.string().optional(),
  taxNumber: z.string().optional(),
  status: z.enum(['Aktif', 'Pasif']),
  tags: z.array(z.string()).default([]),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: {
    addressLine1?: string;
    district?: string;
    postalCode?: string;
  };
  city?: string;
  taxNumber?: string;
  status: 'Aktif' | 'Pasif';
  tags?: string[];
};

interface QuickAddCustomerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onCustomerAdded: () => void;
    existingCustomer?: Customer | null;
}

const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    if (phoneNumberLength < 11) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)} ${phoneNumber.slice(6, 8)} ${phoneNumber.slice(8)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)} ${phoneNumber.slice(6, 8)} ${phoneNumber.slice(8, 10)}`;
};


export function QuickAddCustomer({ isOpen, onOpenChange, onCustomerAdded, existingCustomer }: QuickAddCustomerProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
        name: "",
        email: "",
        phone: "",
        address: {
            addressLine1: "",
            district: "",
            postalCode: "",
        },
        city: "",
        taxNumber: "",
        status: 'Aktif',
        tags: [],
    }
  });

  const isEditMode = !!existingCustomer;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        form.reset({
          name: existingCustomer.name || "",
          email: existingCustomer.email || "",
          phone: existingCustomer.phone || "",
          address: {
            addressLine1: existingCustomer.address?.addressLine1 || "",
            district: existingCustomer.address?.district || "",
            postalCode: existingCustomer.address?.postalCode || "",
          },
          city: existingCustomer.city || "",
          taxNumber: existingCustomer.taxNumber || "",
          status: existingCustomer.status || 'Aktif',
          tags: existingCustomer.tags || [],
        });
      } else {
        form.reset({
          name: "",
          email: "",
          phone: "",
          address: {
            addressLine1: "",
            district: "",
            postalCode: "",
          },
          city: "",
          taxNumber: "",
          status: 'Aktif',
          tags: [],
        });
      }
    }
  }, [isOpen, existingCustomer, isEditMode, form]);

  const onSubmit = async (values: CustomerFormValues) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Veritabanı bağlantısı kurulamamış.",
      });
      return;
    }
    
    try {
      if (isEditMode) {
        const customerDocRef = doc(firestore, 'customers', existingCustomer.id);
        setDocumentNonBlocking(customerDocRef, values, { merge: true });
        toast({
          title: "Başarılı",
          description: "Müşteri bilgileri güncellendi.",
        });
      } else {
        const customersCollectionRef = collection(firestore, 'customers');
        addDocumentNonBlocking(customersCollectionRef, values);
        toast({
          title: "Başarılı",
          description: "Yeni müşteri başarıyla eklendi.",
        });
      }
      form.reset();
      onCustomerAdded();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: `İşlem sırasında bir hata oluştu: ${error.message}`,
      });
    }
  };
  
  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhoneNumber = formatPhoneNumber(event.target.value);
    form.setValue('phone', formattedPhoneNumber);
  };

  const dialogTitle = isEditMode ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle';
  const dialogDescription = isEditMode ? 'Müşteri bilgilerini güncelleyin.' : 'Sisteminize yeni bir müşteri kaydedin.';
  const buttonText = isEditMode ? 'Güncelle' : 'Kaydet';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Müşteri Adı / Firma Unvanı</FormLabel><FormControl><Input placeholder="Örn: ABC İnşaat A.Ş." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>E-posta Adresi</FormLabel><FormControl><Input type="email" placeholder="iletisim@abcinşaat.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Telefon Numarası</FormLabel>
                        <FormControl>
                            <Input 
                                type="tel" 
                                placeholder="(5xx) xxx xx xx" 
                                {...field} 
                                onChange={handlePhoneChange}
                                maxLength={15}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="taxNumber" render={({ field }) => (
                    <FormItem><FormLabel>Vergi No / TCKN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Durum</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Aktif">Aktif</SelectItem>
                                <SelectItem value="Pasif">Pasif</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <Separator className="md:col-span-2 my-2" />
                 <h3 className="md:col-span-2 font-medium">Adres Bilgileri</h3>
                
                <FormField control={form.control} name="address.addressLine1" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Adres Satırı</FormLabel><FormControl><Input placeholder="Örn: Örnek Mah. Test Cad. No:1 D:2" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>Şehir</FormLabel><FormControl><Input placeholder="Ankara" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address.district" render={({ field }) => (
                    <FormItem><FormLabel>İlçe</FormLabel><FormControl><Input placeholder="Çankaya" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address.postalCode" render={({ field }) => (
                    <FormItem><FormLabel>Posta Kodu</FormLabel><FormControl><Input placeholder="06500" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                
                <Separator className="md:col-span-2 my-2" />
                
                 <FormField
                    control={form.control}
                    name="tags"
                    render={() => (
                        <FormItem className="md:col-span-2">
                        <div className="mb-4">
                            <FormLabel className="text-base">Etiketler</FormLabel>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {availableTags.map((tag) => (
                            <FormField
                                key={tag.id}
                                control={form.control}
                                name="tags"
                                render={({ field }) => {
                                return (
                                    <FormItem
                                        key={tag.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(tag.id)}
                                            onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...(field.value || []), tag.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                    (value) => value !== tag.id
                                                    )
                                                )
                                            }}
                                        />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                            {tag.name}
                                        </FormLabel>
                                    </FormItem>
                                )
                                }}
                            />
                            ))}
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">İptal</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {buttonText}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

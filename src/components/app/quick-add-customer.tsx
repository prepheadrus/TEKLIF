
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
  email: z.string().email("Geçerli bir e-posta adresi girin.").optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.object({
    city: z.string().optional(),
    district: z.string().optional(),
    neighborhood: z.string().optional(),
    street: z.string().optional(),
    buildingName: z.string().optional(),
    buildingNumber: z.string().optional(),
    apartmentNumber: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  taxNumber: z.string().optional(),
  status: z.enum(['Aktif', 'Pasif']),
  tags: z.array(z.string()).default([]),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: {
    city?: string;
    district?: string;
    neighborhood?: string;
    street?: string;
    buildingName?: string;
    buildingNumber?: string;
    apartmentNumber?: string;
    postalCode?: string;
  };
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
            city: "",
            district: "",
            neighborhood: "",
            street: "",
            buildingName: "",
            buildingNumber: "",
            apartmentNumber: "",
            postalCode: "",
        },
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
            city: existingCustomer.address?.city || "",
            district: existingCustomer.address?.district || "",
            neighborhood: existingCustomer.address?.neighborhood || "",
            street: existingCustomer.address?.street || "",
            buildingName: existingCustomer.address?.buildingName || "",
            buildingNumber: existingCustomer.address?.buildingNumber || "",
            apartmentNumber: existingCustomer.address?.apartmentNumber || "",
            postalCode: existingCustomer.address?.postalCode || "",
          },
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
            city: "",
            district: "",
            neighborhood: "",
            street: "",
            buildingName: "",
            buildingNumber: "",
            apartmentNumber: "",
            postalCode: "",
          },
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
      <DialogContent className="sm:max-w-[700px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                <div className="space-y-2">
                    <h3 className="font-medium text-lg">Genel Bilgiler</h3>
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Müşteri Adı / Firma Unvanı</FormLabel><FormControl><Input placeholder="Örn: ABC İnşaat A.Ş." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                     <div className="grid grid-cols-2 gap-4">
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
                     </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                    <h3 className="font-medium text-lg">Adres Bilgileri</h3>
                     <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="address.city" render={({ field }) => (
                            <FormItem><FormLabel>Şehir</FormLabel><FormControl><Input placeholder="Ankara" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="address.district" render={({ field }) => (
                            <FormItem><FormLabel>İlçe</FormLabel><FormControl><Input placeholder="Çankaya" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                     <FormField control={form.control} name="address.neighborhood" render={({ field }) => (
                        <FormItem><FormLabel>Mahalle</FormLabel><FormControl><Input placeholder="Kavaklıdere Mah." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="address.street" render={({ field }) => (
                        <FormItem><FormLabel>Cadde</FormLabel><FormControl><Input placeholder="Atatürk Blv." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="address.buildingName" render={({ field }) => (
                            <FormItem><FormLabel>Site/Apt. Adı</FormLabel><FormControl><Input placeholder="Çankaya Apt." {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="address.buildingNumber" render={({ field }) => (
                            <FormItem><FormLabel>Bina No</FormLabel><FormControl><Input placeholder="123" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="address.apartmentNumber" render={({ field }) => (
                            <FormItem><FormLabel>Daire No</FormLabel><FormControl><Input placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                     <FormField control={form.control} name="address.postalCode" render={({ field }) => (
                        <FormItem className="w-1/3"><FormLabel>Posta Kodu</FormLabel><FormControl><Input placeholder="06500" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                
                <Separator className="my-4" />
                
                 <FormField
                    control={form.control}
                    name="tags"
                    render={() => (
                        <FormItem>
                        <div className="mb-2">
                            <FormLabel className="font-medium text-lg">Etiketler</FormLabel>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
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
                                        <FormLabel className="font-normal text-sm">
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

    
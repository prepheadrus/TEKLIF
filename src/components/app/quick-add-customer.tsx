'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';

const customerSchema = z.object({
  name: z.string().min(2, "Müşteri adı en az 2 karakter olmalıdır."),
  email: z.string().email("Geçerli bir e-posta adresi girin."),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface QuickAddCustomerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onCustomerAdded: () => void;
}

export function QuickAddCustomer({ isOpen, onOpenChange, onCustomerAdded }: QuickAddCustomerProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      taxNumber: "",
    },
  });

  const onSubmit = async (values: CustomerFormValues) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Veritabanı bağlantısı kurulamamış.",
      });
      return;
    }
    
    const customersCollectionRef = collection(firestore, 'customers');
    addDocumentNonBlocking(customersCollectionRef, values);
    
    toast({
      title: "Başarılı",
      description: "Yeni müşteri başarıyla eklendi.",
    });
    form.reset();
    onCustomerAdded();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Yeni Müşteri Ekle</DialogTitle>
              <DialogDescription>
                Sisteminize yeni bir müşteri kaydedin.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Müşteri Adı / Firma Unvanı</FormLabel><FormControl><Input placeholder="Örn: ABC İnşaat A.Ş." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>E-posta Adresi</FormLabel><FormControl><Input placeholder="iletisim@abcinşaat.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Telefon Numarası</FormLabel><FormControl><Input placeholder="(5xx) xxx xx xx" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="taxNumber" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Vergi Numarası / T.C. Kimlik No</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Adres</FormLabel><FormControl><Textarea placeholder="Müşteri adresi..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">İptal</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Müşteriyi Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

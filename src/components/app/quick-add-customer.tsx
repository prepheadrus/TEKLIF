
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
import { Loader2, MessageSquare, Phone, Mail, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { availableTags } from '@/lib/tags';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { getAvatarFallback } from '@/lib/placeholder-images';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

// --- Zod Schemas ---
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

const interactionSchema = z.object({
    content: z.string().min(1, "Not içeriği boş olamaz."),
    interactionType: z.array(z.string()).default([]),
})

// --- Type Definitions ---
type CustomerFormValues = z.infer<typeof customerSchema>;
type InteractionFormValues = z.infer<typeof interactionSchema>;

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

type CustomerInteraction = {
    id: string;
    content: string;
    type: 'note' | 'email' | 'phone';
    authorName: string;
    createdAt: { seconds: number };
}

interface QuickAddCustomerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onCustomerAdded: () => void;
    existingCustomer?: Customer | null;
}

// --- Helper Functions & Components ---
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

const InteractionIcon = ({ type }: { type: CustomerInteraction['type'] }) => {
    switch (type) {
        case 'email': return <Mail className="w-4 h-4 text-blue-500" />;
        case 'phone': return <Phone className="w-4 h-4 text-green-500" />;
        case 'note':
        default: return <MessageSquare className="w-4 h-4 text-slate-500" />;
    }
}

// --- Main Component ---
export function QuickAddCustomer({ isOpen, onOpenChange, onCustomerAdded, existingCustomer }: QuickAddCustomerProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isSubmittingInteraction, setIsSubmittingInteraction] = useState(false);

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { status: 'Aktif', tags: [], address: {} }
  });

  const interactionForm = useForm<InteractionFormValues>({
    resolver: zodResolver(interactionSchema),
    defaultValues: { content: "", interactionType: [] }
  })

  const isEditMode = !!existingCustomer;

  // --- Data Fetching for Interactions ---
  const interactionsQuery = useMemoFirebase(
    () => (firestore && isEditMode) ? query(collection(firestore, 'customers', existingCustomer.id, 'interactions'), orderBy('createdAt', 'desc')) : null,
    [firestore, isEditMode, existingCustomer]
  );
  const { data: interactions, isLoading: isLoadingInteractions } = useCollection<CustomerInteraction>(interactionsQuery);

  // --- Effects ---
  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        customerForm.reset({
          name: existingCustomer.name || "",
          email: existingCustomer.email || "",
          phone: existingCustomer.phone || "",
          address: existingCustomer.address || {},
          taxNumber: existingCustomer.taxNumber || "",
          status: existingCustomer.status || 'Aktif',
          tags: existingCustomer.tags || [],
        });
      } else {
        customerForm.reset({
          name: "", email: "", phone: "",
          address: { city: "", district: "", neighborhood: "", street: "", buildingName: "", buildingNumber: "", apartmentNumber: "", postalCode: "" },
          taxNumber: "", status: 'Aktif', tags: [],
        });
      }
      interactionForm.reset();
    }
  }, [isOpen, existingCustomer, isEditMode, customerForm, interactionForm]);

  // --- Handlers ---
  const onCustomerSubmit = async (values: CustomerFormValues) => {
    if (!firestore) {
      toast({ variant: "destructive", title: "Hata", description: "Veritabanı bağlantısı kurulamamış." });
      return;
    }
    
    try {
      if (isEditMode) {
        const customerDocRef = doc(firestore, 'customers', existingCustomer.id);
        setDocumentNonBlocking(customerDocRef, values, { merge: true });
        toast({ title: "Başarılı", description: "Müşteri bilgileri güncellendi." });
      } else {
        const customersCollectionRef = collection(firestore, 'customers');
        addDocumentNonBlocking(customersCollectionRef, values);
        toast({ title: "Başarılı", description: "Yeni müşteri başarıyla eklendi." });
      }
      customerForm.reset();
      onCustomerAdded();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Hata", description: `İşlem sırasında bir hata oluştu: ${error.message}` });
    }
  };
  
  const onInteractionSubmit = async (values: InteractionFormValues) => {
    if (!firestore || !isEditMode || !user) return;
    setIsSubmittingInteraction(true);

    const interactionTypes = values.interactionType;
    let type: CustomerInteraction['type'] = 'note';
    if(interactionTypes.includes('email')) type = 'email';
    else if(interactionTypes.includes('phone')) type = 'phone';

    try {
        const interactionCollectionRef = collection(firestore, 'customers', existingCustomer.id, 'interactions');
        const newInteraction = {
            customerId: existingCustomer.id,
            content: values.content,
            type: type,
            authorId: user.uid,
            authorName: user.displayName || user.email || 'Anonim Kullanıcı',
            createdAt: serverTimestamp(),
        };
        addDocumentNonBlocking(interactionCollectionRef, newInteraction);
        interactionForm.reset();
        toast({ title: 'Not Eklendi', description: 'Etkileşim geçmişe kaydedildi.' });
    } catch (error: any) {
         toast({ variant: "destructive", title: "Hata", description: `Not eklenemedi: ${error.message}` });
    } finally {
        setIsSubmittingInteraction(false);
    }
  }

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhoneNumber = formatPhoneNumber(event.target.value);
    customerForm.setValue('phone', formattedPhoneNumber);
  };

  const dialogTitle = isEditMode ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle';
  const dialogDescription = isEditMode ? 'Müşteri bilgilerini ve etkileşim geçmişini yönetin.' : 'Sisteminize yeni bir müşteri kaydedin.';
  const buttonText = isEditMode ? 'Değişiklikleri Kaydet' : 'Müşteriyi Kaydet';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 grid md:grid-cols-2 gap-0 border-t overflow-hidden">
            {/* Customer Form Part */}
            <ScrollArea className="md:border-r">
                <Form {...customerForm}>
                    <form onSubmit={customerForm.handleSubmit(onCustomerSubmit)} className="space-y-4 p-6">
                        <div className="space-y-4">
                            <h3 className="font-medium text-lg">Genel Bilgiler</h3>
                            <FormField control={customerForm.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Müşteri Adı / Firma Unvanı</FormLabel><FormControl><Input placeholder="Örn: ABC İnşaat A.Ş." {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={customerForm.control} name="email" render={({ field }) => (
                                    <FormItem><FormLabel>E-posta Adresi</FormLabel><FormControl><Input type="email" placeholder="iletisim@abcinşaat.com" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={customerForm.control} name="phone" render={({ field }) => (
                                    <FormItem><FormLabel>Telefon Numarası</FormLabel><FormControl><Input type="tel" placeholder="(5xx) xxx xx xx" {...field} onChange={handlePhoneChange} maxLength={15} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={customerForm.control} name="taxNumber" render={({ field }) => (
                                    <FormItem><FormLabel>Vergi No / TCKN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={customerForm.control} name="status" render={({ field }) => (
                                    <FormItem><FormLabel>Durum</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent><SelectItem value="Aktif">Aktif</SelectItem><SelectItem value="Pasif">Pasif</SelectItem></SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                        <Separator className="my-6" />
                        <div className="space-y-4">
                            <h3 className="font-medium text-lg">Adres Bilgileri</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={customerForm.control} name="address.city" render={({ field }) => (<FormItem><FormLabel>Şehir</FormLabel><FormControl><Input placeholder="Ankara" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={customerForm.control} name="address.district" render={({ field }) => (<FormItem><FormLabel>İlçe</FormLabel><FormControl><Input placeholder="Çankaya" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={customerForm.control} name="address.neighborhood" render={({ field }) => (<FormItem><FormLabel>Mahalle</FormLabel><FormControl><Input placeholder="Kavaklıdere Mah." {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={customerForm.control} name="address.street" render={({ field }) => (<FormItem><FormLabel>Cadde/Sokak</FormLabel><FormControl><Input placeholder="Atatürk Blv." {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-3 gap-4">
                                <FormField control={customerForm.control} name="address.buildingName" render={({ field }) => (<FormItem><FormLabel>Site/Apt. Adı</FormLabel><FormControl><Input placeholder="Çankaya Apt." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={customerForm.control} name="address.buildingNumber" render={({ field }) => (<FormItem><FormLabel>Bina No</FormLabel><FormControl><Input placeholder="123" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={customerForm.control} name="address.apartmentNumber" render={({ field }) => (<FormItem><FormLabel>Daire No</FormLabel><FormControl><Input placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                        <Separator className="my-6" />
                        <FormField control={customerForm.control} name="tags" render={() => (
                            <FormItem>
                                <div className="mb-4"><FormLabel className="font-medium text-lg">Etiketler</FormLabel></div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                                    {availableTags.map((tag) => (
                                    <FormField key={tag.id} control={customerForm.control} name="tags" render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl><Checkbox checked={field.value?.includes(tag.id)} onCheckedChange={(checked) => {
                                                return checked ? field.onChange([...(field.value || []), tag.id]) : field.onChange(field.value?.filter((value) => value !== tag.id))
                                            }} /></FormControl>
                                            <FormLabel className="font-normal text-sm">{tag.name}</FormLabel>
                                        </FormItem>
                                    )} />
                                    ))}
                                </div><FormMessage />
                            </FormItem>
                        )} />
                    </form>
                </Form>
            </ScrollArea>
            {/* Interaction History Part */}
            <div className="flex flex-col bg-slate-50 dark:bg-slate-900/50">
                <div className="p-6 border-b">
                    <h3 className="font-medium text-lg mb-4">Etkileşim Geçmişi</h3>
                    {isEditMode ? (
                        <Form {...interactionForm}>
                            <form onSubmit={interactionForm.handleSubmit(onInteractionSubmit)} className="space-y-3">
                                 <FormField control={interactionForm.control} name="content" render={({ field }) => (
                                    <FormItem><FormLabel className="sr-only">Not İçeriği</FormLabel>
                                        <FormControl><Textarea placeholder="Yeni bir not veya etkileşim ekleyin..." {...field} className="min-h-[80px]"/>
                                        </FormControl><FormMessage />
                                    </FormItem>
                                 )} />
                                <div className="flex justify-between items-center">
                                    <FormField control={interactionForm.control} name="interactionType" render={() => (
                                        <FormItem className="flex items-center gap-4">
                                            {[ {id: "email", label: "E-posta"}, {id: "phone", label: "Telefon"} ].map((item) => (
                                                <FormField key={item.id} control={interactionForm.control} name="interactionType" render={({ field }) => (
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => {
                                                            const newValue = checked ? [item.id] : [];
                                                            field.onChange(newValue);
                                                        }} /></FormControl>
                                                        <FormLabel className="text-sm font-normal">{item.label}</FormLabel>
                                                    </FormItem>
                                                )} />
                                            ))}
                                        </FormItem>
                                    )} />
                                    <Button type="submit" size="sm" disabled={isSubmittingInteraction}>
                                        {isSubmittingInteraction && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                        Not Ekle
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">Müşteriyi kaydettikten sonra etkileşim ekleyebilirsiniz.</p>
                    }
                </div>
                <ScrollArea className="flex-1">
                    {isLoadingInteractions ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div> : (
                    <div className="space-y-4 p-6">
                        {interactions && interactions.length > 0 ? interactions.map(item => (
                            <div key={item.id} className="flex items-start gap-3 text-sm">
                                <Avatar className="w-8 h-8 border"><AvatarFallback>{getAvatarFallback(item.authorName)}</AvatarFallback></Avatar>
                                <div className="flex-1 bg-white dark:bg-slate-800 border rounded-lg p-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{item.authorName}</span>
                                            <InteractionIcon type={item.type} />
                                        </div>
                                        <span className="text-xs text-muted-foreground">{format(item.createdAt.seconds * 1000, 'PPpp', { locale: tr })}</span>
                                    </div>
                                    <p className="text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                                </div>
                            </div>
                        )) : (
                            isEditMode && <p className="text-sm text-muted-foreground text-center py-8">Bu müşteri için henüz bir etkileşim kaydedilmemiş.</p>
                        )}
                    </div>
                    )}
                </ScrollArea>
            </div>
        </div>

        <DialogFooter className="p-6 border-t">
          <DialogClose asChild><Button type="button" variant="outline">Kapat</Button></DialogClose>
          <Button type="submit" form="customer-form" onClick={customerForm.handleSubmit(onCustomerSubmit)} disabled={customerForm.formState.isSubmitting}>
            {customerForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
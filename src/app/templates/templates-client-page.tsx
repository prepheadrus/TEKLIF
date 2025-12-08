
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  PlusCircle,
  Trash2,
  Loader2,
  ClipboardList,
  Search,
  Package,
  Wrench,
  X,
  Clipboard,
} from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, query, doc, writeBatch, getDocs } from 'firebase/firestore';
import type { Product } from '@/app/products/products-client-page';
import { ProductSelector } from '@/components/app/product-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// --- Types ---
const templateItemSchema = z.object({
    id: z.string().optional(),
    productId: z.string(),
    name: z.string(),
    quantity: z.coerce.number().min(0.01, 'Miktar 0\'dan büyük olmalıdır.'),
    unit: z.string(),
});

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Şablon adı en az 2 karakter olmalıdır."),
  description: z.string().optional(),
  items: z.array(templateItemSchema),
});


type TemplateFormValues = z.infer<typeof templateSchema>;
type TemplateItemForm = z.infer<typeof templateItemSchema>;


type Template = {
  id: string;
  name: string;
  description?: string;
};

type TemplateItem = {
    id: string;
    productId: string;
    name: string;
    quantity: number;
    unit: string;
}

// --- Main Component ---
export function TemplatesPageContent() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewTemplateDialogOpen, setIsNewTemplateDialogOpen] = useState(false);


  // --- Data Fetching ---
  const productsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'products')) : null), [firestore]);
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);
  
  const templatesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'templates')) : null), [firestore]);
  const { data: templates, isLoading: isLoadingTemplates, refetch: refetchTemplates } = useCollection<Template>(templatesQuery);
  
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);


  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    const searchLower = searchTerm.toLocaleLowerCase('tr-TR');
    return templates.filter(t => t.name.toLocaleLowerCase('tr-TR').includes(searchLower));
  }, [templates, searchTerm]);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
        id: undefined,
        name: '',
        description: '',
        items: [],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  
  useEffect(() => {
    const fetchItems = async () => {
        if (selectedTemplate && firestore) {
            setIsLoadingItems(true);
            const itemsRef = collection(firestore, 'templates', selectedTemplate.id, 'template_items');
            const itemsSnap = await getDocs(itemsRef);
            const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TemplateItem));
            setTemplateItems(items);
            form.reset({
                id: selectedTemplate.id,
                name: selectedTemplate.name,
                description: selectedTemplate.description || '',
                items: items,
            });
            setIsLoadingItems(false);
        } else {
            setTemplateItems([]);
            form.reset({ id: undefined, name: '', description: '', items: [] });
        }
    };
    fetchItems();
  }, [selectedTemplate, firestore, form]);


  const handleAddProductsToTemplate = (selectedProducts: Product[]) => {
    selectedProducts.forEach(product => {
      append({
        productId: product.id,
        name: product.name,
        quantity: 1,
        unit: product.unit,
      });
    });
    setIsProductSelectorOpen(false);
  };

  const handleSaveTemplate = async (data: TemplateFormValues) => {
    if (!firestore || !selectedTemplate) return;
    setIsSaving(true);
    
    const batch = writeBatch(firestore);
    
    // Update template name/description
    const templateRef = doc(firestore, 'templates', selectedTemplate.id);
    batch.update(templateRef, { name: data.name, description: data.description });

    // Sync items
    const itemsRef = collection(firestore, 'templates', selectedTemplate.id, 'template_items');
    const existingItemsSnap = await getDocs(itemsRef);
    const existingIds = new Set(existingItemsSnap.docs.map(d => d.id));
    const formIds = new Set(data.items.filter(item => item.id).map(item => item.id));

    // Delete removed items
    existingItemsSnap.docs.forEach(docSnap => {
        if (!formIds.has(docSnap.id)) {
            batch.delete(docSnap.ref);
        }
    });

    // Add or update items
    data.items.forEach(item => {
        const itemRef = item.id ? doc(itemsRef, item.id) : doc(itemsRef);
        const { id, ...itemData } = item;
        batch.set(itemRef, itemData);
    });

    try {
        await batch.commit();
        toast({ title: "Başarılı!", description: `${data.name} şablonu güncellendi.` });
        refetchTemplates();
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Hata", description: `Şablon kaydedilemedi: ${error.message}` });
    } finally {
        setIsSaving(false);
    }
  };

  const handleCreateNewTemplate = async (values: { name: string, description?: string }) => {
    if (!firestore) return;
    setIsSaving(true);
    try {
        const newTemplateRef = await addDocumentNonBlocking(collection(firestore, 'templates'), values);
        if (newTemplateRef) {
            toast({ title: 'Başarılı!', description: 'Yeni şablon oluşturuldu.' });
            await refetchTemplates();
            const newTemplate = { id: newTemplateRef.id, ...values };
            setSelectedTemplate(newTemplate as Template);
        }
        setIsNewTemplateDialogOpen(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Hata", description: `Şablon oluşturulamadı: ${error.message}` });
    } finally {
        setIsSaving(false);
    }
  }

  const handleDeleteTemplate = async () => {
    if (!firestore || !selectedTemplate) return;
    
    const itemsRef = collection(firestore, 'templates', selectedTemplate.id, 'template_items');
    const itemsSnap = await getDocs(itemsRef);
    const batch = writeBatch(firestore);
    itemsSnap.forEach(doc => batch.delete(doc.ref));
    batch.delete(doc(firestore, 'templates', selectedTemplate.id));

    try {
        await batch.commit();
        toast({ title: 'Silindi', description: 'Şablon ve içindeki tüm kalemler silindi.' });
        setSelectedTemplate(null);
        refetchTemplates();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Hata', description: `Şablon silinemedi: ${error.message}` });
    }
  }


  const isLoading = isLoadingTemplates;

  return (
    <>
    <div className="hidden h-full flex-col md:flex">
         <ResizablePanelGroup direction="horizontal" className="h-full max-h-full items-stretch">
            <ResizablePanel defaultSize={30} minSize={25}>
                <div className="flex h-full flex-col">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Şablonlar</CardTitle>
                                <CardDescription>Bir şablon seçin veya yeni bir tane oluşturun.</CardDescription>
                            </div>
                             <Button size="icon" onClick={() => setIsNewTemplateDialogOpen(true)}>
                                <PlusCircle />
                            </Button>
                        </div>
                        <div className="relative pt-2">
                             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                             <Input 
                                placeholder="Şablon adı ara..." 
                                className="pl-8"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                             />
                        </div>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-4 pt-0 space-y-2">
                            {isLoading && <Loader2 className="mx-auto my-8 animate-spin" />}
                            {filteredTemplates?.map(t => (
                                <Card 
                                    key={t.id} 
                                    className={`cursor-pointer hover:bg-accent ${selectedTemplate?.id === t.id ? 'border-primary' : ''}`}
                                    onClick={() => setSelectedTemplate(t)}
                                >
                                    <CardContent className="p-3">
                                        <p className="font-semibold">{t.name}</p>
                                        {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
                 <div className="flex h-full flex-col">
                    {selectedTemplate ? (
                         <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSaveTemplate)} className="flex flex-col h-full">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 space-y-2">
                                            <FormField control={form.control} name="name" render={({ field }) => (
                                                <Input {...field} className="text-2xl font-bold h-auto p-0 border-0 focus-visible:ring-0" />
                                            )} />
                                            <FormField control={form.control} name="description" render={({ field }) => (
                                                <Input {...field} placeholder="Şablon açıklaması..." className="h-auto p-0 border-0 focus-visible:ring-0 text-muted-foreground" />
                                            )} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="destructive" type="button" onClick={handleDeleteTemplate}>Sil</Button>
                                            <Button type="button" variant="outline" onClick={() => setIsProductSelectorOpen(true)}>
                                                <PlusCircle className="mr-2" /> Kalem Ekle
                                            </Button>
                                             <Button type="submit" disabled={isSaving}>
                                                {isSaving && <Loader2 className="animate-spin mr-2" />}
                                                Şablonu Kaydet
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-auto">
                                    <div className="border rounded-md">
                                        <Table>
                                             <TableHeader className="bg-muted/50 sticky top-0">
                                                <TableRow>
                                                    <TableHead className="w-2/5">Kalem</TableHead>
                                                    <TableHead>Miktar</TableHead>
                                                    <TableHead>Birim</TableHead>
                                                    <TableHead className="w-12"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(fields || []).length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                                            Bu şablona kalem ekleyin.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                {fields.map((field, index) => (
                                                    <TableRow key={field.id}>
                                                        <TableCell className="font-medium">{field.name}</TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`items.${index}.quantity`} render={({field}) => (
                                                                <Input {...field} type="number" step="any" className="w-24 h-8" />
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>{field.unit}</TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(index)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </form>
                         </Form>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold">Teklif Şablonlarınızı Yönetin</h3>
                            <p className="text-muted-foreground mt-2">Soldaki listeden bir şablon seçin veya yeni bir tane oluşturun.</p>
                        </div>
                    )}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    </div>
    <ProductSelector 
        isOpen={isProductSelectorOpen}
        onOpenChange={setIsProductSelectorOpen}
        onProductsSelected={handleAddProductsToTemplate}
    />
     <NewTemplateDialog
        isOpen={isNewTemplateDialogOpen}
        onOpenChange={setIsNewTemplateDialogOpen}
        onSubmit={handleCreateNewTemplate}
        isSaving={isSaving}
      />
    </>
  );
}


function NewTemplateDialog({ isOpen, onOpenChange, onSubmit, isSaving }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onSubmit: (values: {name: string, description?: string}) => void; isSaving: boolean }) {
  const form = useForm({
    resolver: zodResolver(z.object({
        name: z.string().min(2, "Şablon adı zorunludur."),
        description: z.string().optional()
    }))
  });
  
  useEffect(() => {
    if(isOpen) {
        form.reset({ name: '', description: '' });
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Yeni Teklif Şablonu Oluştur</DialogTitle>
                <DialogDescription>
                    Sık kullandığınız teklif kalemlerini bir araya toplayarak şablonlar oluşturun.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                     <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Şablon Adı</FormLabel>
                            <FormControl><Input placeholder="Örn: Kombi Montajı Paketi" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Açıklama (Opsiyonel)</FormLabel>
                            <FormControl><Textarea placeholder="Bu şablonun içeriğini kısaca açıklayın." {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="animate-spin mr-2" />}
                            Oluştur
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
  )
}

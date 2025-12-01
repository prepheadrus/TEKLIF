'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  doc,
  writeBatch,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Trash2,
  PlusCircle,
  Loader2,
  Save,
  FileDown,
  BrainCircuit,
  X,
  Bot,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { calculatePrice } from '@/lib/pricing';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { QuickAddProduct } from '@/components/app/quick-add-product';
import { suggestMissingParts } from '@/ai/flows/suggest-missing-parts';

const proposalItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, 'Ürün seçimi zorunludur.'),
  name: z.string(),
  brand: z.string(),
  quantity: z.coerce.number().min(0.01, 'Miktar 0 olamaz.'),
  unit: z.string(),
  listPrice: z.coerce.number(),
  currency: z.enum(['TRY', 'USD', 'EUR']),
  discountRate: z.coerce.number().min(0).max(1),
  profitMargin: z.coerce.number().min(0),
  // Calculated fields, not part of the form but good to have in the type
  cost: z.number().optional(),
  unitPrice: z.number().optional(),
  total: z.number().optional(),
});

const proposalSchema = z.object({
  status: z.enum(['Draft', 'Sent', 'Approved', 'Rejected']),
  versionNote: z.string().optional(),
  items: z.array(proposalItemSchema),
});

type ProposalFormValues = z.infer<typeof proposalSchema>;
type ProposalItem = z.infer<typeof proposalItemSchema>;

type Product = {
  id: string;
  name: string;
  brand: string;
  unit: string;
  listPrice: number;
  currency: 'TRY' | 'USD' | 'EUR';
  discountRate: number;
};

type Proposal = {
  id: string;
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
  versionNote?: string;
  customerName: string;
  projectName: string;
  quoteNumber: string;
  version: number;
  customerId: string;
  exchangeRates: { USD: number; EUR: number };
  createdAt: { seconds: number };
};

// Main Component
export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params.id as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [activeProductForAISuggestion, setActiveProductForAISuggestion] = useState<string | null>(null);

  // --- Data Fetching ---
  const proposalRef = useMemoFirebase(
    () => (firestore && proposalId ? doc(firestore, 'proposals', proposalId) : null),
    [firestore, proposalId]
  );
  const { data: proposal, isLoading: isLoadingProposal } = useDoc<Proposal>(proposalRef);

  const proposalItemsRef = useMemoFirebase(
    () => (firestore && proposalId ? collection(firestore, 'proposals', proposalId, 'proposal_items') : null),
    [firestore, proposalId]
  );
  const { data: initialItems, isLoading: isLoadingItems } = useCollection<ProposalItem>(proposalItemsRef);

  const productsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts, refetch: refetchProducts } = useCollection<Product>(productsRef);


  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      status: 'Draft',
      versionNote: '',
      items: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
    keyName: 'formId', // Use 'formId' to avoid conflict with document 'id'
  });

  // --- Effects ---

  // Effect to populate form when initial data loads
  useEffect(() => {
    if (proposal && initialItems) {
      form.reset({
        status: proposal.status,
        versionNote: proposal.versionNote || '',
        items: initialItems.map((item) => ({
          ...item,
          productId: item.productId || '',
          name: item.name || '',
          brand: item.brand || '',
          quantity: item.quantity || 1,
          unit: item.unit || '',
          listPrice: item.listPrice || 0,
          currency: item.currency || 'TRY',
          discountRate: item.discountRate || 0,
          profitMargin: item.profitMargin || 0,
        })),
      });
    }
  }, [proposal, initialItems, form]);


  // --- Calculations ---
  const totals = useMemo(() => {
    const items = form.watch('items');
    const exchangeRates = proposal?.exchangeRates || { USD: 1, EUR: 1 };
    
    let grandTotalTRY = 0;

    items.forEach((item) => {
      const exchangeRate =
        item.currency === 'USD'
          ? exchangeRates.USD
          : item.currency === 'EUR'
          ? exchangeRates.EUR
          : 1;

      const priceInfo = calculatePrice({
        listPrice: item.listPrice,
        discountRate: item.discountRate,
        profitMargin: item.profitMargin,
        exchangeRate: exchangeRate,
      });

      grandTotalTRY += priceInfo.tlSellPrice * item.quantity;
    });

    const vat = grandTotalTRY * 0.20;
    const subtotal = grandTotalTRY;
    const grandTotalWithVAT = grandTotalTRY + vat;


    return { subtotal, vat, grandTotal: grandTotalWithVAT };
  }, [form.watch('items'), proposal?.exchangeRates]);


  // --- Event Handlers ---
  const handleAddProduct = () => {
    append({
      productId: '',
      name: '',
      brand: '',
      unit: '',
      quantity: 1,
      listPrice: 0,
      currency: 'TRY',
      discountRate: 0,
      profitMargin: 0.2, // Default 20%
    });
  };

  const handleProductSelection = (index: number, productId: string) => {
    const selectedProduct = products?.find((p) => p.id === productId);
    if (selectedProduct) {
      const { id, ...productData } = selectedProduct;
      const currentItem = form.getValues(`items.${index}`);
      update(index, {
        ...currentItem,
        ...productData,
        productId: id,
      });
       setActiveProductForAISuggestion(selectedProduct.name);
    }
  };
  
  const handleQuickAddFinished = () => {
    refetchProducts();
  };

  const onSubmit = async (data: ProposalFormValues) => {
    if (!firestore || !proposalId || !proposal) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Veritabanı bağlantısı kurulamadı.',
      });
      return;
    }
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);

      // 1. Update the main proposal document
      const proposalDocRef = doc(firestore, 'proposals', proposalId);
      batch.update(proposalDocRef, {
        status: data.status,
        versionNote: data.versionNote,
        totalAmount: totals.grandTotal, // Save the calculated total
        updatedAt: serverTimestamp(),
      });

      // 2. Sync proposal items
      const itemsCollectionRef = collection(
        firestore,
        'proposals',
        proposalId,
        'proposal_items'
      );

      const existingItemsSnap = await getDocs(itemsCollectionRef);
      const existingIds = existingItemsSnap.docs.map((d) => d.id);
      const formIds = data.items.map((item) => item.id).filter(Boolean);
      
      const idsToDelete = existingIds.filter(id => !formIds.includes(id));
      idsToDelete.forEach(id => {
          batch.delete(doc(itemsCollectionRef, id));
      });

      data.items.forEach((item) => {
        const { cost, unitPrice, total, ...dbItem } = item;
        const itemRef = item.id
          ? doc(itemsCollectionRef, item.id)
          : doc(itemsCollectionRef);
        batch.set(itemRef, dbItem);
      });

      await batch.commit();
      toast({
        title: 'Başarılı!',
        description: 'Teklif başarıyla güncellendi.',
      });
    } catch (error: any) {
      console.error('Error saving proposal:', error);
      toast({
        variant: 'destructive',
        title: 'Kaydetme Hatası',
        description: `Bir hata oluştu: ${error.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingProposal || isLoadingItems) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!proposal) {
    return <div>Teklif bulunamadı.</div>;
  }
  
  const formatDate = (timestamp?: { seconds: number }) => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR');
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-8">
          {/* Header */}
          <header className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground">{proposal.quoteNumber} (v{proposal.version})</p>
              <h1 className="text-2xl font-bold">
                {proposal.customerName} - {proposal.projectName}
              </h1>
               <p className="text-sm text-muted-foreground">Oluşturulma Tarihi: {formatDate(proposal.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  router.push(
                    `/quotes/${proposalId}/print?customerId=${proposal.customerId}`
                  )
                }
              >
                <FileDown className="mr-2 h-4 w-4" />
                Yazdır / PDF
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Kaydet
              </Button>
            </div>
          </header>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column (Items) */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Teklif Kalemleri</CardTitle>
                  {activeProductForAISuggestion && (
                    <AISuggestionBox 
                        productName={activeProductForAISuggestion}
                        existingItems={form.watch('items').map(i => i.name)}
                        onClose={() => setActiveProductForAISuggestion(null)}
                    />
                   )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Ürün/Hizmet</TableHead>
                        <TableHead>Miktar</TableHead>
                        <TableHead>Birim</TableHead>
                        <TableHead>Liste Fiyatı</TableHead>
                        <TableHead>İsk. (%)</TableHead>
                        <TableHead>Kâr (%)</TableHead>
                        <TableHead className="text-right">Birim Fiyat</TableHead>
                        <TableHead className="text-right">Toplam</TableHead>
                        <TableHead>
                          <span className="sr-only">Sil</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => {
                        const itemValues = form.watch(`items.${index}`);
                        const exchangeRate =
                          itemValues.currency === 'USD'
                            ? proposal.exchangeRates?.USD || 1
                            : itemValues.currency === 'EUR'
                            ? proposal.exchangeRates?.EUR || 1
                            : 1;

                        const priceInfo = calculatePrice({
                          listPrice: itemValues.listPrice,
                          discountRate: itemValues.discountRate,
                          profitMargin: itemValues.profitMargin,
                          exchangeRate: exchangeRate,
                        });

                        return (
                          <TableRow key={field.formId}>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.productId`}
                                render={({ field }) => (
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      handleProductSelection(index, value);
                                    }}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger disabled={isLoadingProducts}>
                                        <SelectValue placeholder="Ürün seçin..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full justify-start"
                                        onClick={() => setIsQuickAddOpen(true)}
                                      >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Yeni Ürün Ekle
                                      </Button>
                                      <Separator className="my-1" />
                                      {products?.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                          {p.name} ({p.brand})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.quantity`}
                                render={({ field }) => <Input {...field} type="number" step="any" className="w-20" />}
                              />
                            </TableCell>
                             <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.unit`}
                                render={({ field }) => <Input {...field} className="w-20" />}
                              />
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                    <FormField
                                        control={form.control}
                                        name={`items.${index}.listPrice`}
                                        render={({ field }) => <Input {...field} type="number" step="any" className="w-24"/>}
                                    />
                                     <FormField
                                        control={form.control}
                                        name={`items.${index}.currency`}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="w-[70px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="TRY">TL</SelectItem>
                                                    <SelectItem value="USD">$</SelectItem>
                                                    <SelectItem value="EUR">€</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </TableCell>
                            <TableCell>
                               <FormField
                                    control={form.control}
                                    name={`items.${index}.discountRate`}
                                    render={({ field }) => <Input {...field} type="number" step="0.01" className="w-20" placeholder="0.15"/>}
                                />
                            </TableCell>
                             <TableCell>
                               <FormField
                                    control={form.control}
                                    name={`items.${index}.profitMargin`}
                                    render={({ field }) => <Input {...field} type="number" step="0.01" className="w-20" placeholder="0.20"/>}
                                />
                            </TableCell>
                            <TableCell className="text-right">
                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(priceInfo.tlSellPrice)}
                            </TableCell>
                             <TableCell className="text-right font-medium">
                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(priceInfo.tlSellPrice * itemValues.quantity)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddProduct}
                    >
                        <PlusCircle className="mr-2" />
                        Kalem Ekle
                    </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Right Column (Summary & Settings) */}
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Teklif Özeti</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Ara Toplam</span>
                      <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totals.subtotal)}</span>
                    </div>
                     <div className="flex justify-between">
                      <span>KDV (%20)</span>
                      <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totals.vat)}</span>
                    </div>
                     <Separator />
                     <div className="flex justify-between font-semibold text-lg">
                      <span>Genel Toplam</span>
                      <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totals.grandTotal)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Teklif Ayarları</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Durum</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Teklif durumunu seçin" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Draft">
                                <Badge variant="outline">Taslak</Badge>
                            </SelectItem>
                            <SelectItem value="Sent">
                                <Badge variant="secondary">Gönderildi</Badge>
                            </SelectItem>
                            <SelectItem value="Approved">
                                <Badge variant="default" className="bg-green-500">Onaylandı</Badge>
                            </SelectItem>
                             <SelectItem value="Rejected">
                                <Badge variant="destructive">Reddedildi</Badge>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="versionNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Versiyon Notu</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Bu versiyondaki değişiklikleri açıklayın..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
      <QuickAddProduct
        isOpen={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
        onProductAdded={handleQuickAddFinished}
      />
    </Form>
  );
}


function AISuggestionBox({ productName, existingItems, onClose }: { productName: string, existingItems: string[], onClose: () => void }) {
    const [isLoading, setIsLoading] = useState(true);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    
    useEffect(() => {
        async function getSuggestions() {
            try {
                setIsLoading(true);
                const result = await suggestMissingParts({
                    productName: productName,
                    existingParts: existingItems,
                });
                const newSuggestions = result.suggestedParts.filter(
                    suggestion => !existingItems.some(item => item.toLowerCase().includes(suggestion.toLowerCase()))
                );
                setSuggestions(newSuggestions);
            } catch (error) {
                console.error("AI suggestion error:", error);
                setSuggestions([]);
            } finally {
                setIsLoading(false);
            }
        }
        getSuggestions();
    }, [productName, existingItems]);


    return (
         <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <Bot size={20} className="text-primary" />
                    <h4 className="font-semibold text-primary">AI Önerisi: '{productName}'</h4>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
                    <X size={16} />
                </Button>
            </div>
            {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" />
                    <span>İlgili parçalar aranıyor...</span>
                </div>
            ) : suggestions.length > 0 ? (
                 <div className="text-sm">
                    <p className="mb-2">Bu ürünle birlikte aşağıdaki parçaları da eklemek isteyebilirsiniz:</p>
                    <ul className="flex flex-wrap gap-2">
                        {suggestions.map((part, i) => (
                             <li key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                {part}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">Bu ürün için ek bir öneri bulunamadı.</p>
            )}
        </div>
    )
}

'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  serverTimestamp,
} from 'firebase/firestore';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
  FormMessage,
} from '@/components/ui/form';
import {
  Trash2,
  PlusCircle,
  Loader2,
  Send,
  Bot,
  X,
  FileDown,
  Flame,
  Droplets,
  Wind,
  ShieldCheck,
  Thermometer,
  Wrench,
  Edit,
  RefreshCw,
  ChevronsUpDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { calculatePrice, calculateItemTotals } from '@/lib/pricing';
import { ProductSelector } from '@/components/app/product-selector';
import type { Product as ProductType } from '@/app/products/page';
import { suggestMissingParts } from '@/ai/flows/suggest-missing-parts';
import { cn } from '@/lib/utils';
import type { InstallationType } from '@/app/installation-types/page';
import { fetchExchangeRates } from '@/ai/flows/fetch-exchange-rates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';


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
  profitMargin: z.coerce.number().min(0), // No upper limit needed, can be > 100%
  groupName: z.string().default('Diğer'),
  basePrice: z.coerce.number().default(0),
});

const proposalSchema = z.object({
  versionNote: z.string().optional(),
  items: z.array(proposalItemSchema),
  exchangeRates: z.object({
      USD: z.coerce.number(),
      EUR: z.coerce.number()
  })
});

type ProposalFormValues = z.infer<typeof proposalSchema>;
type ProposalItem = z.infer<typeof proposalItemSchema>;


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

const getGroupIcon = (groupName: string) => {
    const lowerCaseName = groupName.toLowerCase();
    if (lowerCaseName.includes('isitma')) return <Flame className="w-5 h-5" />;
    if (lowerCaseName.includes('sihhi')) return <Droplets className="w-5 h-5" />;
    if (lowerCaseName.includes('soğutma')) return <Thermometer className="w-5 h-5" />;
    if (lowerCaseName.includes('havalandirma')) return <Wind className="w-5 h-5" />;
    if (lowerCaseName.includes('yangin')) return <ShieldCheck className="w-5 h-5" />;
    return <Wrench className="w-5 h-5" />;
}

export const ExchangeRateDisplay = ({ form, onRefresh, isFetching }: { form: any, onRefresh: () => void, isFetching: boolean }) => {
    return (
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
            <FormField control={form.control} name="exchangeRates.EUR" render={({ field }) => (
                <div className="text-right">
                    <span className="block text-[10px] text-blue-600 uppercase font-bold">EUR</span>
                    <Input {...field} type="number" step="any" className="h-auto p-0 border-0 rounded-none bg-transparent text-right font-mono text-sm font-bold text-blue-800 focus-visible:ring-0 w-20" />
                </div>
            )} />
            <div className="w-px h-6 bg-slate-300"></div>
            <FormField control={form.control} name="exchangeRates.USD" render={({ field }) => (
                <div className="text-right">
                    <span className="block text-[10px] text-green-600 uppercase font-bold">USD</span>
                    <Input {...field} type="number" step="any" className="h-auto p-0 border-0 rounded-none bg-transparent text-right font-mono text-sm font-bold text-green-800 focus-visible:ring-0 w-20" />
                </div>
            )} />
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh} disabled={isFetching}>
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
        </div>
    );
};


// Main Component
export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params.id as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [subHeaderPortal, setSubHeaderPortal] = useState<HTMLElement | null>(null);
  const [exchangeRatePortal, setExchangeRatePortal] = useState<HTMLElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [activeProductForAISuggestion, setActiveProductForAISuggestion] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const groupNameInputRef = useRef<HTMLInputElement>(null);
  const [emptyGroups, setEmptyGroups] = useState<string[]>([]);
  const [targetGroupForProductAdd, setTargetGroupForProductAdd] = useState<string | undefined>(undefined);
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [totalDisplayMode, setTotalDisplayMode] = useState<'TRY' | 'MULTI'>('TRY');


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
  const { data: initialItems, isLoading: isLoadingItems, refetch: refetchItems } = useCollection<ProposalItem>(proposalItemsRef);

  const installationTypesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'installation_types') : null),
    [firestore]
  );
  const { data: installationTypes, isLoading: isLoadingInstallationTypes } = useCollection<InstallationType>(installationTypesRef);

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      versionNote: '',
      items: [],
      exchangeRates: { USD: 32.5, EUR: 35.0 }
    },
  });
  
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
    keyName: "formId"
  });
  
  const watchedItems = form.watch('items');
  const watchedRates = form.watch('exchangeRates');

  // --- Effects ---
   useEffect(() => {
    setSubHeaderPortal(document.getElementById('sub-header-portal'));
    setExchangeRatePortal(document.getElementById('exchange-rate-portal'));
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (proposal && initialItems && isMounted) {
      form.reset({
        versionNote: proposal.versionNote || '',
        items: initialItems.map((item) => ({
          ...item,
          id: item.id,
          productId: item.productId || '',
          groupName: item.groupName || 'Diğer',
        })),
        exchangeRates: proposal.exchangeRates || { USD: 32.5, EUR: 35.0 }
      });
       if (!form.formState.isDirty) {
         handleFetchRates();
       }
    }
    return () => { isMounted = false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal, initialItems, form.reset]);


  useEffect(() => {
    if (editingGroupName && groupNameInputRef.current) {
        groupNameInputRef.current.focus();
        groupNameInputRef.current.select();
    }
  }, [editingGroupName]);

  // --- Calculations ---
  const calculatedTotals = useMemo(() => {
    const totalsByCurrency = { TRY: 0, USD: 0, EUR: 0 };
    let grandTotalSellInTRY = 0;
    let grandTotalCostInTRY = 0;

    const groupTotals = watchedItems.reduce((acc, item) => {
        const groupName = item.groupName || 'Diğer';
        if (!acc[groupName]) {
            acc[groupName] = { 
              totalSellInTRY: 0, 
              totalCostInTRY: 0, 
              totalProfitInTRY: 0,
              totalsByCurrency: { TRY: 0, USD: 0, EUR: 0 }
            };
        }
        
        const totals = calculateItemTotals({
            ...item,
            exchangeRate: item.currency === 'USD' ? watchedRates.USD : item.currency === 'EUR' ? watchedRates.EUR : 1,
        });

        const itemOriginalTotal = totals.originalSellPrice * item.quantity;
        
        acc[groupName].totalSellInTRY += totals.totalTlSell;
        acc[groupName].totalCostInTRY += totals.totalTlCost;
        acc[groupName].totalProfitInTRY += totals.totalProfit;
        acc[groupName].totalsByCurrency[item.currency] += itemOriginalTotal;
        
        totalsByCurrency[item.currency] += itemOriginalTotal;
        grandTotalSellInTRY += totals.totalTlSell;
        grandTotalCostInTRY += totals.totalTlCost;

        return acc;
    }, {} as Record<string, { 
        totalSellInTRY: number; 
        totalCostInTRY: number; 
        totalProfitInTRY: number; 
        totalsByCurrency: { TRY: number; USD: number; EUR: number; };
    }>);
    
    
    const grandTotalProfit = grandTotalSellInTRY - grandTotalCostInTRY;
    const grandTotalProfitMargin = grandTotalSellInTRY > 0 ? (grandTotalProfit / grandTotalSellInTRY) : 0;

    return { 
        groupTotals, 
        grandTotalSellInTRY,
        grandTotalCostInTRY,
        grandTotalProfit,
        grandTotalProfitMargin,
        totalsByCurrency
    };
}, [watchedItems, watchedRates]);


  const allGroups = useMemo(() => {
    const itemGroups = watchedItems.reduce((acc, item, index) => {
        const groupName = item.groupName || 'Diğer';
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push({ ...item, ...fields[index] });
        return acc;
    }, {} as Record<string, (ProposalItem & {formId: string})[]>);


    emptyGroups.forEach(groupName => {
        if (!itemGroups[groupName]) {
            itemGroups[groupName] = [];
        }
    });

    return Object.entries(itemGroups).sort(([a], [b]) => {
      if (a === 'Diğer') return 1;
      if (b === 'Diğer') return -1;
      return a.localeCompare(b);
    });

  }, [watchedItems, fields, emptyGroups]);
  
  // --- Event Handlers ---
   const handleProductsSelected = (selectedProducts: ProductType[]) => {
    const currentItems = form.getValues('items');

    selectedProducts.forEach(product => {
        const existingItemIndex = currentItems.findIndex(
            item => item.productId === product.id && item.groupName === (targetGroupForProductAdd || 'Diğer')
        );

        if (existingItemIndex !== -1) {
            const existingItem = currentItems[existingItemIndex];
            update(existingItemIndex, {
                ...existingItem,
                quantity: (existingItem.quantity || 0) + 1,
            });
        } else {
            let groupName = targetGroupForProductAdd || 'Diğer';
             if (!targetGroupForProductAdd && product.installationTypeId && installationTypes) {
                let current = installationTypes.find(it => it.id === product.installationTypeId);
                let parent = current;
                while (parent?.parentId) {
                    const nextParent = installationTypes.find(it => it.id === parent.parentId);
                    if (nextParent) {
                        parent = nextParent;
                    } else {
                        break;
                    }
                }
                groupName = parent?.name || 'Diğer';
            }
            
            const newItem: ProposalItem = {
                productId: product.id,
                name: product.name,
                brand: product.brand,
                unit: product.unit,
                quantity: 1,
                listPrice: product.listPrice,
                currency: product.currency,
                discountRate: product.discountRate || 0,
                profitMargin: 0.2, // Default 20%
                groupName: groupName,
                basePrice: product.basePrice,
            };
            append(newItem);
        }
    });

    setIsProductSelectorOpen(false);
    
    if (targetGroupForProductAdd) {
        setEmptyGroups(prev => prev.filter(g => g !== targetGroupForProductAdd));
    }
    setTargetGroupForProductAdd(undefined);
    
    const firstNewProduct = selectedProducts.find(p => !currentItems.some(item => item.productId === p.id));
    if (firstNewProduct) {
        setActiveProductForAISuggestion(firstNewProduct.name);
    }
  };

  const handleAddNewGroup = () => {
    const newGroupName = `Yeni Grup ${emptyGroups.length + allGroups.length + 1}`;
    setEmptyGroups(prev => [...prev, newGroupName]);
    setTimeout(() => {
        setEditingGroupName(newGroupName);
    }, 100);
  };

  const handleGroupNameChange = (oldName: string, newName: string) => {
    if (!newName || oldName === newName) {
        setEditingGroupName(null);
        return;
    }
    const currentItems = form.getValues('items');
    currentItems.forEach((item, index) => {
        if (item.groupName === oldName) {
            update(index, { ...item, groupName: newName });
        }
    });

    setEmptyGroups(prev => prev.map(g => g === oldName ? newName : g).filter(g => g !== oldName || !allGroups.some(([groupName]) => groupName === newName)));
    
    setEditingGroupName(null);
  };
  
  const handleSaveChanges = async (data: ProposalFormValues) => {
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

      const proposalDocRef = doc(firestore, 'proposals', proposalId);
      batch.update(proposalDocRef, {
        versionNote: data.versionNote,
        totalAmount: calculatedTotals.grandTotalSellInTRY,
        exchangeRates: data.exchangeRates,
        updatedAt: serverTimestamp(),
      });

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
        const { ...dbItem } = item;
        const itemRef = item.id
          ? doc(itemsCollectionRef, item.id)
          : doc(itemsCollectionRef);
        batch.set(itemRef, dbItem, { merge: true });
      });

      await batch.commit();
      
      await refetchItems();


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

  const openProductSelectorForGroup = (groupName: string) => {
    setTargetGroupForProductAdd(groupName);
    setIsProductSelectorOpen(true);
  };
  
  const handleFetchRates = async () => {
    setIsFetchingRates(true);
    toast({ title: 'Kurlar alınıyor...', description: 'TCMB verileri çekiliyor.' });
    try {
        const newRates = await fetchExchangeRates();
        
        if (newRates && newRates.USD && newRates.EUR) {
            form.setValue('exchangeRates.USD', newRates.USD, { shouldValidate: true, shouldDirty: true });
            form.setValue('exchangeRates.EUR', newRates.EUR, { shouldValidate: true, shouldDirty: true });
            await form.trigger(['exchangeRates.USD', 'exchangeRates.EUR']);
            toast({ title: 'Başarılı!', description: 'Döviz kurları güncellendi.' });
        } else {
            throw new Error("API'den geçerli kur bilgisi alınamadı.");
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Hata', description: `Kurlar alınamadı: ${error.message}` });
    } finally {
        setIsFetchingRates(false);
    }
  }


  const isLoading = isLoadingProposal || isLoadingItems || isLoadingInstallationTypes;

  const formatCurrency = (amount: number, currency: 'TRY' | 'USD' | 'EUR' = 'TRY') => {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  }
  const formatNumber = (amount: number) => {
      return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  }
  const formatPercent = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'percent', minimumFractionDigits: 2 }).format(amount);
  }

  const renderMultiCurrencyTotal = (totals: { TRY: number, USD: number, EUR: number }, className?: string) => {
    const parts = (['TRY', 'USD', 'EUR'] as const)
        .map(curr => {
            const total = totals[curr];
            return total > 0 ? formatCurrency(total, curr) : null;
        })
        .filter(Boolean);

    if (parts.length === 0) return formatCurrency(0, 'TRY');
    return <span className={cn("font-mono font-bold", className)}>{parts.join(' + ')}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!proposal) {
    return <div>Teklif bulunamadı.</div>;
  }

  return (
    <div className="h-full flex flex-col">
       {exchangeRatePortal && createPortal(
          <ExchangeRateDisplay form={form} onRefresh={handleFetchRates} isFetching={isFetchingRates} />,
          exchangeRatePortal
      )}
      {subHeaderPortal && proposal && createPortal(
          <div className="bg-white/95 backdrop-blur-sm px-8 py-3 flex justify-between items-center w-full border-b">
              {/* Left Section: Project Info */}
              <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-slate-800 truncate" title={proposal.projectName}>
                      {proposal.projectName}
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    <span className="font-medium text-slate-600">{proposal.customerName}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    {proposal.quoteNumber} (v{proposal.version})
                  </p>
              </div>

              {/* Right Section: Financials & Actions */}
              <div className="flex items-center gap-4">
                 <div className="relative">
                     <Collapsible>
                        <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="p-3 h-auto">
                                    <div className="text-right">
                                        <span className="text-xs text-slate-500">Genel Toplam (KDV Dahil)</span>
                                        <span className="block text-2xl font-bold font-mono tabular-nums text-slate-900">{formatCurrency(calculatedTotals.grandTotalSellInTRY * 1.2)}</span>
                                    </div>
                                    <ChevronsUpDown className="h-5 w-5 ml-3 text-slate-400" />
                                </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="absolute top-full right-0 z-20">
                            <div className="p-4 mt-2 border bg-white rounded-lg shadow-xl w-[550px] grid grid-cols-2 gap-x-6">
                                {/* Left Column */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="font-semibold text-sm mb-2">Grup İcmali (KDV Hariç)</h4>
                                        <div className="space-y-1 text-xs text-slate-600">
                                        {Object.entries(calculatedTotals.groupTotals).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, group]) => (
                                            <div key={groupName} className="flex justify-between items-center">
                                                <span className="truncate pr-4" title={groupName}>{groupName}</span>
                                                {totalDisplayMode === 'TRY' ? (
                                                    <span className="font-mono font-semibold">{formatCurrency(group.totalSellInTRY)}</span>
                                                ) : (
                                                    renderMultiCurrencyTotal(group.totalsByCurrency, 'text-xs')
                                                )}
                                            </div>
                                        ))}
                                        </div>
                                    </div>
                                    <Separator />
                                     <div className="text-right space-y-1">
                                        <span className="text-xs text-slate-500">Teklif İcmali (KDV Hariç)</span>
                                        {renderMultiCurrencyTotal(calculatedTotals.totalsByCurrency, 'text-base')}
                                    </div>
                                </div>
                                {/* Right Column */}
                                <div className="space-y-3 border-l pl-6">
                                    <div className="flex items-center justify-between gap-6">
                                        <span className="text-sm font-medium text-slate-600">Para Birimi Gösterimi</span>
                                        <Select value={totalDisplayMode} onValueChange={(value: 'TRY' | 'MULTI') => setTotalDisplayMode(value)}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="TRY">Genel Toplam (TL)</SelectItem>
                                                <SelectItem value="MULTI">Para Birimine Göre İcmal</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Separator />
                                    <div className="text-right space-y-1">
                                        <span className="text-xs text-slate-500">Toplam Kâr</span>
                                        <span className="block text-lg font-bold font-mono tabular-nums text-green-600">
                                            {formatCurrency(calculatedTotals.grandTotalProfit)}
                                            <span className="text-sm font-medium ml-2">({formatPercent(calculatedTotals.grandTotalProfitMargin)})</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CollapsibleContent>
                     </Collapsible>
                 </div>
                 
                  <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push(`/quotes/${proposalId}/print?customerId=${proposal.customerId}`)}
                    >
                        <FileDown className="mr-2 h-4 w-4" /> PDF
                    </Button>
                    <Button onClick={form.handleSubmit(handleSaveChanges)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Değişiklikleri Kaydet
                    </Button>
                </div>
              </div>
          </div>,
          subHeaderPortal
      )}
      <main className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
        <Form {...form}>
            <form>
                {activeProductForAISuggestion && (
                    <AISuggestionBox 
                        productName={activeProductForAISuggestion}
                        existingItems={form.watch('items').map(i => i.name)}
                        onClose={() => setActiveProductForAISuggestion(null)}
                    />
                )}
                
                {allGroups.map(([groupName, itemsInGroup]) => {
                    const groupTotal = calculatedTotals.groupTotals[groupName] || { 
                        totalSellInTRY: 0, 
                        totalCostInTRY: 0, 
                        totalProfitInTRY: 0,
                        totalsByCurrency: { TRY: 0, USD: 0, EUR: 0 }
                    };
                    const groupProfitMargin = groupTotal.totalSellInTRY > 0 ? (groupTotal.totalProfitInTRY / groupTotal.totalSellInTRY) : 0;
                    
                    return (
                    <section key={groupName} className="group/section relative bg-white rounded-xl shadow-sm border border-slate-200">
                            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm rounded-t-xl">
                                <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center group/header">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                            {getGroupIcon(groupName)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {editingGroupName === groupName ? (
                                                <Input
                                                    ref={groupNameInputRef}
                                                    defaultValue={groupName}
                                                    onBlur={(e) => handleGroupNameChange(groupName, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleGroupNameChange(groupName, e.currentTarget.value);
                                                        }
                                                        if (e.key === 'Escape') setEditingGroupName(null);
                                                    }}
                                                    className="h-8 text-lg font-bold"
                                                />
                                            ) : (
                                                <>
                                                    <h2 className="font-bold text-slate-800 text-lg">{groupName}</h2>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-7 w-7 text-slate-400 opacity-0 group-hover/header:opacity-100 transition-opacity"
                                                        onClick={() => setEditingGroupName(groupName)}
                                                    >
                                                        <Edit className="h-4 w-4"/>
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 text-right">
                                        <div>
                                            <p className="text-xs text-slate-500">Grup Kârı</p>
                                            <p className="font-mono text-xl font-bold text-green-600">{formatCurrency(groupTotal.totalProfitInTRY)} <span className="text-sm font-medium">({formatPercent(groupProfitMargin)})</span></p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Grup Toplamı</p>
                                            {totalDisplayMode === 'TRY' ? (
                                                    <p className="font-mono text-xl font-bold text-slate-800">{formatCurrency(groupTotal.totalSellInTRY)}</p>
                                            ) : (
                                                    renderMultiCurrencyTotal(groupTotal.totalsByCurrency, 'text-lg')
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Table>
                                    <TableHeader>
                                    <TableRow>
                                        <TableHead className="py-2 pl-4 text-xs uppercase text-slate-400 font-semibold tracking-wider w-[30%]">Malzeme / Poz</TableHead>
                                        <TableHead className="py-2 text-xs uppercase text-slate-400 font-semibold tracking-wider">Marka</TableHead>
                                        <TableHead className="text-right py-2 text-xs uppercase text-slate-400 font-semibold tracking-wider">Miktar</TableHead>
                                        <TableHead className="py-2 text-xs uppercase text-slate-400 font-semibold tracking-wider">Birim</TableHead>
                                        <TableHead className="text-right py-2 text-xs uppercase text-slate-400 font-semibold tracking-wider">Liste Fiyatı</TableHead>
                                        <TableHead className="text-right py-2 text-xs uppercase text-slate-400 font-semibold tracking-wider">Alış Fiyatı (TL)</TableHead>
                                        <TableHead className="text-right py-2 text-xs uppercase text-slate-400 font-semibold tracking-wider w-32">İskonto (%)</TableHead>
                                        <TableHead className="text-right py-2 text-xs uppercase text-slate-400 font-semibold tracking-wider w-32">Kâr (%)</TableHead>
                                        <TableHead className="text-right py-2 text-xs uppercase text-slate-400 font-semibold tracking-wider">Birim Fiyat</TableHead>
                                        <TableHead className="text-right py-2 text-xs uppercase text-slate-400 font-semibold tracking-wider">Toplam</TableHead>
                                        <TableHead className="w-10 py-2 pr-4"></TableHead>
                                    </TableRow>
                                    </TableHeader>
                                </Table>
                            </div>
                            <div className="min-h-[150px] overflow-y-auto">
                                <Table>
                                    <TableBody className="text-sm divide-y divide-slate-100">
                                        {itemsInGroup.map((item) => {
                                        const originalIndex = fields.findIndex(f => f.formId === item.formId);
                                        if (originalIndex === -1) return null;
                                        const itemValues = watchedItems[originalIndex];
                                        if (!itemValues) return null;
                                        
                                        const itemTotals = calculateItemTotals({
                                            ...itemValues,
                                            exchangeRate: itemValues.currency === 'USD' ? watchedRates.USD : itemValues.currency === 'EUR' ? watchedRates.EUR : 1,
                                        });

                                        return (
                                            <TableRow key={item.formId} className="hover:bg-slate-50 group/row">
                                            <TableCell className="py-1 pl-4 font-medium text-slate-800 w-[30%]">
                                                <FormField control={form.control} name={`items.${originalIndex}.name`} render={({ field }) => <Input {...field} className="w-full h-8 bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary" />} />
                                            </TableCell>
                                            <TableCell className="py-1 w-36">
                                                <FormField control={form.control} name={`items.${originalIndex}.brand`} render={({ field }) => <Input {...field} className="w-32 h-8 bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary" />} />
                                            </TableCell>
                                            <TableCell className="w-24 py-1">
                                                <FormField control={form.control} name={`items.${originalIndex}.quantity`} render={({ field }) => <Input {...field} type="number" step="any" className="w-20 font-mono text-right bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary h-8" />} />
                                            </TableCell>
                                            <TableCell className="py-1 w-24">
                                                <FormField control={form.control} name={`items.${originalIndex}.unit`} render={({ field }) => <Input {...field} className="w-20 h-8 bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary" />} />
                                            </TableCell>
                                            <TableCell className="w-40 py-1 font-mono text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <FormField control={form.control} name={`items.${originalIndex}.listPrice`} render={({ field }) => <Input {...field} type="number" step="any" className="w-24 text-right font-mono bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary h-8"/>} />
                                                    <span className="text-slate-500 font-mono text-xs">{itemValues.currency}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono tabular-nums text-slate-500 py-1 w-32">{formatNumber(itemTotals.tlCost)}</TableCell>
                                            <TableCell className="py-1 w-32">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Controller
                                                        control={form.control}
                                                        name={`items.${originalIndex}.discountRate`}
                                                        render={({ field }) => (
                                                            <Input 
                                                                type="number"
                                                                value={Math.round(field.value * 100)}
                                                                onChange={e => field.onChange(parseFloat(e.target.value) / 100)}
                                                                className="w-16 text-right font-mono bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary h-8" placeholder="15"/>
                                                        )}
                                                    />
                                                    <span className="text-slate-400">%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-1 w-32">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Controller
                                                        control={form.control}
                                                        name={`items.${originalIndex}.profitMargin`}
                                                        render={({ field }) => (
                                                            <Input
                                                                type="number"
                                                                value={Math.round(field.value * 100)}
                                                                onChange={e => field.onChange(parseFloat(e.target.value) / 100)}
                                                                className="w-16 text-right font-mono bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary h-8" placeholder="20"/>
                                                        )}
                                                    />
                                                    <span className="text-slate-400">%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono tabular-nums font-semibold text-slate-600 py-1 w-32 text-lg">{formatNumber(itemTotals.tlSellPrice)}</TableCell>
                                            <TableCell className="text-right font-bold font-mono tabular-nums text-lg text-slate-800 py-1 w-36">{formatCurrency(itemTotals.totalTlSell)}</TableCell>
                                            <TableCell className="px-2 text-center py-1">
                                                <Button variant="ghost" size="icon" onClick={() => remove(originalIndex)} className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                            </TableRow>
                                        );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-2 border-t">
                                <Button type="button" variant="ghost" className="w-full text-sm text-slate-500 hover:text-primary" onClick={() => openProductSelectorForGroup(groupName)}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Bu Gruba Ürün Ekle
                                </Button>
                            </div>
                    </section>
                    )
                })}

                <Button type="button" className="w-full py-6 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-medium bg-white hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex-col items-center gap-1 h-auto" onClick={handleAddNewGroup}>
                    <PlusCircle className="h-6 w-6" />
                    <span>Yeni Mahal / Sistem Grubu Ekle</span>
                </Button>
            </form>
        </Form>
      </main>
      <ProductSelector
        isOpen={isProductSelectorOpen}
        onOpenChange={setIsProductSelectorOpen}
        onProductsSelected={handleProductsSelected}
        targetGroupName={targetGroupForProductAdd}
      />
    </div>
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
        if (productName) {
            getSuggestions();
        }
    }, [productName, existingItems]);


    if (isLoading) {
        return (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3 text-sm text-blue-700">
                <Loader2 size={18} className="animate-spin" />
                <span>AI Asistan, <b>'{productName}'</b> için ilgili parçaları arıyor...</span>
            </div>
        )
    }

    if (suggestions.length === 0) return null;


    return (
         <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-3">
                    <Bot size={20} className="text-primary mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-primary">AI Önerisi: '{productName}'</h4>
                        <p className="text-sm text-blue-800/80">Bu ürünle birlikte aşağıdaki parçaları da eklemek isteyebilirsiniz:</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 -mr-2 -mt-1">
                    <X size={16} />
                </Button>
            </div>
            <div className="pl-8 pt-1">
                <ul className="flex flex-wrap gap-2">
                    {suggestions.map((part, i) => (
                         <li key={i} className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:bg-blue-200">
                            {part}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}

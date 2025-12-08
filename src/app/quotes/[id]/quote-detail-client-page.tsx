
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
  FormMessage,
} from '@/components/ui/form';
import {
  Trash2,
  PlusCircle,
  Loader2,
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
  Box,
  ChevronDown,
  TrendingUp,
  Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
  useUser
} from '@/firebase';
import { calculateItemTotals } from '@/lib/pricing';
import { ProductSelector } from '@/components/app/product-selector';
import type { Product as ProductType } from '@/app/products/products-client-page';
import { cn } from '@/lib/utils';
import type { InstallationType } from '@/app/installation-types/installation-types-client-page';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';


const proposalItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, 'Ürün seçimi zorunludur.'),
  name: z.string(),
  brand: z.string(),
  model: z.string().optional(),
  quantity: z.coerce.number().min(0.01, 'Miktar 0 olamaz.'),
  unit: z.string(),
  listPrice: z.coerce.number(),
  currency: z.enum(['TRY', 'USD', 'EUR']),
  discountRate: z.coerce.number().min(0).max(1),
  profitMargin: z.coerce.number().min(0),
  groupName: z.string().default('Diğer'),
  basePrice: z.coerce.number().default(0), // Alış fiyatı
  vatRate: z.coerce.number().default(0.20),
  priceIncludesVat: z.boolean().default(false),
});

const proposalSchema = z.object({
  versionNote: z.string().optional(),
  termsAndConditions: z.string().optional(),
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
  termsAndConditions?: string;
};

const getGroupIcon = (groupName: string) => {
    const lowerCaseName = groupName.toLowerCase();
    if (lowerCaseName.includes('isitma')) return <Flame className="w-5 h-5 text-red-500" />;
    if (lowerCaseName.includes('sihhi')) return <Droplets className="w-5 h-5 text-blue-500" />;
    if (lowerCaseName.includes('soğutma')) return <Thermometer className="w-5 h-5 text-cyan-500" />;
    if (lowerCaseName.includes('havalandirma')) return <Wind className="w-5 h-5 text-green-500" />;
    if (lowerCaseName.includes('yangin')) return <ShieldCheck className="w-5 h-5 text-orange-500" />;
    return <Wrench className="w-5 h-5 text-slate-500" />;
}

export const ExchangeRateDisplay = ({ form, onRefresh, isFetching }: { form: any, onRefresh: () => void, isFetching: boolean }) => {
    return (
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <FormField control={form.control} name="exchangeRates.EUR" render={({ field }) => (
                <div className="text-right">
                    <span className="block text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">EUR</span>
                    <Input {...field} type="number" step="any" className="h-auto p-0 border-0 rounded-none bg-transparent text-right font-mono text-sm font-bold text-blue-800 dark:text-blue-300 focus-visible:ring-0 w-20" />
                </div>
            )} />
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600"></div>
            <FormField control={form.control} name="exchangeRates.USD" render={({ field }) => (
                <div className="text-right">
                    <span className="block text-[10px] text-green-600 dark:text-green-400 uppercase font-bold">USD</span>
                    <Input {...field} type="number" step="any" className="h-auto p-0 border-0 rounded-none bg-transparent text-right font-mono text-sm font-bold text-green-800 dark:text-green-300 focus-visible:ring-0 w-20" />
                </div>
            )} />
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh} disabled={isFetching}>
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
        </div>
    );
};


// --- Helper function for calculations ---
const calculateAllTotals = (items: ProposalItem[] | undefined, rates: { USD: number; EUR: number } | undefined) => {
   const initialTotals = {
       grandTotalSellExVAT: 0,
       grandTotalCost: 0,
       groupTotals: {} as Record<string, { 
           totalSellInTRY: number; 
           totalCostInTRY: number;
           totalsByCurrency: { TRY: number; USD: number; EUR: number; };
       }>
   };

   if (!items || !rates) return initialTotals;

   const totals = items.reduce((acc, item) => {
       if (!item || !item.quantity || !item.listPrice) return acc;
       const itemTotals = calculateItemTotals({
           ...item,
           exchangeRate: item.currency === 'USD' ? rates.USD : item.currency === 'EUR' ? rates.EUR : 1,
       });
       
       acc.grandTotalSellExVAT += itemTotals.totalTlSell;
       acc.grandTotalCost += itemTotals.totalTlCost;

       const groupName = item.groupName || 'Diğer';
       if (!acc.groupTotals[groupName]) {
           acc.groupTotals[groupName] = { 
               totalSellInTRY: 0,
               totalCostInTRY: 0,
               totalsByCurrency: { TRY: 0, USD: 0, EUR: 0 }
           };
       }
       
       const itemOriginalTotal = itemTotals.originalSellPrice * item.quantity;
       
       acc.groupTotals[groupName].totalSellInTRY += itemTotals.totalTlSell;
       acc.groupTotals[groupName].totalCostInTRY += itemTotals.totalTlCost;
       acc.groupTotals[groupName].totalsByCurrency[item.currency] += itemOriginalTotal;
       
       return acc;
   }, initialTotals);
       
   const VAT_RATE = 0.20;
   const grandTotalProfit = totals.grandTotalSellExVAT - totals.grandTotalCost;
   const grandTotalProfitMargin = totals.grandTotalSellExVAT > 0 ? grandTotalProfit / totals.grandTotalSellExVAT : 0;
   const vatAmount = totals.grandTotalSellExVAT * VAT_RATE;
   const grandTotalSellWithVAT = totals.grandTotalSellExVAT + vatAmount;

   return { 
       groupTotals: totals.groupTotals, 
       grandTotalSellExVAT: totals.grandTotalSellExVAT,
       grandTotalSellWithVAT,
       vatAmount,
       grandTotalCost: totals.grandTotalCost,
       grandTotalProfit,
       grandTotalProfitMargin
   };
}

// Main Component
export function QuoteDetailClientPage() {
  const router = useRouter();
  const params = useParams();
  const proposalId = params.id as string;
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [subHeaderPortal, setSubHeaderPortal] = useState<HTMLElement | null>(null);
  const [exchangeRatePortal, setExchangeRatePortal] = useState<HTMLElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const groupNameInputRef = useRef<HTMLInputElement>(null);
  const [emptyGroups, setEmptyGroups] = useState<string[]>([]);
  const [targetGroupForProductAdd, setTargetGroupForProductAdd] = useState<string | undefined>(undefined);
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [includeVAT, setIncludeVAT] = useState(false);


  // --- Data Fetching ---
  const proposalRef = useMemoFirebase(
    () => (firestore && proposalId ? doc(firestore, 'proposals', proposalId) : null),
    [firestore, proposalId]
  );
  const { data: proposal, isLoading: isProposalLoading } = useDoc<Proposal>(proposalRef);

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

  const defaultTerms = `Teklif Kapsamı:\n- Yukarıdaki listede belirtilen tüm malzemelerin temini.\n- Tüm malzemelerin montajı ve işçiliği.\n- Test ve devreye alma işlemleri.\n\nÖdeme Koşulları:\n- %50 sipariş avansı, %50 iş bitimi.\n\nNotlar:\n- Fiyatlara KDV dahil değildir.\n- Teklif geçerlilik süresi 15 gündür.`;
  
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      versionNote: '',
      termsAndConditions: defaultTerms,
      items: [],
      exchangeRates: { USD: 32.5, EUR: 35.0 }
    },
  });
  
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
    keyName: "formId"
  });
  
  // --- Watchers for real-time updates ---
  const watchedItems = form.watch('items');
  const watchedRates = form.watch('exchangeRates');

  // --- Calculations ---
  const calculatedTotals = calculateAllTotals(watchedItems, watchedRates);


  // --- Effects ---
   useEffect(() => {
    setSubHeaderPortal(document.getElementById('sub-header-portal'));
    setExchangeRatePortal(document.getElementById('exchange-rate-portal'));
  }, []);

  useEffect(() => {
    if (proposal && initialItems) {
        const newItems = initialItems.map(dbItem => ({
            ...dbItem,
            id: dbItem.id,
            productId: dbItem.productId || '',
            groupName: dbItem.groupName || 'Diğer',
        }));

        form.reset({
            versionNote: proposal.versionNote || '',
            termsAndConditions: proposal.termsAndConditions || defaultTerms,
            items: newItems,
            exchangeRates: proposal.exchangeRates || { USD: 32.5, EUR: 35.0 }
        });
        
    }
  }, [proposal, initialItems, form, defaultTerms]);


  useEffect(() => {
    if (editingGroupName && groupNameInputRef.current) {
        groupNameInputRef.current.focus();
        groupNameInputRef.current.select();
    }
  }, [editingGroupName]);

  // Sayfa yüklendiğinde güncel kurları otomatik çek
  useEffect(() => {
    const fetchInitialRates = async () => {
      try {
        const response = await fetch('/api/exchange-rates');
        if (response.ok) {
          const rates = await response.json();
          if (rates.USD && rates.EUR) {
            // Mevcut form değerleri ile karşılaştır, farklıysa güncelle
            const currentUSD = form.getValues('exchangeRates.USD');
            const currentEUR = form.getValues('exchangeRates.EUR');
            
            if (currentUSD !== rates.USD || currentEUR !== rates.EUR) {
              form.setValue('exchangeRates.USD', rates.USD, { shouldDirty: false });
              form.setValue('exchangeRates.EUR', rates.EUR, { shouldDirty: false });
              console.log('Kurlar otomatik güncellendi:', rates);
            }
          }
        }
      } catch (error) {
        console.error('Otomatik kur çekme hatası:', error);
        // Hata durumunda sessizce devam et, mevcut değerleri koru
      }
    };

    // Sadece component mount olduğunda çalıştır
    fetchInitialRates();
  }, []); // Boş dependency array = sadece ilk yüklemede çalışır


  const allGroups = useMemo(() => {
    const itemGroups = fields.reduce((acc, item, index) => {
        const groupName = item.groupName || 'Diğer';
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push({ ...item, originalIndex: index });
        return acc;
    }, {} as Record<string, (ProposalItem & {formId: string, originalIndex: number})[]>);


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

  }, [fields, emptyGroups]);
  
  // --- Event Handlers ---
   const handleProductsSelected = (selectedProducts: ProductType[]) => {
    const groupForProductAdd = targetGroupForProductAdd;
    
    selectedProducts.forEach(product => {
      let groupName = groupForProductAdd || 'Diğer';
      if (!groupForProductAdd && product.installationTypeId && installationTypes) {
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

      const existingItemIndex = fields.findIndex(
          (field, index) => {
            const itemValue = form.getValues(`items.${index}`);
            return itemValue.productId === product.id && itemValue.groupName === groupName
          }
      );

      if (existingItemIndex !== -1) {
          const existingItem = form.getValues(`items.${existingItemIndex}`);
          update(existingItemIndex, {
              ...existingItem,
              quantity: (existingItem.quantity || 0) + 1,
          });
      } else {
          const newItem: ProposalItem = {
              productId: product.id,
              name: product.name,
              brand: product.brand,
              model: product.model || '',
              unit: product.unit,
              quantity: 1,
              listPrice: product.listPrice,
              currency: product.currency,
              discountRate: product.discountRate || 0,
              profitMargin: 0.2, // Default 20%
              groupName: groupName,
              basePrice: product.basePrice,
              vatRate: product.vatRate,
              priceIncludesVat: product.priceIncludesVat
          };
          append(newItem, { shouldFocus: false });
      }
    });

    setIsProductSelectorOpen(false);
    
    if (groupForProductAdd) {
        setEmptyGroups(prev => prev.filter(g => g !== groupForProductAdd));
    }
    setTargetGroupForProductAdd(undefined);
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

    const handleDeleteGroup = (groupName: string) => {
    const indicesToRemove: number[] = [];
    form.getValues('items').forEach((item, index) => {
      if (item.groupName === groupName) {
        indicesToRemove.push(index);
      }
    });

    if (indicesToRemove.length > 0) {
      // It's safer to remove indices in descending order to avoid shifting issues
      remove(indicesToRemove.sort((a, b) => b - a));
    }
    
    // Also remove from empty groups if it exists there
    setEmptyGroups(prev => prev.filter(g => g !== groupName));
    
    toast({
        title: 'Grup Silindi',
        description: `"${groupName}" grubundaki tüm kalemler silindi.`,
    });
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
        termsAndConditions: data.termsAndConditions,
        totalAmount: calculatedTotals.grandTotalSellExVAT,
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
    toast({ title: 'Kurlar alınıyor...', description: 'TCMB\'den güncel veriler çekiliyor.' });
    try {
        const response = await fetch('/api/exchange-rates');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || `API isteği başarısız oldu. Durum: ${response.status}`);
        }
        const rates = await response.json();
        
        if (rates.USD && rates.EUR) {
            form.setValue('exchangeRates.USD', rates.USD, { shouldValidate: true, shouldDirty: true });
            form.setValue('exchangeRates.EUR', rates.EUR, { shouldValidate: true, shouldDirty: true });
            await form.trigger(['exchangeRates.USD', 'exchangeRates.EUR']);
            toast({ title: 'Başarılı!', description: 'Döviz kurları güncellendi.' });
        } else {
            throw new Error("API'den geçerli kur verisi alınamadı.");
        }
    } catch (error: any) {
        console.error("Döviz kuru API hatası:", error);
        toast({ variant: 'destructive', title: 'Hata', description: `Kurlar alınamadı: ${error.message}` });
    } finally {
        setIsFetchingRates(false);
    }
  }

  const handlePrint = () => {
    if (!proposal) return;
    const url = `/quotes/${proposalId}/print?customerId=${proposal.customerId}`;
    window.open(url, '_blank');
  };

  const isLoading = isProposalLoading || isLoadingItems || isLoadingInstallationTypes;
  
  const formatCurrency = (amount: number, currency: 'TRY' | 'USD' | 'EUR' = 'TRY') => {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  }
  const formatNumber = (amount: number) => {
      return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  }

  
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-4">Teklif verileri yükleniyor...</span>
      </div>
    );
  }

  if (!proposal) {
    return (
        <div className="h-full w-full flex items-center justify-center">
            <p>Teklif bulunamadı veya yüklenemedi.</p>
        </div>
    );
  }

  const currencyCycle: Record<'TRY' | 'USD' | 'EUR', 'TRY' | 'USD' | 'EUR'> = {
    'TRY': 'USD',
    'USD': 'EUR',
    'EUR': 'TRY'
  };

  return (
    <Form {...form}>
      <div className="h-full flex flex-col">
        {exchangeRatePortal && createPortal(
            <ExchangeRateDisplay form={form} onRefresh={handleFetchRates} isFetching={isFetchingRates} />,
            exchangeRatePortal
        )}
        {subHeaderPortal && proposal && createPortal(
            <div className="relative bg-background/95 backdrop-blur-sm px-8 py-3 flex justify-between items-center w-full border-b">
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-foreground truncate" title={proposal.projectName}>
                        {proposal.projectName}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-secondary-foreground">{proposal.customerName}</span>
                      <span className="mx-2 text-border">|</span>
                      {proposal.quoteNumber} (v{proposal.version})
                    </p>
                </div>
                 <div className="flex-1 ml-8">
                     <FormField
                        control={form.control}
                        name="versionNote"
                        render={({ field }) => (
                            <Input
                            {...field}
                            placeholder="Bu versiyonla ilgili bir not ekleyin (örn: Isıtma kalemleri revize edildi)"
                            className="w-full bg-secondary"
                            />
                        )}
                        />
                 </div>
            </div>,
            subHeaderPortal
        )}
        <main className="flex-1 overflow-y-auto px-8 py-8 space-y-6 bg-slate-100/70 dark:bg-slate-900/50">
          
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  
                  {allGroups.map(([groupName, itemsInGroup]) => {
                      const groupTotals = calculatedTotals.groupTotals[groupName];
                      const groupSubTotalTRY = groupTotals?.totalSellInTRY || 0;
                      const groupCostTRY = groupTotals?.totalCostInTRY || 0;
                      const groupProfitTRY = groupSubTotalTRY - groupCostTRY;
                      const groupProfitMargin = groupSubTotalTRY > 0 ? (groupProfitTRY / groupSubTotalTRY) : 0;
                      
                      return (
                      <Collapsible key={groupName} defaultOpen={true} asChild>
                        <section className="bg-card rounded-xl shadow-sm border">
                          <div className="flex justify-between items-center w-full group bg-slate-900 dark:bg-slate-800">
                            <CollapsibleTrigger className="px-4 py-2 flex-1 flex items-center cursor-pointer">
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-slate-700 dark:bg-slate-700 flex items-center justify-center">
                                          {getGroupIcon(groupName)}
                                      </div>
                                      <div>
                                      <div className="flex items-center">
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
                                                  className="h-8 text-lg font-bold bg-slate-700 text-white"
                                                  onClick={(e) => e.stopPropagation()}
                                              />
                                          ) : (
                                              <h2 className="font-bold text-white text-lg">{groupName}</h2>
                                          )}
                                      </div>
                                      </div>
                                      <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:-rotate-180" />
                                  </div>
                              </CollapsibleTrigger>
                              <div className="flex items-center gap-2 px-4">
                                  <Button 
                                      type="button"
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-slate-400 hover:text-white"
                                      onClick={(e) => { e.stopPropagation(); setEditingGroupName(groupName); }}
                                  >
                                      <Edit className="h-4 w-4"/>
                                  </Button>
                                  <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                          <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-red-500/70 hover:text-red-500"
                                              onClick={(e) => e.stopPropagation()}
                                          >
                                              <Trash2 className="h-4 w-4"/>
                                          </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                          <AlertDialogHeader>
                                              <AlertDialogTitle>Grubu Silmek İstediğinize Emin misiniz?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                  Bu işlem geri alınamaz. "{groupName}" grubundaki tüm kalemler kalıcı olarak silinecektir.
                                              </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                              <AlertDialogCancel>İptal</AlertDialogCancel>
                                              <AlertDialogAction onClick={() => handleDeleteGroup(groupName)} className="bg-destructive hover:bg-destructive/90">
                                                  Evet, Grubu Sil
                                              </AlertDialogAction>
                                          </AlertDialogFooter>
                                      </AlertDialogContent>
                                  </AlertDialog>

                                  <Badge variant="secondary"><Box className="mr-2 h-3 w-3" />{itemsInGroup.length} Kalem Ürün</Badge>
                              </div>
                          </div>
                          <CollapsibleContent>
                              <div className="overflow-x-auto">
                                  <Table>
                                      <TableHeader className="bg-slate-50 dark:bg-white/5">
                                      <TableRow>
                                          <TableHead className="py-2 pl-4 text-xs uppercase text-slate-500 font-semibold tracking-wider w-[30%]">Ürün Tanımı</TableHead>
                                          <TableHead className="py-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">Marka</TableHead>
                                          <TableHead className="py-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">Model</TableHead>
                                          <TableHead className="py-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">Miktar</TableHead>
                                          <TableHead className="py-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">Liste Fiyatı</TableHead>
                                          <TableHead className="py-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">İskonto</TableHead>
                                          <TableHead className="py-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">Maliyet</TableHead>
                                          <TableHead className="py-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">Kâr (% / Tutar)</TableHead>
                                          <TableHead className="text-right py-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">Birim Fiyat (TL)</TableHead>
                                          <TableHead className="text-right py-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">Toplam (TL)</TableHead>
                                          <TableHead className="w-10 py-2 pr-4"></TableHead>
                                      </TableRow>
                                      </TableHeader>
                                      <TableBody className="text-sm divide-y divide-slate-100 dark:divide-white/5">
                                          {fields.map((field, index) => {
                                              if (field.groupName !== groupName) return null;
                                              
                                              const currentItem = watchedItems?.[index];
                                              if (!currentItem) return null; 

                                              const itemTotals = calculateItemTotals({
                                                  ...currentItem,
                                                  exchangeRate: currentItem.currency === 'USD' ? watchedRates.USD : currentItem.currency === 'EUR' ? watchedRates.EUR : 1,
                                              });

                                          return (
                                              <TableRow key={field.formId} className="hover:bg-slate-50/50 dark:hover:bg-white/5 group/row odd:bg-slate-50/50 dark:odd:bg-white/[.02]">
                                                  <TableCell className="py-1.5 pl-4 font-medium text-card-foreground w-[30%]">
                                                      <FormField control={form.control} name={`items.${index}.name`} render={({ field }) => <Input {...field} className="w-full h-7 bg-transparent border-0 border-b-2 border-transparent focus-visible:ring-0 focus:border-primary" />} />
                                                  </TableCell>
                                                  <TableCell className="py-1.5">
                                                      <FormField control={form.control} name={`items.${index}.brand`} render={({ field }) => <Input {...field} className="w-full h-7 bg-transparent border-0 border-b-2 border-transparent focus-visible:ring-0 focus:border-primary" />} />
                                                  </TableCell>
                                                  <TableCell className="py-1.5">
                                                      <FormField control={form.control} name={`items.${index}.model`} render={({ field }) => <Input {...field} placeholder="Model..." className="w-full h-7 text-xs bg-transparent border-0 border-b-2 border-transparent focus-visible:ring-0 focus:border-primary" />} />
                                                  </TableCell>
                                                  <TableCell className="py-1.5">
                                                      <div className="flex items-center">
                                                          <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => <Input {...field} type="number" step="any" className="w-16 font-mono text-right bg-transparent border-0 border-b-2 border-transparent focus-visible:ring-0 focus:border-primary h-7" />} />
                                                          <FormField control={form.control} name={`items.${index}.unit`} render={({ field }) => <Input {...field} className="w-16 h-7 bg-transparent border-0 border-b-2 border-transparent focus-visible:ring-0 focus:border-primary" />} />
                                                      </div>
                                                  </TableCell>
                                                  <TableCell className="py-1.5 font-mono">
                                                      <div className="flex items-center justify-start gap-2">
                                                          <FormField control={form.control} name={`items.${index}.listPrice`} render={({ field }) => <Input {...field} type="number" step="any" className="w-24 text-right font-mono bg-transparent border-0 border-b-2 border-transparent focus-visible:ring-0 focus:border-primary h-7"/>} />
                                                          <Controller control={form.control} name={`items.${index}.currency`} render={({ field: { onChange, value } }) => (
                                                              <Badge
                                                                  onClick={() => onChange(currencyCycle[value])}
                                                                  variant={value === 'USD' ? 'secondary' : value === 'EUR' ? 'default' : 'outline'}
                                                                  className={cn(
                                                                      "cursor-pointer font-bold w-12 justify-center",
                                                                      value === 'USD' && "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800",
                                                                      value === 'EUR' && "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800"
                                                                  )}
                                                              >
                                                                  {value}
                                                              </Badge>
                                                          )} />
                                                      </div>
                                                  </TableCell>
                                                  <TableCell className="py-1.5">
                                                      <div className="flex items-center justify-start gap-1">
                                                          <Controller
                                                              control={form.control}
                                                              name={`items.${index}.discountRate`}
                                                              render={({ field }) => (
                                                                  <Input 
                                                                      type="number"
                                                                      value={((field.value || 0) * 100)}
                                                                      onChange={(e) => {
                                                                          const numValue = parseFloat(e.target.value);
                                                                          field.onChange(isNaN(numValue) ? 0 : numValue / 100);
                                                                      }}
                                                                      className="w-16 text-right font-mono bg-transparent border-0 border-b-2 border-transparent focus-visible:ring-0 focus:border-primary h-7"
                                                                      placeholder="0"
                                                                  />
                                                              )}
                                                          />
                                                          <span className="text-slate-400">%</span>
                                                      </div>
                                                  </TableCell>
                                                  <TableCell className="py-1.5 font-mono">
                                                      <div className="flex items-center justify-end gap-2">
                                                          <span>{formatNumber(itemTotals.cost)}</span>
                                                          <span className={cn(
                                                          "font-semibold text-xs",
                                                          currentItem.currency === 'USD' && "text-green-600 dark:text-green-400",
                                                          currentItem.currency === 'EUR' && "text-blue-600 dark:text-blue-400",
                                                          currentItem.currency === 'TRY' && "text-slate-500",
                                                          )}>{currentItem.currency}</span>
                                                      </div>
                                                  </TableCell>
                                                  <TableCell className="py-1.5 text-right">
                                                      <div className="flex items-center justify-end gap-2">
                                                          <div className="flex items-center gap-1">
                                                              <Controller
                                                                  control={form.control}
                                                                  name={`items.${index}.profitMargin`}
                                                                  render={({ field }) => (
                                                                      <Input
                                                                          type="number"
                                                                          value={((field.value || 0) * 100)}
                                                                          onChange={(e) => {
                                                                              const numValue = parseFloat(e.target.value);
                                                                              field.onChange(isNaN(numValue) ? 0 : numValue / 100);
                                                                          }}
                                                                          className="w-14 text-right font-mono bg-transparent border-0 border-b-2 border-transparent focus-visible:ring-0 focus:border-primary h-7"
                                                                          placeholder="20"
                                                                      />
                                                                  )}
                                                              />
                                                              <span className="text-slate-400">%</span>
                                                          </div>
                                                          <span className="text-slate-300">|</span>
                                                          <span className="text-xs font-mono text-green-600 font-semibold tabular-nums w-20 text-left">+{formatCurrency(itemTotals.totalProfit)}</span>
                                                      </div>
                                                  </TableCell>
                                                  <TableCell className="text-right font-mono tabular-nums font-semibold text-slate-600 dark:text-slate-300 py-1.5">{formatCurrency(itemTotals.tlSellPrice)}</TableCell>
                                                  <TableCell className="text-right font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100 py-1.5">{formatCurrency(itemTotals.totalTlSell)}</TableCell>
                                                  <TableCell className="px-2 text-center py-1.5">
                                                      <Button variant="ghost" size="icon" onClick={() => remove(index)} className="h-7 w-7 text-slate-400 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                      <Trash2 className="h-4 w-4" />
                                                      </Button>
                                                  </TableCell>
                                                  </TableRow>
                                              );
                                              })}
                                      </TableBody>
                                  </Table>
                              </div>
                              <div className="bg-slate-50 dark:bg-white/5 px-4 py-2 border-t dark:border-white/5">
                                  <Button type="button" size="sm" variant="secondary" onClick={() => openProductSelectorForGroup(groupName)}>
                                      <PlusCircle className="mr-2 h-4 w-4"/>
                                      Bu Gruba Ürün Ekle
                                  </Button>
                              </div>
                              <div className="bg-slate-900 dark:bg-slate-800 text-white px-4 py-3 grid grid-cols-3 items-center gap-8">
                                  <div className="col-span-1">
                                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Döviz Dağılımı (KDV Hariç)</h4>
                                      <div className="space-y-1">
                                          {groupTotals && Object.entries(groupTotals.totalsByCurrency).filter(([, val]) => val > 0).map(([currency, value]) => (
                                              <div key={currency} className="flex justify-between items-center text-sm max-w-xs">
                                                  <span className="text-slate-300">Toplam {currency}</span>
                                                  <span className={cn(
                                                      "font-mono font-bold",
                                                      currency === 'USD' && "text-green-400",
                                                      currency === 'EUR' && "text-blue-400",
                                                  )}>{formatCurrency(value, currency as any)}</span>
                                              </div>
                                          ))}
                                          {groupTotals && Object.values(groupTotals.totalsByCurrency).every(v => v === 0) && (
                                              <div className="text-slate-400 text-xs">Bu grupta ürün yok.</div>
                                          )}
                                      </div>
                                  </div>
                                  <div className="col-span-1 text-right">
                                      <div className="flex items-center justify-end gap-2 text-green-400">
                                          <TrendingUp className="h-4 w-4" />
                                          <p className="text-xs font-semibold uppercase tracking-wider">Grup Kârı</p>
                                      </div>
                                      <p className="font-mono font-bold text-lg text-green-400">{formatCurrency(groupProfitTRY)}</p>
                                      <p className="font-mono text-xs text-green-500 font-semibold">({(groupProfitMargin * 100).toFixed(1)}%)</p>
                                  </div>
                                  <div className="col-span-1 bg-slate-700 text-white rounded-lg px-4 py-2 text-right">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Grup Toplamı (KDV Hariç)</p>
                                      <p className="font-mono font-bold text-xl">{formatCurrency(groupSubTotalTRY)}</p>
                                  </div>
                              </div>
                          </CollapsibleContent>
                          </section>
                      </Collapsible>
                      )
                  })}
                  <div className="space-y-4">
                      <Button type="button" variant="outline" className="w-full" onClick={handleAddNewGroup}>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Yeni Grup Ekle
                      </Button>
                  </div>
                  
                  <div className="bg-card rounded-xl shadow-sm border p-6">
                      <FormField
                          control={form.control}
                          name="termsAndConditions"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel className="font-semibold text-lg">Teklif Koşulları</FormLabel>
                                  <FormControl>
                                      <Textarea
                                          {...field}
                                          placeholder="Teklifin kapsamı, ödeme koşulları ve diğer notlar..."
                                          className="h-40 text-sm bg-secondary"
                                      />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                  </div>
              </form>
        </main>

        <div className="sticky bottom-0 left-0 right-0 z-20">
            <div className="bg-background/80 backdrop-blur-md shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)] rounded-t-2xl max-w-7xl mx-auto px-6 py-3 grid grid-cols-2 gap-x-8">
                  {/* Sol: Finansal Özet */}
                  <div className="col-span-1 flex items-center justify-between">
                     <div className="flex items-center gap-x-4">
                        {!includeVAT ? (
                          <div>
                              <p className="text-sm font-semibold text-blue-600">Genel Toplam (KDV Hariç)</p>
                              <p className="font-mono text-4xl font-extrabold text-blue-700">{formatCurrency(calculatedTotals.grandTotalSellExVAT)}</p>
                          </div>
                      ) : (
                          <div className="flex items-end gap-x-2">
                              <div>
                                  <p className="text-xs text-muted-foreground">Ara Toplam</p>
                                  <p className="font-mono text-lg font-bold text-foreground">{formatCurrency(calculatedTotals.grandTotalSellExVAT)}</p>
                              </div>
                              <div className="text-lg text-muted-foreground">+</div>
                              <div>
                                  <p className="text-xs text-muted-foreground">KDV (%{new Intl.NumberFormat('tr-TR').format(0.20 * 100)})</p>
                                  <p className="font-mono text-lg font-bold text-foreground">{formatCurrency(calculatedTotals.vatAmount)}</p>
                              </div>
                              <div className="text-lg text-muted-foreground">=</div>
                              <div>
                                  <p className="text-sm font-semibold text-blue-600">Toplam</p>
                                  <p className="font-mono text-3xl font-extrabold text-blue-700">{formatCurrency(calculatedTotals.grandTotalSellWithVAT)}</p>
                              </div>
                          </div>
                      )}
                     </div>
                      <div className="text-left">
                          <div className="flex items-center gap-2 text-green-600">
                              <TrendingUp className="h-5 w-5" />
                              <p className="text-sm font-semibold uppercase tracking-wider">Toplam Kâr</p>
                          </div>
                          <p className="font-mono font-bold text-2xl">{formatCurrency(calculatedTotals.grandTotalProfit)}</p>
                          <p className="font-mono text-sm text-green-700 font-semibold">({(calculatedTotals.grandTotalProfitMargin * 100).toFixed(1)}%)</p>
                      </div>
                  </div>


                  {/* Sağ Taraf: Kontroller */}
                  <div className="col-span-1 flex items-center justify-end gap-4">
                      <div className="flex flex-col gap-2 items-center">
                          <div className="flex items-center space-x-2">
                              <Switch id="vat-switch" checked={includeVAT} onCheckedChange={setIncludeVAT} />
                              <Label htmlFor="vat-switch" className="text-sm font-medium">
                                  KDV Dahil
                              </Label>
                          </div>
                          <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={handlePrint}
                          >
                              <FileDown className="mr-2 h-4 w-4" /> PDF
                          </Button>
                      </div>
                      <Button onClick={form.handleSubmit(handleSaveChanges)} disabled={isSaving} size="lg" className="rounded-full h-14 w-44 text-base">
                          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                          Kaydet
                      </Button>
                  </div>
            </div>
        </div>
      </div>
       <ProductSelector
        isOpen={isProductSelectorOpen}
        onOpenChange={setIsProductSelectorOpen}
        onProductsSelected={handleProductsSelected}
        targetGroupName={targetGroupForProductAdd}
      />
    </Form>
  );
}

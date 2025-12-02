'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  getDoc,
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
  ChevronDown,
  Edit,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { calculatePrice } from '@/lib/pricing';
import { ProductSelector } from '@/components/app/product-selector';
import type { Product as ProductType } from '@/app/products/page';
import { suggestMissingParts } from '@/ai/flows/suggest-missing-parts';
import { cn } from '@/lib/utils';
import type { InstallationType } from '@/app/installation-types/page';


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
  // New grouping field
  groupName: z.string().default('Diğer'),
  // Calculated fields, not part of the type
  cost: z.number().optional(),
  unitPrice: z.number().optional(),
  total: z.number().optional(),
});

const proposalSchema = z.object({
  versionNote: z.string().optional(),
  items: z.array(proposalItemSchema),
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

// Main Component
export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params.id as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [activeProductForAISuggestion, setActiveProductForAISuggestion] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const groupNameInputRef = useRef<HTMLInputElement>(null);
  const [emptyGroups, setEmptyGroups] = useState<string[]>([]);
  const [targetGroupForProductAdd, setTargetGroupForProductAdd] = useState<string | undefined>(undefined);


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
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
    keyName: 'formId',
  });

  const allGroups = useMemo(() => {
    const currentItems = form.watch('items');
    
    // Group items by 'groupName'
    const itemGroups = currentItems.reduce((acc, item, index) => {
      const groupName = item.groupName || 'Diğer';
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push({ ...item, originalIndex: index });
      return acc;
    }, {} as Record<string, (ProposalItem & { originalIndex: number })[]>);

    // Add empty groups to the map if they don't already exist
    emptyGroups.forEach(groupName => {
        if (!itemGroups[groupName]) {
            itemGroups[groupName] = [];
        }
    });

    // Sort the groups by name, except for 'Diğer' which should be last
    return Object.entries(itemGroups).sort(([a], [b]) => {
      if (a === 'Diğer') return 1;
      if (b === 'Diğer') return -1;
      return a.localeCompare(b);
    });

  }, [form.watch('items'), emptyGroups]);
  
  // --- Effects ---
  useEffect(() => {
    if (proposal && initialItems) {
      form.reset({
        versionNote: proposal.versionNote || '',
        items: initialItems.map((item) => ({
          ...item,
          productId: item.productId || '',
          groupName: item.groupName || 'Diğer',
        })),
      });
    }
  }, [proposal, initialItems, form]);
  
  useEffect(() => {
    if (editingGroupName && groupNameInputRef.current) {
        groupNameInputRef.current.focus();
        groupNameInputRef.current.select();
    }
  }, [editingGroupName]);


  // --- Calculations ---
  const totals = useMemo(() => {
    const items = form.watch('items');
    const exchangeRates = proposal?.exchangeRates || { USD: 1, EUR: 1 };
    
    let grandTotalTRY = 0;

    const groupTotals = Object.fromEntries(allGroups.map(([groupName, itemsInGroup]) => {
        const groupTotal = itemsInGroup.reduce((total, item) => {
            const exchangeRate =
                item.currency === 'USD' ? exchangeRates.USD :
                item.currency === 'EUR' ? exchangeRates.EUR : 1;

            const priceInfo = calculatePrice({
                listPrice: item.listPrice,
                discountRate: item.discountRate,
                profitMargin: item.profitMargin,
                exchangeRate: exchangeRate,
            });
            return total + (priceInfo.tlSellPrice * item.quantity);
        }, 0);
        return [groupName, groupTotal];
    }));

    grandTotalTRY = Object.values(groupTotals).reduce((sum, total) => sum + total, 0);

    return { grandTotal: grandTotalTRY, groupTotals };
  }, [form.watch('items'), proposal?.exchangeRates, allGroups]);


  // --- Event Handlers ---
   const handleProductsSelected = (selectedProducts: ProductType[]) => {
    
    const newItems = selectedProducts.map(product => {
      let groupName = 'Diğer';

      if (targetGroupForProductAdd) {
        groupName = targetGroupForProductAdd;
      } else if (product.installationTypeId && installationTypes) {
         // Find the top-level parent
         let current = installationTypes.find(it => it.id === product.installationTypeId);
         let parent = current;
         while(parent?.parentId) {
             const nextParent = installationTypes.find(it => it.id === parent?.parentId);
             if (nextParent) {
                 parent = nextParent;
             } else {
                 break;
             }
         }
         groupName = parent?.name || 'Diğer';
      }

      return {
          productId: product.id,
          name: product.name,
          brand: product.brand,
          unit: product.unit,
          quantity: 1,
          listPrice: product.listPrice,
          currency: product.currency,
          discountRate: product.discountRate,
          profitMargin: 0.2, // Default 20%
          groupName: groupName,
      };
    });
    append(newItems);
    setIsProductSelectorOpen(false);

    // If an empty group receives items, remove it from the emptyGroups state
    if (targetGroupForProductAdd) {
        setEmptyGroups(prev => prev.filter(g => g !== targetGroupForProductAdd));
    }

    if (newItems.length > 0) {
      setActiveProductForAISuggestion(newItems[0].name);
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

    // Update items in the form
    const currentItems = form.getValues('items');
    const updatedItems = currentItems.map(item => 
        item.groupName === oldName ? { ...item, groupName: newName } : item
    );
    form.setValue('items', updatedItems, { shouldDirty: true });

    // Update empty groups state if the renamed group was an empty one
    setEmptyGroups(prev => prev.map(g => g === oldName ? newName : g));
    
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
        totalAmount: totals.grandTotal,
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
        const { cost, unitPrice, total, ...dbItem } = item;
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


  const isLoading = isLoadingProposal || isLoadingItems || isLoadingInstallationTypes;

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
  
  const formatCurrency = (amount: number, currency: 'TRY' | 'USD' | 'EUR' = 'TRY') => {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  }

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSaveChanges)}>
        
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm -mx-8 -mt-8 mb-8 px-8 py-4 flex justify-between items-center">
            <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Wrench className="w-6 h-6 text-primary" /> MechQuote <span className="text-slate-400 font-normal text-sm">| {proposal.quoteNumber} (v{proposal.version})</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">Müşteri: <span className="font-medium text-slate-700">{proposal.customerName}</span> • Proje: <span className="font-medium text-slate-700">{proposal.projectName}</span></p>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex gap-4 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                    <div className="text-right">
                        <span className="block text-[10px] text-slate-400 uppercase font-bold">Döviz (EUR)</span>
                        <span className="block font-mono text-sm font-bold text-slate-700">{proposal.exchangeRates.EUR.toFixed(2)} ₺</span>
                    </div>
                    <div className="w-px bg-slate-300"></div>
                     <div className="text-right">
                        <span className="block text-[10px] text-slate-400 uppercase font-bold">Döviz (USD)</span>
                        <span className="block font-mono text-sm font-bold text-slate-700">{proposal.exchangeRates.USD.toFixed(2)} ₺</span>
                    </div>
                </div>
                 <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/quotes/${proposalId}/print?customerId=${proposal.customerId}`)}
                    className="hidden sm:flex"
                >
                    <FileDown className="mr-2 h-4 w-4" /> PDF
                </Button>
                <Button type="submit" disabled={isSaving} className="bg-primary text-white hover:bg-primary/90 transition">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Değişiklikleri Kaydet
                </Button>
            </div>
        </header>

        <div className="space-y-8 pb-24">
             {activeProductForAISuggestion && (
                <AISuggestionBox 
                    productName={activeProductForAISuggestion}
                    existingItems={form.watch('items').map(i => i.name)}
                    onClose={() => setActiveProductForAISuggestion(null)}
                />
            )}
            
            {allGroups.map(([groupName, itemsInGroup]) => (
                 <section key={groupName} className="group/section relative">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50/70 px-6 py-4 border-b border-slate-200 flex justify-between items-center group/header">
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
                            <div className="text-right">
                               <p className="text-xs text-slate-500">Grup Toplamı</p>
                               <p className="font-mono font-bold text-slate-700">{formatCurrency(totals.groupTotals[groupName] || 0)}</p>
                            </div>
                        </div>

                        <Table>
                            <TableHeader className="bg-white text-xs uppercase text-slate-400 font-semibold tracking-wider border-b border-slate-100">
                              <TableRow>
                                <TableHead className="w-2/5">Malzeme / Poz</TableHead>
                                <TableHead className="text-center">Miktar</TableHead>
                                <TableHead className="text-center">Liste Fiyatı</TableHead>
                                <TableHead className="text-center">İsk. (%)</TableHead>
                                <TableHead className="text-center">Kâr (%)</TableHead>
                                <TableHead className="text-right">Birim Fiyat</TableHead>
                                <TableHead className="text-right">Toplam</TableHead>
                                <TableHead className="w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="text-sm divide-y divide-slate-100">
                              {itemsInGroup.map((item) => {
                                const index = item.originalIndex;
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
                                  <TableRow key={item.id || item.productId + index} className="hover:bg-slate-50 group/row">
                                    <TableCell>
                                        <div className="font-medium text-slate-800">{itemValues.name}</div>
                                        <div className="text-xs text-slate-500">{itemValues.brand} • {itemValues.unit}</div>
                                    </TableCell>
                                    <TableCell className="w-24">
                                      <FormField
                                        control={form.control}
                                        name={`items.${index}.quantity`}
                                        render={({ field }) => <Input {...field} type="number" step="any" className="w-24 text-center bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary" />}
                                      />
                                    </TableCell>
                                    <TableCell className="w-40">
                                        <div className="flex items-center justify-end gap-1">
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.listPrice`}
                                                render={({ field }) => <Input {...field} type="number" step="any" className="w-28 text-right bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary"/>}
                                            />
                                            <span className="text-slate-500 font-mono text-xs">{itemValues.currency}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="w-28">
                                       <FormField
                                            control={form.control}
                                            name={`items.${index}.discountRate`}
                                            render={({ field }) => <Input {...field} type="number" step="0.01" className="w-24 text-center bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary" placeholder="0.15"/>}
                                        />
                                    </TableCell>
                                     <TableCell className="w-28">
                                       <FormField
                                            control={form.control}
                                            name={`items.${index}.profitMargin`}
                                            render={({ field }) => <Input {...field} type="number" step="0.01" className="w-24 text-center bg-transparent border-0 border-b border-dashed rounded-none focus-visible:ring-0 focus:border-solid focus:border-primary" placeholder="0.20"/>}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-slate-600">
                                        {formatCurrency(priceInfo.tlSellPrice)}
                                    </TableCell>
                                     <TableCell className="text-right font-bold font-mono text-slate-800">
                                        {formatCurrency(priceInfo.tlSellPrice * (itemValues.quantity || 0))}
                                     </TableCell>
                                    <TableCell className="px-2 text-center">
                                      <Button variant="ghost" size="icon" onClick={() => remove(index)} className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                        </Table>
                         <div className="p-2">
                           <Button type="button" variant="ghost" className="w-full text-sm text-slate-500 hover:text-primary" onClick={() => openProductSelectorForGroup(groupName)}>
                             <PlusCircle className="mr-2 h-4 w-4" /> Bu Gruba Ürün Ekle
                           </Button>
                        </div>
                    </div>
                </section>
            ))}

            <Button type="button" className="w-full py-6 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-medium bg-white hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex-col items-center gap-1 h-auto" onClick={handleAddNewGroup}>
                <PlusCircle className="h-6 w-6" />
                <span>Yeni Mahal / Sistem Grubu Ekle</span>
            </Button>
        </div>

        <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-30">
            <div className="max-w-7xl mx-auto px-8">
                <div className="flex justify-between items-center h-20">
                    <div className="text-xs text-slate-500 space-x-4">
                        <span>Toplam Kalem: <b className="font-mono">{fields.length}</b></span>
                         <span>Toplam Grup: <b className="font-mono">{allGroups.length}</b></span>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-sm text-slate-500 mb-1">Genel Toplam (KDV Dahil):</span>
                        <span className="text-3xl font-bold font-mono text-slate-900">{formatCurrency(totals.grandTotal * 1.2)}</span>
                    </div>
                </div>
            </div>
        </footer>
      </form>
    </Form>

    <ProductSelector 
        isOpen={isProductSelectorOpen}
        onOpenChange={setIsProductSelectorOpen}
        onProductsSelected={handleProductsSelected}
        targetGroupName={targetGroupForProductAdd}
    />
    </>
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

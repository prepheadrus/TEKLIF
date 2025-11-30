
'use client';

import { useState, useMemo, useEffect, useCallback }from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, RefreshCw, Save, Eraser, Download, Edit, History, Search, Loader2, Sparkles, PlusCircle } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore, useUser, useMemoFirebase, deleteDocumentNonBlocking, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, query, writeBatch, doc, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { calculatePrice } from '@/lib/pricing';
import { useToast } from "@/hooks/use-toast";
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { suggestMissingParts } from '@/ai/flows/suggest-missing-parts';
import { QuickAddProduct } from '@/components/app/quick-add-product';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"

type Customer = { id: string; name: string; [key: string]: any };
type Product = { 
    id: string; 
    name: string; 
    brand: string; 
    unit: string; 
    listPrice: number; 
    currency: 'TRY' | 'USD' | 'EUR'; 
    discountRate: number;
    [key: string]: any 
};

type QuoteItem = {
    // ID is just the product ID for client-side uniqueness
    id: string;
    productId: string;
    name: string;
    brand:string;
    quantity: number;
    unit: string;
    listPrice: number;
    currency: 'TRY' | 'USD' | 'EUR';
    discountRate: number; // 0.15 for 15%
    profitMargin: number; // 0.25 for 25%
    // Calculated fields
    cost: number;
    unitPrice: number; // sell price in original currency
    unitProfit: number;
    total: number; // total sell price in original currency
};

type ProposalStatus = 'Draft' | 'Sent' | 'Approved' | 'Rejected';

type Proposal = {
    id: string;
    rootProposalId: string;
    version: number;
    quoteNumber: string;
    createdAt: { seconds: number, nanoseconds: number };
    customerName: string;
    projectName: string;
    customerId: string;
    totalAmount: number;
    versionNote: string;
    status: ProposalStatus;
    exchangeRates: { USD: number, EUR: number };
};

// Represents a group of proposal revisions
type ProposalGroup = {
    rootId: string;
    latest: Proposal;
    versions: Proposal[];
}

function CreateQuoteTab({ onQuoteSaved, onSetActiveTab, quoteToEdit }: { onQuoteSaved: () => void, onSetActiveTab: (tab: string) => void, quoteToEdit: Proposal | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();

    // State definitions
    const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [quantityToAdd, setQuantityToAdd] = useState<number>(1);
    const [exchangeRates, setExchangeRates] = useState({ USD: 34.50, EUR: 36.20 });
    const [globalProfitMargin, setGlobalProfitMargin] = useState(25);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState('');
    const [versionNote, setVersionNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isVatIncluded, setIsVatIncluded] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isFetchingRates, setIsFetchingRates] = useState(false);
    const [productsTrigger, setProductsTrigger] = useState(0);
    const [quoteHeader, setQuoteHeader] = useState('Teklif Oluştur / Düzenle');
    const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
    const VAT_RATE = 0.20;


    // Data fetching
    const customersQuery = useMemoFirebase(() => 
        firestore ? collection(firestore, 'customers') : null,
        [firestore]
    );
    const { data: customers, isLoading: areCustomersLoading } = useCollection<Customer>(customersQuery);

    const productsQuery = useMemoFirebase(() =>
        firestore ? collection(firestore, 'products') : null,
        [firestore, productsTrigger]
    );
    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    useEffect(() => {
        const loadQuoteForEditing = async () => {
            if (quoteToEdit && firestore) {
                setEditingProposal(quoteToEdit);
                setQuoteHeader(`Teklif Revizyonu: ${quoteToEdit.quoteNumber} (Yeni Versiyon)`);
                setProjectName(quoteToEdit.projectName);
                setSelectedCustomerId(quoteToEdit.customerId);
                setVersionNote(`Revizyon: ${new Date().toLocaleDateString('tr-TR')}`);
                setExchangeRates(quoteToEdit.exchangeRates || { USD: 34.50, EUR: 36.20 });

                const itemsSnapshot = await getDocs(collection(firestore, 'proposals', quoteToEdit.id, 'proposal_items'));
                const loadedItems: QuoteItem[] = itemsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    const newItem: QuoteItem = {
                        id: doc.id,
                        productId: data.productId,
                        name: data.name,
                        brand: data.brand,
                        quantity: data.quantity,
                        unit: data.unit,
                        listPrice: data.listPrice,
                        currency: data.currency,
                        discountRate: data.discountRate,
                        profitMargin: data.profitMargin,
                        cost: 0,
                        unitPrice: 0,
                        unitProfit: 0,
                        total: 0,
                    };
                     const priceResult = calculatePrice({
                        listPrice: newItem.listPrice,
                        discountRate: newItem.discountRate,
                        profitMargin: newItem.profitMargin,
                        exchangeRate: 1, 
                    });
                    
                    newItem.cost = priceResult.cost;
                    newItem.unitPrice = priceResult.originalSellPrice;
                    newItem.unitProfit = priceResult.originalSellPrice - priceResult.cost;
                    newItem.total = priceResult.originalSellPrice * newItem.quantity;
                    
                    return newItem;
                });
                
                if (loadedItems.length > 0) {
                   const firstItemProfitMargin = loadedItems[0].profitMargin;
                   setGlobalProfitMargin(Math.round(firstItemProfitMargin * 100));
                }
                
                setQuoteItems(loadedItems);
            }
        };

        loadQuoteForEditing();
    }, [quoteToEdit, firestore]);


    const updateItem = (itemId: string, newValues: Partial<Omit<QuoteItem, 'id'>>) => {
        setQuoteItems(prevItems =>
            prevItems.map(item => {
                if (item.id === itemId) {
                    const updatedItem = { ...item, ...newValues };
                    
                    const priceResult = calculatePrice({
                        listPrice: updatedItem.listPrice,
                        discountRate: updatedItem.discountRate,
                        profitMargin: updatedItem.profitMargin,
                        exchangeRate: 1,
                    });

                    return {
                        ...updatedItem,
                        cost: priceResult.cost,
                        unitPrice: priceResult.originalSellPrice,
                        unitProfit: priceResult.originalSellPrice - priceResult.cost,
                        total: priceResult.originalSellPrice * updatedItem.quantity,
                    };
                }
                return item;
            })
        );
    };

    const handleAddProduct = async () => {
        if (!selectedProductId || !products) return;
        const productToAdd = products.find(p => p.id === selectedProductId);
        if (!productToAdd) return;

        const existingItem = quoteItems.find(item => item.productId === productToAdd.id);

        if (existingItem) {
            updateItem(existingItem.id, { quantity: existingItem.quantity + quantityToAdd });
            toast({
                title: "Miktar Güncellendi",
                description: `${productToAdd.name} ürününün miktarı ${quantityToAdd} adet artırıldı.`,
            });
        } else {
            const priceResult = calculatePrice({
                listPrice: productToAdd.listPrice,
                discountRate: productToAdd.discountRate,
                profitMargin: globalProfitMargin / 100,
                exchangeRate: 1,
            });

            const newItem: QuoteItem = {
                id: productToAdd.id,
                productId: productToAdd.id,
                name: productToAdd.name,
                brand: productToAdd.brand,
                quantity: quantityToAdd,
                unit: productToAdd.unit,
                listPrice: productToAdd.listPrice,
                currency: productToAdd.currency,
                discountRate: productToAdd.discountRate,
                profitMargin: globalProfitMargin / 100,
                cost: priceResult.cost,
                unitPrice: priceResult.originalSellPrice,
                unitProfit: priceResult.originalSellPrice - priceResult.cost,
                total: priceResult.originalSellPrice * quantityToAdd,
            };
            
            const updatedItems = [...quoteItems, newItem];
            setQuoteItems(updatedItems);
            setIsSuggesting(true);
            try {
                const existingParts = updatedItems.map(item => item.name);
                const result = await suggestMissingParts({
                    productName: productToAdd.name,
                    existingParts: existingParts,
                });

                if (result.suggestedParts && result.suggestedParts.length > 0) {
                    toast({
                        title: "AI Önerisi ✨",
                        description: `Şunları da eklemek isteyebilirsiniz: ${result.suggestedParts.join(', ')}`,
                        duration: 8000,
                    });
                }
            } catch (error) {
                console.error("AI suggestion failed:", error);
            } finally {
                setIsSuggesting(false);
            }
        }
        
        setSelectedProductId(null);
        setQuantityToAdd(1);
    };
    
    const handleRemoveItem = (itemId: string) => {
        setQuoteItems(prevItems => prevItems.filter(item => item.id !== itemId));
    };
    
    const applyGlobalProfitMargin = () => {
        setQuoteItems(prevItems =>
            prevItems.map(item => {
                const profitMargin = globalProfitMargin / 100;
                const priceResult = calculatePrice({
                    listPrice: item.listPrice,
                    discountRate: item.discountRate,
                    profitMargin: profitMargin,
                    exchangeRate: 1,
                });
                return {
                    ...item,
                    profitMargin: profitMargin,
                    unitPrice: priceResult.originalSellPrice,
                    unitProfit: priceResult.originalSellPrice - priceResult.cost,
                    total: priceResult.originalSellPrice * item.quantity,
                };
            })
        );
         toast({
            title: "Başarılı",
            description: `Tüm ürünlere %${globalProfitMargin} kâr marjı uygulandı.`,
        });
    };

    const handleExchangeRateChange = (currency: 'USD' | 'EUR', value: string) => {
        const rate = parseFloat(value) || 0;
        setExchangeRates(prev => ({...prev, [currency]: rate}));
    }

    const fetchExchangeRates = async () => {
        setIsFetchingRates(true);
        toast({ title: "Kurlar Alınıyor...", description: "TCMB'den güncel döviz kurları çekiliyor." });
        try {
            const response = await fetch('https://cors-anywhere.herokuapp.com/https://www.tcmb.gov.tr/kurlar/today.xml');
            if (!response.ok) throw new Error('Network response was not ok.');
            const data = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(data, "application/xml");
            
            const usdRate = xml.querySelector('Currency[Kod="USD"] ForexBuying')?.textContent;
            const eurRate = xml.querySelector('Currency[Kod="EUR"] ForexBuying')?.textContent;

            if (usdRate && eurRate) {
                const updatedRates = {
                    USD: parseFloat(usdRate),
                    EUR: parseFloat(eurRate)
                };
                setExchangeRates(updatedRates);
                toast({
                    title: "Kurlar Güncellendi!",
                    description: `USD: ${updatedRates.USD.toFixed(4)} - EUR: ${updatedRates.EUR.toFixed(4)}`,
                });
            } else {
                 throw new Error("XML'den kurlar ayrıştırılamadı.");
            }
        } catch (error) {
            console.error("Failed to fetch exchange rates:", error);
            toast({
                variant: "destructive",
                title: "Hata",
                description: "Döviz kurları alınamadı. Lütfen daha sonra tekrar deneyin veya manuel olarak girin.",
            });
        } finally {
            setIsFetchingRates(false);
        }
    };


    const formatCurrency = (price: number, currency: string) => {
        const displayCurrency = currency === 'TL' ? 'TRY' : currency;
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: displayCurrency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
    }
    
    const quoteTotals = useMemo(() => {
        const subtotalTRY = quoteItems.reduce((acc, item) => {
            const exchangeRate = item.currency === 'TRY' ? 1 : (exchangeRates[item.currency] || 1);
            return acc + (item.total * exchangeRate);
        }, 0);

        let vatAmount = 0;
        let grandTotal = subtotalTRY;

        if (isVatIncluded) {
             grandTotal = subtotalTRY;
             vatAmount = grandTotal - (grandTotal / (1 + VAT_RATE));
        } else {
            vatAmount = subtotalTRY * VAT_RATE;
            grandTotal = subtotalTRY + vatAmount;
        }

        return {
            subtotal: isVatIncluded ? grandTotal - vatAmount : subtotalTRY,
            vat: vatAmount,
            grandTotal: grandTotal
        };
    }, [quoteItems, exchangeRates, isVatIncluded, VAT_RATE]);


    const clearForm = () => {
        setQuoteItems([]);
        setSelectedCustomerId(null);
        setProjectName('');
        setVersionNote('');
        setGlobalProfitMargin(25);
        setQuoteHeader('Teklif Oluştur');
        setEditingProposal(null);
        toast({
            title: "Form Temizlendi",
            description: "Yeni bir teklif oluşturmaya hazırsınız.",
        });
    };
    
    async function getNextQuoteNumber(firestore: any): Promise<string> {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `${month}${year}`;

        const proposalsRef = collection(firestore, 'proposals');
        const q = query(
            proposalsRef, 
            where("quoteNumber", ">=", prefix),
            where("quoteNumber", "<", prefix + 'z'),
            orderBy("quoteNumber", "desc"),
            limit(1)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return `${prefix}/001`;
        } else {
            const lastQuoteNumber = querySnapshot.docs[0].data().quoteNumber;
            const lastSeq = parseInt(lastQuoteNumber.split('/')[1] || '0');
            const newSeq = (lastSeq + 1).toString().padStart(3, '0');
            return `${prefix}/${newSeq}`;
        }
    }

    const handleSaveQuote = useCallback(async (
        currentEditingProposal: Proposal | null,
        currentCustomerId: string | null,
        currentQuoteItems: QuoteItem[]
    ) => {
        if (!firestore) {
            toast({ variant: "destructive", title: "Hata", description: "Veritabanı bağlantısı yok." });
            return;
        }
        if (!currentCustomerId) {
            toast({ variant: "destructive", title: "Eksik Bilgi", description: "Lütfen bir müşteri seçin." });
            return;
        }
        if (currentQuoteItems.length === 0) {
            toast({ variant: "destructive", title: "Eksik Bilgi", description: "Lütfen sepete en az bir ürün ekleyin." });
            return;
        }

        setIsSaving(true);
        const selectedCustomer = customers?.find(c => c.id === currentCustomerId);
        
        try {
            const batch = writeBatch(firestore);
            const proposalRef = doc(collection(firestore, 'proposals'));

            const isRevision = !!currentEditingProposal;
            let rootProposalId: string;
            let version: number;
            let quoteNumber: string;

            if (isRevision && currentEditingProposal) {
                rootProposalId = currentEditingProposal.rootProposalId;
                version = currentEditingProposal.version + 1;
                quoteNumber = currentEditingProposal.quoteNumber;
            } else {
                rootProposalId = proposalRef.id; 
                version = 1;
                quoteNumber = await getNextQuoteNumber(firestore);
            }
            
            const proposalData = {
                rootProposalId: rootProposalId,
                version: version,
                quoteNumber: quoteNumber,
                customerId: currentCustomerId,
                customerName: selectedCustomer?.name || 'Bilinmeyen Müşteri',
                projectName: projectName || 'Genel Teklif',
                status: 'Draft' as const,
                totalAmount: quoteTotals.grandTotal,
                exchangeRates,
                versionNote: versionNote || (isRevision ? `Versiyon ${version}` : 'İlk Versiyon'),
                createdAt: new Date(),
            };

            batch.set(proposalRef, proposalData);

            for (const item of currentQuoteItems) {
                const itemRef = doc(collection(proposalRef, 'proposal_items'));
                const { id, ...itemData } = item;
                batch.set(itemRef, {
                    ...itemData,
                    proposalId: proposalRef.id,
                });
            }

            await batch.commit();

            toast({
                title: "Başarılı!",
                description: `Teklif (${quoteNumber} - V${version}) başarıyla kaydedildi.`,
            });
            clearForm();
            onQuoteSaved();
            onSetActiveTab('archive');

        } catch (error: any) {
            console.error("Teklif kaydedilirken hata oluştu:", error);

            const permissionError = new FirestorePermissionError({
              path: `proposals/some-id or subcollections`,
              operation: 'write',
              requestResourceData: {
                  items: currentQuoteItems.map(({id, ...rest}) => rest),
              }
            });
            errorEmitter.emit('permission-error', permissionError);

            toast({
                variant: "destructive",
                title: "Teklif kaydedilirken bir sorun oluştu",
                description: error.message || "Gerekli izinlere sahip olmayabilirsiniz. Lütfen konsolu kontrol edin.",
            });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, customers, projectName, quoteTotals, exchangeRates, versionNote, onQuoteSaved, onSetActiveTab, toast]);
    
    const tableInputClass = "h-8 w-full bg-transparent border-0 rounded-none focus:outline-none focus:ring-1 focus:ring-primary p-1";


    return (
        <>
        <QuickAddProduct 
            isOpen={isQuickAddOpen} 
            onOpenChange={setIsQuickAddOpen}
            onProductAdded={() => setProductsTrigger(t => t + 1)}
        />
        <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{quoteHeader}</h1>
                    <p className="text-muted-foreground">
                        {editingProposal 
                            ? `Mevcut Teklif: ${editingProposal.quoteNumber} - V${editingProposal.version}`
                            : 'Yeni teklif oluşturuluyor.'
                        }
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={clearForm} disabled={isSaving}><Eraser className="mr-2 h-4 w-4" /> Temizle</Button>
                    <Input placeholder="Versiyon Notu Girin (Örn: Müşteri isteği üzerine pompa değişti)" className="w-96" value={versionNote} onChange={e => setVersionNote(e.target.value)} />
                    <Button onClick={() => handleSaveQuote(editingProposal, selectedCustomerId, quoteItems)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Kaydet
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 flex flex-col gap-4">
                <Card>
                    <CardHeader><CardTitle>Cari & Proje Bilgileri</CardTitle></CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <Select 
                            onValueChange={setSelectedCustomerId} 
                            value={selectedCustomerId || ""} 
                            disabled={areCustomersLoading || isSaving}
                        >
                            <SelectTrigger>
                               <SelectValue placeholder={areCustomersLoading ? "Müşteriler yükleniyor..." : "Müşteri Seçiniz..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Input 
                            placeholder="Proje Adı (Örn: Villa Mekanik Tesisat İşleri)" 
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                            disabled={isSaving}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Ürün Sepeti (Metraj Cetveli)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex gap-2 mb-4">
                            <Select 
                                value={selectedProductId || ""}
                                onValueChange={setSelectedProductId}
                                disabled={areProductsLoading || isSaving}
                            >
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder={areProductsLoading ? "Ürünler yükleniyor..." : "Ürün Seçiniz veya Arayın..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.brand})</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Input 
                                type="number" 
                                value={quantityToAdd}
                                onChange={(e) => setQuantityToAdd(Number(e.target.value))}
                                className="w-24" 
                                min="1"
                                disabled={isSaving}
                            />
                            <Button onClick={handleAddProduct} disabled={!selectedProductId || areProductsLoading || isSaving || isSuggesting}>
                               {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Ekle
                            </Button>
                            <Button variant="outline" onClick={() => setIsQuickAddOpen(true)} disabled={isSaving}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Yeni Ürün Oluştur
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-[18%] min-w-[200px]">Açıklama</TableHead>
                                <TableHead className="w-[10%] min-w-[120px]">Marka</TableHead>
                                <TableHead className="w-[80px]">Miktar</TableHead>
                                <TableHead className="w-[70px]">Birim</TableHead>
                                <TableHead className="text-right min-w-[150px]">Liste Fiyatı</TableHead>
                                <TableHead className="text-center w-[90px]">% İsk.</TableHead>
                                <TableHead className="text-right min-w-[150px]">Maliyet</TableHead>
                                <TableHead className="text-right min-w-[150px]">Birim Satış</TableHead>
                                <TableHead className="text-center w-[90px]">% Kâr</TableHead>
                                <TableHead className="text-right min-w-[150px]">Birim Kâr</TableHead>
                                <TableHead className="text-right min-w-[150px]">Toplam Tutar</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {quoteItems.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium p-1">
                                        <Input value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} className={tableInputClass} disabled={isSaving} />
                                    </TableCell>
                                     <TableCell className="p-1">
                                        <Input value={item.brand} onChange={(e) => updateItem(item.id, { brand: e.target.value })} className={tableInputClass} disabled={isSaving} />
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} className={`${tableInputClass} w-16 text-center`} min="1" disabled={isSaving} />
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Input value={item.unit} onChange={(e) => updateItem(item.id, { unit: e.target.value })} className={tableInputClass} disabled={isSaving} />
                                    </TableCell>
                                    <TableCell className="text-right p-1">
                                         <Input type="number" value={item.listPrice} onChange={(e) => updateItem(item.id, { listPrice: Number(e.target.value) })} className={`${tableInputClass} text-right`} disabled={isSaving} />
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <div className='flex items-center justify-center'>
                                            <Input type="number" value={Math.round(item.discountRate * 100)} onChange={(e) => updateItem(item.id, { discountRate: Number(e.target.value) / 100 })} className={`${tableInputClass} w-16 text-center`} disabled={isSaving} />
                                             <span className="ml-1 text-xs text-muted-foreground">%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right p-1">{formatCurrency(item.cost, item.currency)}</TableCell>
                                    <TableCell className="text-right font-semibold p-1">{formatCurrency(item.unitPrice, item.currency)}</TableCell>
                                    <TableCell className="p-1">
                                        <div className='flex items-center justify-center'>
                                            <Input type="number" value={Math.round(item.profitMargin * 100)} onChange={(e) => updateItem(item.id, { profitMargin: Number(e.target.value) / 100 })} className={`${tableInputClass} w-16 text-center`} disabled={isSaving} />
                                            <span className="ml-1 text-xs text-muted-foreground">%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-green-600 font-medium p-1">{formatCurrency(item.unitProfit, item.currency)}</TableCell>
                                    <TableCell className="text-right font-bold p-1">{formatCurrency(item.total, item.currency)}</TableCell>
                                    <TableCell className="p-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} disabled={isSaving}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                             {quoteItems.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={12} className="text-center h-24">
                                        Sepete eklemek için yukarıdan bir ürün seçin.
                                    </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                        </div>
                    </CardContent>
                </Card>
                </div>

                <div className="lg:col-span-1 flex flex-col gap-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Teklif Özeti</CardTitle>
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="vat-switch" className="text-sm font-normal">
                                        {isVatIncluded ? "KDV Dahil Fiyat" : "KDV Hariç Fiyat"}
                                    </Label>
                                    <Switch
                                        id="vat-switch"
                                        checked={isVatIncluded}
                                        onCheckedChange={setIsVatIncluded}
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm"><span>Ara Toplam</span><span>{formatCurrency(quoteTotals.subtotal, 'TRY')}</span></div>
                            <div className="flex justify-between items-center text-sm"><span>KDV Tutarı (%{VAT_RATE * 100})</span><span>{formatCurrency(quoteTotals.vat, 'TRY')}</span></div>
                            <Separator />
                            <div className="flex justify-between items-center font-bold text-lg"><span>Genel Toplam</span><span>{formatCurrency(quoteTotals.grandTotal, 'TRY')}</span></div>

                            <Separator />
                            <div>
                                <Label className="text-xs text-muted-foreground">Döviz Kurları (Teklife Özel)</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-2.5 text-sm text-muted-foreground">$</span>
                                        <Input value={exchangeRates.USD} onChange={(e) => handleExchangeRateChange('USD', e.target.value)} className="pl-6" disabled={isSaving || isFetchingRates}/>
                                    </div>
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-2.5 text-sm text-muted-foreground">€</span>
                                        <Input value={exchangeRates.EUR} onChange={(e) => handleExchangeRateChange('EUR', e.target.value)} className="pl-6" disabled={isSaving || isFetchingRates}/>
                                    </div>
                                    <Button variant="outline" size="icon" aria-label="Güncel Kurları Çek" onClick={fetchExchangeRates} disabled={isSaving || isFetchingRates}>
                                        {isFetchingRates ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                             <Separator />
                             <div className="space-y-2">
                                <Label>Genel Kâr Marjı (%)</Label>
                                <Input type="number" value={globalProfitMargin} onChange={e => setGlobalProfitMargin(Number(e.target.value))} disabled={isSaving}/>
                                <Button className="w-full" variant="outline" onClick={applyGlobalProfitMargin} disabled={isSaving}>Tüm Ürünlere Uygula</Button>
                             </div>
                        </CardContent>
                        <CardFooter>
                            <Button size="lg" className="w-full" onClick={() => handleSaveQuote(editingProposal, selectedCustomerId, quoteItems)} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Teklifi Kaydet
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
        </>
    );
}

function QuoteArchiveTab({ refreshTrigger, onEditQuote }: { refreshTrigger: number, onEditQuote: (quote: Proposal) => void }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');


    const proposalsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'proposals'), orderBy("createdAt", "desc"));
    }, [firestore, refreshTrigger]);

    const { data: proposals, isLoading: areProposalsLoading } = useCollection<Proposal>(proposalsQuery);
    
    const proposalGroups = useMemo((): ProposalGroup[] => {
        if (!proposals) return [];
        
        const groups: { [key: string]: ProposalGroup } = {};

        // Sort to ensure the latest version is determined correctly
        const sortedProposals = [...proposals].sort((a, b) => b.version - a.version);

        for (const proposal of sortedProposals) {
            const rootId = proposal.rootProposalId;
            if (!groups[rootId]) {
                groups[rootId] = {
                    rootId: rootId,
                    latest: proposal, // The first one we encounter is the latest
                    versions: [],
                };
            }
            groups[rootId].versions.push(proposal);
        }

        // Sort versions within each group from newest to oldest
        Object.values(groups).forEach(group => {
            group.versions.sort((a, b) => b.version - a.version);
        });
        
        // Sort groups by the creation date of their latest version
        const allGroups = Object.values(groups).sort((a, b) => b.latest.createdAt.seconds - a.latest.createdAt.seconds);

        // Filter groups based on search term
        if (!searchTerm) {
            return allGroups;
        }

        const lowercasedFilter = searchTerm.toLowerCase();
        return allGroups.filter(group =>
            group.latest.quoteNumber.toLowerCase().includes(lowercasedFilter) ||
            group.latest.customerName.toLowerCase().includes(lowercasedFilter) ||
            group.latest.projectName.toLowerCase().includes(lowercased-Filter)
        );

    }, [proposals, searchTerm]);

    const handleDeleteProposal = async (proposalId: string) => {
        if (!firestore) return;

        try {
            const batch = writeBatch(firestore);
            
            const proposalDocRef = doc(firestore, 'proposals', proposalId);
            const itemsSnapshot = await getDocs(collection(proposalDocRef, 'proposal_items'));
            itemsSnapshot.forEach(itemDoc => batch.delete(itemDoc.ref));
            batch.delete(proposalDocRef);
            
            await batch.commit();

            toast({
                title: "Başarılı",
                description: "Teklif versiyonu ve ilgili tüm veriler silindi.",
            });
        } catch (error) {
             console.error("Error deleting proposal version: ", error);
             toast({
                variant: "destructive",
                title: "Hata",
                description: "Teklif silinirken bir sorun oluştu.",
            });
        }
    };
    
    const handleDeleteGroup = async (group: ProposalGroup) => {
        if (!firestore) return;
        if (!confirm(`${group.latest.quoteNumber} numaralı teklifin tüm versiyonlarını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
            return;
        }
        try {
            const batch = writeBatch(firestore);
            for (const version of group.versions) {
                const proposalDocRef = doc(firestore, 'proposals', version.id);
                const itemsSnapshot = await getDocs(collection(proposalDocRef, 'proposal_items'));
                itemsSnapshot.forEach(itemDoc => batch.delete(itemDoc.ref));
                batch.delete(proposalDocRef);
            }
            await batch.commit();
            toast({
                title: "Başarılı",
                description: `Teklif grubu (${group.latest.quoteNumber}) ve tüm versiyonları silindi.`,
            });
        } catch (error) {
             console.error("Error deleting proposal group: ", error);
             toast({
                variant: "destructive",
                title: "Hata",
                description: "Teklif grubu silinirken bir sorun oluştu.",
            });
        }
    };
    
    const handleChangeStatus = (proposalId: string, status: ProposalStatus) => {
        if (!firestore) return;
        const proposalDocRef = doc(firestore, 'proposals', proposalId);
        setDocumentNonBlocking(proposalDocRef, { status: status }, { merge: true });
        toast({
            title: 'Durum Güncellendi',
            description: `Teklif durumu "${status}" olarak değiştirildi.`,
        });
    };


    const formatDate = (timestamp: { seconds: number, nanoseconds: number }) => {
        if (!timestamp) return '-';
        return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR');
    }

    const formatCurrency = (price: number) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(price);
    }
    
    const getStatusBadgeVariant = (status: Proposal['status']) => {
        switch (status) {
            case 'Approved': return 'default';
            case 'Sent': return 'secondary';
            case 'Rejected': return 'destructive';
            case 'Draft':
            default:
                return 'outline';
        }
    }

    const statusOptions: ProposalStatus[] = ['Draft', 'Sent', 'Approved', 'Rejected'];
    
     if (isUserLoading || (areProposalsLoading && !proposals)) {
        return (
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Teklif Arşivi</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mt-4">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Teklif Arşivi</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">Geçmişte oluşturduğunuz tüm teklifleri burada bulabilirsiniz.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Teklif, müşteri veya projede ara..." 
                                className="pl-8 w-64" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Teklif No</TableHead>
                            <TableHead className="w-[100px]">Son Tarih</TableHead>
                            <TableHead>Müşteri</TableHead>
                            <TableHead>Proje</TableHead>
                            <TableHead className="w-[130px]">Durum</TableHead>
                            <TableHead className="w-[180px]">Versiyonlar</TableHead>
                            <TableHead className="text-right w-[150px]">Son Tutar</TableHead>
                            <TableHead className="text-center w-[120px]">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {areProposalsLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : proposalGroups && proposalGroups.length > 0 ? (
                            proposalGroups.map((group, index) => (
                                <TableRow key={group.rootId || index}>
                                    <TableCell className="font-medium">{group.latest.quoteNumber}</TableCell>
                                    <TableCell>{formatDate(group.latest.createdAt)}</TableCell>
                                    <TableCell>{group.latest.customerName}</TableCell>
                                    <TableCell>{group.latest.projectName}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant={getStatusBadgeVariant(group.latest.status)} className="w-full justify-start text-left font-normal">
                                                     <Badge variant={getStatusBadgeVariant(group.latest.status)}>{group.latest.status}</Badge>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuLabel>Durumu Değiştir</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {statusOptions.map(status => (
                                                    <DropdownMenuItem key={status} onSelect={() => handleChangeStatus(group.latest.id, status)}>
                                                        {status}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="flex gap-2">
                                                    <History className="h-4 w-4" />
                                                    <span>Görüntüle</span>
                                                    <Badge variant="secondary" className="rounded-full">{group.versions.length}</Badge>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuLabel>Versiyon Geçmişi</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {group.versions.map(version => (
                                                    <DropdownMenuItem key={version.id} className="flex justify-between items-center">
                                                        <div>
                                                            <span className="font-semibold">V{version.version}</span>
                                                            <span className="text-xs text-muted-foreground ml-2">({formatDate(version.createdAt)})</span>
                                                             <p className="text-xs text-muted-foreground">{version.versionNote}</p>
                                                        </div>
                                                        <div className='flex items-center'>
                                                            <span className='mr-4 font-mono'>{formatCurrency(version.totalAmount)}</span>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditQuote(version)}><Edit className="h-4 w-4" /></Button>
                                                             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteProposal(version.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                        </div>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(group.latest.totalAmount)}</TableCell>
                                    <TableCell className="text-center flex justify-center gap-1">
                                        <Button variant="ghost" size="icon" aria-label="Son Versiyonu İndir"><Download className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" aria-label="Son Versiyonu Düzenle" onClick={() => onEditQuote(group.latest)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" aria-label="Tüm Teklifi Sil" onClick={() => handleDeleteGroup(group)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24">
                                    {searchTerm ? 'Arama kriterlerinize uygun teklif bulunamadı.' : 'Henüz arşivlenmiş bir teklif bulunmuyor.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="flex justify-end">
                {/* Pagination will go here */}
            </CardFooter>
        </Card>
    );
}


export default function QuotesPage() {
  const [activeTab, setActiveTab] = useState("archive");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [quoteToEdit, setQuoteToEdit] = useState<Proposal | null>(null);

  const handleQuoteSaved = () => {
    setQuoteToEdit(null);
    setRefreshTrigger(prev => prev + 1);
  };
  
  const handleEditQuote = (quote: Proposal) => {
    setQuoteToEdit(quote);
    setActiveTab("new");
  };

  useEffect(() => {
    // If we switch to 'new' tab without a quote to edit, clear the form.
    if (activeTab === 'new' && !quoteToEdit) {
      // Logic to clear the form needs to be handled within CreateQuoteTab
    }
    // If we switch away from 'new' tab, clear the quote to edit
    if (activeTab !== 'new' && quoteToEdit) {
        setQuoteToEdit(null);
    }
  }, [activeTab, quoteToEdit]);


  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
            <TabsTrigger value="archive">Teklif Arşivi</TabsTrigger>
            <TabsTrigger value="new">Yeni Teklif Oluştur</TabsTrigger>
        </TabsList>
        <TabsContent value="archive">
            <QuoteArchiveTab refreshTrigger={refreshTrigger} onEditQuote={handleEditQuote} />
        </TabsContent>
        <TabsContent value="new">
            <CreateQuoteTab onQuoteSaved={handleQuoteSaved} onSetActiveTab={setActiveTab} quoteToEdit={quoteToEdit} />
        </TabsContent>
    </Tabs>
  );
}


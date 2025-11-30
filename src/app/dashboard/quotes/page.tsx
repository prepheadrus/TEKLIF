'use client';

import { useState, useMemo, useEffect }from 'react';
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
import { useCollection, useFirestore, useUser, useMemoFirebase, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, writeBatch, doc, getDocs, orderBy, limit } from 'firebase/firestore';
import { calculatePrice } from '@/lib/pricing';
import { useToast } from "@/hooks/use-toast";
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { suggestMissingParts } from '@/ai/flows/suggest-missing-parts';
import { QuickAddProduct } from '@/components/app/quick-add-product';


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

type Proposal = {
    id: string;
    quoteNumber: string;
    createdAt: { seconds: number, nanoseconds: number };
    customerName: string;
    projectName: string;
    totalAmount: number;
    versionNote: string;
    status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
};


function CreateQuoteTab({ onQuoteSaved }: { onQuoteSaved: () => void }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

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
    const [productsTrigger, setProductsTrigger] = useState(0);
    const VAT_RATE = 0.20;


    // Data fetching
    const customersQuery = useMemoFirebase(() => 
        user && firestore ? query(collection(firestore, 'customers'), where("ownerId", "==", user.uid)) : null,
        [user, firestore]
    );
    const { data: customers, isLoading: areCustomersLoading } = useCollection<Customer>(customersQuery);

    const productsQuery = useMemoFirebase(() =>
        user && firestore ? query(collection(firestore, 'products'), where("ownerId", "==", user.uid)) : null,
        [user, firestore, productsTrigger]
    );
    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    const updateItem = (itemId: string, newValues: Partial<Omit<QuoteItem, 'id'>>) => {
        setQuoteItems(prevItems =>
            prevItems.map(item => {
                if (item.id === itemId) {
                    const updatedItem = { ...item, ...newValues };
                    
                    const priceResult = calculatePrice({
                        listPrice: updatedItem.listPrice,
                        discountRate: updatedItem.discountRate,
                        profitMargin: updatedItem.profitMargin,
                        exchangeRate: 1, // Recalculate TL values at summary level
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
            // If item exists, update its quantity
            updateItem(existingItem.id, { quantity: existingItem.quantity + quantityToAdd });
            toast({
                title: "Miktar Güncellendi",
                description: `${productToAdd.name} ürününün miktarı ${quantityToAdd} adet artırıldı.`,
            });
        } else {
            // If item does not exist, add it as a new item
            const priceResult = calculatePrice({
                listPrice: productToAdd.listPrice,
                discountRate: productToAdd.discountRate,
                profitMargin: globalProfitMargin / 100,
                exchangeRate: 1, // Will be applied in the summary
            });

            const newItem: QuoteItem = {
                id: productToAdd.id, // Use product id for client-side key
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
             // AI Suggestions
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
        toast({
            title: "Form Temizlendi",
            description: "Yeni bir teklif oluşturmaya hazırsınız.",
        });
    };
    
    async function getNextQuoteNumber(firestore: any, ownerId: string): Promise<string> {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `${month}${year}`;

        const proposalsRef = collection(firestore, 'proposals');
        const q = query(
            proposalsRef, 
            where("ownerId", "==", ownerId),
            where("quoteNumber", ">=", prefix),
            where("quoteNumber", "<", prefix + 'z'), // lexicographical search
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

    const handleSaveQuote = async () => {
        if (!firestore || !user) {
            toast({ variant: "destructive", title: "Hata", description: "Veritabanı bağlantısı yok veya kullanıcı girişi yapılmamış." });
            return;
        }
        if (!selectedCustomerId) {
            toast({ variant: "destructive", title: "Eksik Bilgi", description: "Lütfen bir müşteri seçin." });
            return;
        }
        if (quoteItems.length === 0) {
            toast({ variant: "destructive", title: "Eksik Bilgi", description: "Lütfen sepete en az bir ürün ekleyin." });
            return;
        }
    
        setIsSaving(true);
        const proposalRef = doc(collection(firestore, 'proposals'));
        const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
        const newQuoteNumber = await getNextQuoteNumber(firestore, user.uid);


        const proposalData = {
            customerId: selectedCustomerId,
            customerName: selectedCustomer?.name || 'Bilinmeyen Müşteri',
            projectName: projectName || 'Genel Teklif',
            quoteNumber: newQuoteNumber,
            status: 'Draft' as const,
            totalAmount: quoteTotals.grandTotal,
            exchangeRates,
            versionNote,
            createdAt: new Date(),
            ownerId: user.uid,
        };
        
        try {
            const batch = writeBatch(firestore);
            
            batch.set(proposalRef, proposalData);
    
            for (const item of quoteItems) {
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
                description: `Teklifiniz (${newQuoteNumber}) başarıyla kaydedildi.`,
            });
            clearForm();
            onQuoteSaved();
    
        } catch (error: any) {
            console.error("Teklif kaydedilirken hata oluştu:", error);

            const permissionError = new FirestorePermissionError({
              path: `proposals/${proposalRef.id} or subcollections`,
              operation: 'write',
              requestResourceData: {
                  proposal: proposalData,
                  items: quoteItems.map(({id, ...rest}) => rest),
              }
            });
            errorEmitter.emit('permission-error', permissionError);

            toast({
                variant: "destructive",
                title: "Teklif kaydedilirken bir sorun oluştu",
                description: "Gerekli izinlere sahip olmayabilirsiniz. Lütfen konsolu kontrol edin.",
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const tableInputClass = "h-8 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0";


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
                    <h1 className="text-2xl font-bold tracking-tight">Teklif Oluştur / Düzenle</h1>
                    <p className="text-muted-foreground">Teklif No: (Yeni)</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={clearForm} disabled={isSaving}><Eraser className="mr-2 h-4 w-4" /> Temizle</Button>
                    <Input placeholder="Versiyon Notu Girin (Örn: Müşteri isteği üzerine pompa değişti)" className="w-96" value={versionNote} onChange={e => setVersionNote(e.target.value)} />
                    <Button onClick={handleSaveQuote} disabled={isSaving}>
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
                                <TableHead className="text-right w-[140px]">Liste Fiyatı</TableHead>
                                <TableHead className="text-center w-[90px]">% İsk.</TableHead>
                                <TableHead className="text-right w-[140px]">Maliyet</TableHead>
                                <TableHead className="text-right w-[140px]">Birim Satış</TableHead>
                                <TableHead className="text-center w-[90px]">% Kâr</TableHead>
                                <TableHead className="text-right w-[120px]">Birim Kâr</TableHead>
                                <TableHead className="text-right w-[140px]">Toplam Tutar</TableHead>
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
                                        <Input defaultValue={exchangeRates.USD} onChange={(e) => handleExchangeRateChange('USD', e.target.value)} className="pl-6" disabled={isSaving}/>
                                    </div>
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-2.5 text-sm text-muted-foreground">€</span>
                                        <Input defaultValue={exchangeRates.EUR} onChange={(e) => handleExchangeRateChange('EUR', e.target.value)} className="pl-6" disabled={isSaving}/>
                                    </div>
                                    <Button variant="outline" size="icon" aria-label="Güncel Kurları Çek" disabled={isSaving}>
                                        <RefreshCw className="h-4 w-4" />
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
                            <Button size="lg" className="w-full" onClick={handleSaveQuote} disabled={isSaving}>
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

function QuoteArchiveTab({ refreshTrigger }: { refreshTrigger: number }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const proposalsQuery = useMemoFirebase(() => 
        !isUserLoading && user && firestore 
            ? query(
                collection(firestore, 'proposals'), 
                where("ownerId", "==", user.uid), 
                orderBy("createdAt", "desc")
              ) 
            : null,
        [user, isUserLoading, firestore, refreshTrigger]
    );

    const { data: proposals, isLoading: areProposalsLoading } = useCollection<Proposal>(proposalsQuery);

    const handleDeleteProposal = (id: string) => {
        if (!firestore) return;
        
        // TODO: Also delete sub-collection items in a batch or cloud function
        const proposalDocRef = doc(firestore, 'proposals', id);
        deleteDocumentNonBlocking(proposalDocRef);
        toast({
          title: "Başarılı",
          description: "Teklif silindi. Arşivin güncellenmesi biraz zaman alabilir.",
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
            case 'Approved': return 'default'; // primary color
            case 'Sent': return 'secondary';
            case 'Rejected': return 'destructive';
            case 'Draft':
            default:
                return 'outline';
        }
    }

    const isLoading = isUserLoading || areProposalsLoading;

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
                            <Input placeholder="Teklif, müşteri veya projede ara..." className="pl-8 w-64" />
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Teklif No</TableHead>
                            <TableHead className="w-[100px]">Tarih</TableHead>
                            <TableHead>Müşteri</TableHead>
                            <TableHead>Proje</TableHead>
                            <TableHead className="w-[100px]">Durum</TableHead>
                            <TableHead className="w-[180px]">Versiyon</TableHead>
                            <TableHead className="text-right w-[150px]">Son Tutar</TableHead>
                            <TableHead className="text-center w-[120px]">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : proposals && proposals.length > 0 ? (
                            proposals.map((proposal) => (
                                <TableRow key={proposal.id}>
                                    <TableCell className="font-medium">{proposal.quoteNumber}</TableCell>
                                    <TableCell>{formatDate(proposal.createdAt)}</TableCell>
                                    <TableCell>{proposal.customerName}</TableCell>
                                    <TableCell>{proposal.projectName}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusBadgeVariant(proposal.status)}>{proposal.status}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
                                            <History className="h-3 w-3" />
                                            {proposal.versionNote || 'İlk Versiyon'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(proposal.totalAmount)}</TableCell>
                                    <TableCell className="text-center flex justify-center gap-1">
                                        <Button variant="ghost" size="icon" aria-label="Teklifi İndir"><Download className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" aria-label="Teklifi Düzenle"><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" aria-label="Teklifi Sil" onClick={() => handleDeleteProposal(proposal.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24">
                                    Henüz arşivlenmiş bir teklif bulunmuyor.
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
  const [activeTab, setActiveTab] = useState("new");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleQuoteSaved = () => {
    // Switch to archive tab
    setActiveTab("archive");
    // Trigger a refresh of the archive list
    setRefreshTrigger(prev => prev + 1);
  };
  
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
            <TabsTrigger value="archive">Teklif Arşivi</TabsTrigger>
            <TabsTrigger value="new">Yeni Teklif Oluştur</TabsTrigger>
        </TabsList>
        <TabsContent value="archive">
            <QuoteArchiveTab refreshTrigger={refreshTrigger} />
        </TabsContent>
        <TabsContent value="new">
            <CreateQuoteTab onQuoteSaved={handleQuoteSaved} />
        </TabsContent>
    </Tabs>
  );
}

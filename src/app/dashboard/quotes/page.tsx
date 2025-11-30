
'use client';

import { useState, useMemo, useEffect }from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, RefreshCw, Save, Eraser, Download, Edit, History, Search, Loader2 } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore, useUser, useMemoFirebase, deleteDocumentNonBlocking, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, writeBatch, doc } from 'firebase/firestore';
import { calculatePrice } from '@/lib/pricing';
import { useToast } from "@/hooks/use-toast";


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
    discountRate: number;
    profitMargin: number; // 0.25 for 25%
    // Calculated fields
    cost: number;
    unitPrice: number; // sell price in original currency
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
    // Assuming exchangeRates are stored but not shown in this specific table
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


    // Data fetching
    const customersQuery = useMemoFirebase(() => 
        user && firestore ? query(collection(firestore, 'customers'), where("ownerId", "==", user.uid)) : null,
        [user, firestore]
    );
    const { data: customers, isLoading: areCustomersLoading } = useCollection<Customer>(customersQuery);

    const productsQuery = useMemoFirebase(() =>
        user && firestore ? query(collection(firestore, 'products'), where("ownerId", "==", user.uid)) : null,
        [user, firestore]
    );
    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    const handleAddProduct = () => {
        if (!selectedProductId || !products) return;
        const productToAdd = products.find(p => p.id === selectedProductId);
        if (!productToAdd) return;

         // Prevent adding the same product twice
        if (quoteItems.some(item => item.productId === productToAdd.id)) {
            toast({
                variant: "destructive",
                title: "Uyarı",
                description: "Bu ürün zaten sepete eklenmiş.",
            });
            return;
        }

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
            total: priceResult.originalSellPrice * quantityToAdd,
        };

        setQuoteItems(prevItems => [...prevItems, newItem]);
        setSelectedProductId(null);
        setQuantityToAdd(1);
    };
    
    const handleRemoveItem = (itemId: string) => {
        setQuoteItems(prevItems => prevItems.filter(item => item.id !== itemId));
    };

    const updateItem = (itemId: string, newValues: Partial<QuoteItem>) => {
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
                        unitPrice: priceResult.originalSellPrice,
                        total: priceResult.originalSellPrice * updatedItem.quantity,
                    };
                }
                return item;
            })
        );
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
                    total: priceResult.originalSellPrice * item.quantity,
                };
            })
        );
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
        const totals = {
            TRY: 0,
            USD: 0,
            EUR: 0,
            grandTotalTRY: 0,
        };
        quoteItems.forEach(item => {
            const currency = item.currency === 'TL' ? 'TRY' : item.currency;
            totals[currency] += item.total;
        });

        totals.grandTotalTRY = totals.TRY + (totals.USD * exchangeRates.USD) + (totals.EUR * exchangeRates.EUR);
        return totals;

    }, [quoteItems, exchangeRates]);

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

        const proposalData = {
            customerId: selectedCustomerId,
            customerName: selectedCustomer?.name || 'Bilinmeyen Müşteri',
            projectName: projectName || 'Genel Teklif',
            quoteNumber: '', // Will be generated server-side or in a later step
            status: 'Draft',
            totalAmount: quoteTotals.grandTotalTRY,
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
                description: "Teklifiniz başarıyla kaydedildi.",
            });
            clearForm();
            onQuoteSaved();
    
        } catch (error: any) {
            console.error("Teklif kaydedilirken hata oluştu:", error);

            // Create and emit a contextual error for debugging security rules
            const permissionError = new FirestorePermissionError({
                // We guess the first operation in the batch is the most likely culprit
                path: proposalRef.path,
                operation: 'create',
                requestResourceData: proposalData,
            });
            errorEmitter.emit('permission-error', permissionError);

            toast({
                variant: "destructive",
                title: "Hata",
                description: "Teklif kaydedilemedi. İzinleriniz yetersiz olabilir.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
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
                            <Button onClick={handleAddProduct} disabled={!selectedProductId || areProductsLoading || isSaving}>
                               {areProductsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Ekle
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Açıklama</TableHead>
                                <TableHead>Marka</TableHead>
                                <TableHead className="w-[100px]">Miktar</TableHead>
                                <TableHead>Birim</TableHead>
                                <TableHead className="text-right">Birim Satış F.</TableHead>
                                <TableHead className="text-right">Toplam Tutar</TableHead>
                                <TableHead className="text-center">% Kâr</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {quoteItems.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.brand}</TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                                            className="h-8 w-20 text-center" 
                                            min="1"
                                            disabled={isSaving}
                                        />
                                    </TableCell>
                                    <TableCell>{item.unit}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.unitPrice, item.currency)}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(item.total, item.currency)}</TableCell>
                                    <TableCell>
                                        <div className='flex items-center justify-center'>
                                            <Input
                                                type="number"
                                                value={Math.round(item.profitMargin * 100)}
                                                onChange={(e) => updateItem(item.id, { profitMargin: Number(e.target.value) / 100 })}
                                                className="h-8 w-16 text-center"
                                                disabled={isSaving}
                                            />
                                            <span className="ml-1">%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} disabled={isSaving}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                             {quoteItems.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center h-24">
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
                        <CardHeader><CardTitle>Fatura Özeti ve Kurlar</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm"><span>Ara Toplam (TRY)</span><span>{formatCurrency(quoteTotals.TRY, 'TRY')}</span></div>
                            <div className="flex justify-between items-center text-sm"><span>Ara Toplam (USD)</span><span>{formatCurrency(quoteTotals.USD, 'USD')}</span></div>
                            <div className="flex justify-between items-center text-sm"><span>Ara Toplam (EUR)</span><span>{formatCurrency(quoteTotals.EUR, 'EUR')}</span></div>
                            <Separator />
                            <div className="flex justify-between items-center font-bold text-lg"><span>Genel Toplam (TL)</span><span>{formatCurrency(quoteTotals.grandTotalTRY, 'TRY')}</span></div>

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
    );
}

function QuoteArchiveTab({ refreshTrigger }: { refreshTrigger: number }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const proposalsQuery = useMemoFirebase(() => 
        user && firestore ? query(collection(firestore, 'proposals'), where("ownerId", "==", user.uid)) : null,
        [user, firestore, refreshTrigger]
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
                            <TableHead>Teklif No</TableHead>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Müşteri</TableHead>
                            <TableHead>Proje</TableHead>
                            <TableHead>Versiyon</TableHead>
                            <TableHead className="text-right">Son Tutar</TableHead>
                            <TableHead className="text-center">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {areProposalsLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : proposals && proposals.length > 0 ? (
                            proposals.map((proposal) => (
                                <TableRow key={proposal.id}>
                                    <TableCell className="font-medium">{proposal.quoteNumber || proposal.id.slice(0,6)}</TableCell>
                                    <TableCell>{formatDate(proposal.createdAt)}</TableCell>
                                    <TableCell>{proposal.customerName}</TableCell>
                                    <TableCell>{proposal.projectName}</TableCell>
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
                                <TableCell colSpan={7} className="text-center h-24">
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
  const [activeTab, setActiveTab] = useState("archive");
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

    
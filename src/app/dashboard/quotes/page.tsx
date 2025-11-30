
'use client';

import { useState } from 'react';
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
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

// Zod'dan gelen tipleri burada da kullanabiliriz. Şimdilik manuel tanımlayalım.
type Customer = { id: string; name: string; [key: string]: any };
type Product = { id: string; name: string; brand: string; unit: string; listPrice: number; currency: string; [key: string]: any };
type QuoteItem = {
    productId: string;
    name: string;
    brand: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
    profit: number;
    currency: string;
};


// Mock data - will be replaced with Firestore data
const mockQuotes = [
    { id: '1', quoteNo: '2025/002', date: '30.11.2025', customer: 'Ersen Kazar', project: 'Mekanik Tesisat İşleri', total: 5720614.80, currency: 'TRY', versions: 8 },
    { id: '2', quoteNo: '2025/001', date: '30.11.2025', customer: 'Ersen Kazar', project: 'deneme', total: 127107.94, currency: 'TRY', versions: 3 },
];

function CreateQuoteTab() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    // State definitions
    const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [quantityToAdd, setQuantityToAdd] = useState<number>(1);

    // Data fetching from Firestore
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

        const newItem: QuoteItem = {
            productId: productToAdd.id,
            name: productToAdd.name,
            brand: productToAdd.brand,
            quantity: quantityToAdd,
            unit: productToAdd.unit,
            unitPrice: productToAdd.listPrice,
            total: productToAdd.listPrice * quantityToAdd,
            profit: 25, // Varsayılan kar marjı
            currency: productToAdd.currency,
        };

        setQuoteItems(prevItems => [...prevItems, newItem]);
        setSelectedProductId(null);
        setQuantityToAdd(1);
    };
    
    const handleRemoveItem = (productId: string) => {
        setQuoteItems(prevItems => prevItems.filter(item => item.productId !== productId));
    };
    
    const handleQuantityChange = (productId: string, newQuantity: number) => {
        setQuoteItems(prevItems =>
            prevItems.map(item =>
                item.productId === productId
                    ? {
                        ...item,
                        quantity: newQuantity,
                        total: item.unitPrice * newQuantity,
                      }
                    : item
            )
        );
    };

    const formatCurrency = (price: number, currency: string) => {
        const displayCurrency = currency === 'TL' ? 'TRY' : currency;
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: displayCurrency }).format(price);
    }
    
    return (
        <div className="flex flex-col gap-4 mt-4">
            {/* A. Üst Kontrol Paneli */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Teklif Oluştur / Düzenle</h1>
                    <p className="text-muted-foreground">Teklif No: (Yeni)</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline"><Eraser className="mr-2 h-4 w-4" /> Temizle</Button>
                    <Input placeholder="Versiyon Notu Girin (Örn: Müşteri isteği üzerine pompa değişti)" className="w-96" />
                    <Button><Save className="mr-2 h-4 w-4" /> Kaydet</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 flex flex-col gap-4">
                <Card>
                    <CardHeader><CardTitle>Cari & Proje Bilgileri</CardTitle></CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <Select disabled={areCustomersLoading}>
                            <SelectTrigger>
                               <SelectValue placeholder={areCustomersLoading ? "Müşteriler yükleniyor..." : "Müşteri Seçiniz..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Input placeholder="Proje Adı (Örn: Villa Mekanik Tesisat İşleri)" />
                    </CardContent>
                </Card>

                {/* C. Orta Alan: Metraj Izgarası */}
                <Card>
                    <CardHeader><CardTitle>Ürün Sepeti (Metraj Cetveli)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex gap-2 mb-4">
                            <Select 
                                value={selectedProductId || ""}
                                onValueChange={setSelectedProductId}
                                disabled={areProductsLoading}
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
                            />
                            <Button onClick={handleAddProduct} disabled={!selectedProductId}>
                               {areProductsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Ekle
                            </Button>
                        </div>
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Açıklama</TableHead>
                                <TableHead>Marka</TableHead>
                                <TableHead className="w-[100px]">Miktar</TableHead>
                                <TableHead>Birim</TableHead>
                                <TableHead className="text-right">Birim Satış Fiyatı</TableHead>
                                <TableHead className="text-right">Toplam Tutar</TableHead>
                                <TableHead className="text-center">% Kâr</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {quoteItems.map((item) => (
                                <TableRow key={item.productId}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.brand}</TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={(e) => handleQuantityChange(item.productId, Number(e.target.value))}
                                            className="h-8 w-20 text-center" 
                                        />
                                    </TableCell>
                                    <TableCell>{item.unit}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.unitPrice, item.currency)}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(item.total, item.currency)}</TableCell>
                                    <TableCell className="text-center"><Badge variant={item.profit > 30 ? 'default' : 'secondary'} className="bg-green-100 text-green-800">%{item.profit.toFixed(1)}</Badge></TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.productId)}>
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
                    </CardContent>
                </Card>
                </div>

                {/* D. Alt Panel'in bir kısmı gibi düşünülebilir (Sağda) */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <Card>
                        <CardHeader><CardTitle>Fatura Özeti ve Kurlar</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center font-semibold text-lg"><span>Toplam TRY</span><span>... TL</span></div>
                            <div className="flex justify-between items-center font-semibold text-lg"><span>Toplam USD</span><span>... USD</span></div>
                            <Separator />
                            <div>
                                <Label className="text-xs text-muted-foreground">Döviz Kurları (Teklife Özel)</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-2.5 text-sm text-muted-foreground">$</span>
                                        <Input defaultValue="34.50" className="pl-6"/>
                                    </div>
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-2.5 text-sm text-muted-foreground">€</span>
                                        <Input defaultValue="36.20" className="pl-6"/>
                                    </div>
                                    <Button variant="outline" size="icon" aria-label="Güncel Kurları Çek">
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                             <Separator />
                             <div className="space-y-2">
                                <Label>Genel Kâr Marjı (%)</Label>
                                <Input type="number" defaultValue="25" />
                                <Button className="w-full" variant="outline">Tüm Ürünlere Uygula</Button>
                             </div>
                        </CardContent>
                        <CardFooter>
                            <Button size="lg" className="w-full">
                                <Save className="mr-2 h-4 w-4" />
                                Teklifi Kaydet
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function QuoteArchiveTab() {
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
                        <Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" /> Yenile</Button>
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
                            <TableHead>Geçmiş</TableHead>
                            <TableHead className="text-right">Son Tutar</TableHead>
                            <TableHead className="text-center">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockQuotes.map((quote) => (
                            <TableRow key={quote.id}>
                                <TableCell className="font-medium">{quote.quoteNo}</TableCell>
                                <TableCell>{quote.date}</TableCell>
                                <TableCell>{quote.customer}</TableCell>
                                <TableCell>{quote.project}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
                                        <History className="h-3 w-3" />
                                        {quote.versions} versiyon
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold">{quote.total.toLocaleString('tr-TR', { style: 'currency', currency: quote.currency })}</TableCell>
                                <TableCell className="text-center flex justify-center gap-1">
                                    <Button variant="ghost" size="icon" aria-label="Teklifi İndir"><Download className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" aria-label="Teklifi Düzenle"><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" aria-label="Teklifi Sil"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                         {mockQuotes.length === 0 && (
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
  return (
    <Tabs defaultValue="new">
        <TabsList>
            <TabsTrigger value="archive">Teklif Arşivi</TabsTrigger>
            <TabsTrigger value="new">Yeni Teklif Oluştur</TabsTrigger>
        </TabsList>
        <TabsContent value="archive">
            <QuoteArchiveTab />
        </TabsContent>
        <TabsContent value="new">
            <CreateQuoteTab />
        </TabsContent>
    </Tabs>
  );
}

    
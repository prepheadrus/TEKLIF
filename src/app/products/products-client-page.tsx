

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    PlusCircle,
    MoreHorizontal,
    Edit,
    Trash2,
    Loader2,
    Search,
    UploadCloud,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Eye,
    ShoppingCart,
    BarChart,
    TrendingUp,
    Tags,
    DollarSign,
    Copy,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, getDocs, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { QuickAddProduct } from '@/components/app/quick-add-product';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkProductImporter } from '@/components/app/bulk-product-importer';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateItemTotals } from '@/lib/pricing';

// Combined type for a product/material
export type Product = {
  id: string;
  // Core Info
  code: string;
  name: string;
  brand: string;
  model?: string;
  unit: string;
  description?: string;
  technicalSpecifications?: string;
  brochureUrl?: string;
  // Sales Info
  listPrice: number;
  currency: 'TRY' | 'USD' | 'EUR';
  discountRate: number; // For sales
  // Cost Info
  basePrice: number;
  supplierId?: string;
  // Categorization
  category: string; // General category
  installationTypeId?: string;
  // VAT Info
  vatRate: number;
  priceIncludesVat: boolean;
};

export type Supplier = {
  id: string;
  name: string;
};

type Proposal = {
  id: string;
  status: 'Approved';
  exchangeRates: { USD: number, EUR: number };
}

type ProposalItem = {
    productId: string;
    quantity: number;
    listPrice: number;
    currency: 'TRY' | 'USD' | 'EUR';
    discountRate: number;
    profitMargin: number;
    priceIncludesVat: boolean;
    vatRate: number;
}

type ProductAnalytics = {
    totalProducts: number;
    topSelling: { id: string, name: string, brand: string, totalQuantity: number }[];
    mostProfitable: { id: string, name: string, brand: string, avgProfitMargin: number }[];
    averageSellingPrice: number;
}

type InstallationType = {
    id: string;
    name: string;
    parentId?: string | null;
}

const ITEMS_PER_PAGE = 50;

const buildCategoryNameMap = (categories: InstallationType[]): Map<string, string> => {
    const categoryMap: { [id: string]: { id: string; name: string; children: any[], parentId?: string | null } } = {};
    if (categories) {
        categories.forEach(cat => {
            categoryMap[cat.id] = { ...cat, children: [] };
        });
    }

    const roots: any[] = [];
    if (categories) {
        categories.forEach(cat => {
            if (cat.parentId && categoryMap[cat.parentId]) {
                categoryMap[cat.parentId].children.push(categoryMap[cat.id]);
            } else {
                roots.push(categoryMap[cat.id]);
            }
        });
    }
    
    const nameMap = new Map<string, string>();
    const traverse = (node: { id: string; name: string; children: any[] }, prefix: string) => {
        const currentName = prefix ? `${prefix} > ${node.name}` : node.name;
        nameMap.set(node.id, currentName);
        node.children.forEach(child => traverse(child, currentName));
    };

    roots.sort((a,b) => a.name.localeCompare(b.name, 'tr')).forEach(root => traverse(root, ''));
    return nameMap;
};

const buildCategoryTreeForFilter = (categories: InstallationType[]): { id: string; name: string }[] => {
    if (!categories) return [];

    const categoryMap: { [id: string]: { id: string; name: string; children: any[] } } = {};
    categories.forEach(cat => {
        categoryMap[cat.id] = { ...cat, children: [] };
    });

    const roots: { id: string; name: string; children: any[] }[] = [];
    categories.forEach(cat => {
        if (cat.parentId && categoryMap[cat.parentId]) {
            categoryMap[cat.parentId].children.push(categoryMap[cat.id]);
        } else {
            roots.push(categoryMap[cat.id]);
        }
    });

    const flattenedList: { id: string; name: string }[] = [];
    const traverse = (node: { id: string; name: string; children: any[] }, prefix: string) => {
        const currentName = prefix ? `${prefix} > ${node.name}` : node.name;
        flattenedList.push({ id: node.id, name: currentName });
        node.children.sort((a,b) => a.name.localeCompare(b.name, 'tr')).forEach(child => traverse(child, currentName));
    };

    roots.sort((a, b) => a.name.localeCompare(b.name, 'tr')).forEach(root => traverse(root, ''));
    return flattenedList;
};

const StatCard = ({ title, value, icon, isLoading }: { title: string, value: string | number, icon: React.ReactNode, isLoading: boolean }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{value}</div>}
      </CardContent>
    </Card>
);

const formatCurrency = (amount: number, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);
};


export function ProductsPageContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [isCopyMode, setIsCopyMode] = useState(false);

  // --- Data Fetching ---
  const productsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'products'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts, error, refetch: refetchProducts } = useCollection<Product>(productsQuery);
  
  const installationTypesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'installation_types') : null),
    [firestore]
  );
  const { data: installationTypes, isLoading: isLoadingInstallationTypes } = useCollection<InstallationType>(installationTypesRef);
  
  const suppliersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'suppliers')) : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);
  
  // --- Effects ---
   useEffect(() => {
    setCurrentPage(1); // Reset page on filter change
  }, [searchTerm, supplierFilter, brandFilter, categoryFilter]);

  useEffect(() => {
    if (!firestore || !products) return;

    const calculateAnalytics = async () => {
        setIsAnalyticsLoading(true);
        try {
            const proposalsRef = collection(firestore, 'proposals');
            const approvedProposalsQuery = query(proposalsRef, where('status', '==', 'Approved'));
            const approvedProposalsSnap = await getDocs(approvedProposalsQuery);

            const productSales: Record<string, { totalQuantity: number, profitMargins: number[], count: number, totalRevenue: number }> = {};

            for (const proposalDoc of approvedProposalsSnap.docs) {
                const proposal = proposalDoc.data() as Proposal;
                const itemsRef = collection(firestore, 'proposals', proposalDoc.id, 'proposal_items');
                const itemsSnap = await getDocs(itemsRef);

                itemsSnap.forEach(itemDoc => {
                    const item = itemDoc.data() as ProposalItem;
                    if (!productSales[item.productId]) {
                        productSales[item.productId] = { totalQuantity: 0, profitMargins: [], count: 0, totalRevenue: 0 };
                    }
                    productSales[item.productId].totalQuantity += item.quantity;
                    productSales[item.productId].profitMargins.push(item.profitMargin);
                    
                    const itemTotals = calculateItemTotals({
                        ...item,
                        exchangeRate: item.currency === 'USD' ? (proposal.exchangeRates?.USD || 1) : item.currency === 'EUR' ? (proposal.exchangeRates?.EUR || 1) : 1
                    });
                    productSales[item.productId].totalRevenue += itemTotals.totalTlSell;
                    productSales[item.productId].count++;
                });
            }

            const sortedByQuantity = Object.entries(productSales).sort(([, a], [, b]) => b.totalQuantity - a.totalQuantity);
            const topSelling = sortedByQuantity.slice(0, 5).map(([id, data]) => {
                const product = products.find(p => p.id === id);
                return { id, name: product?.name || 'Bilinmiyor', brand: product?.brand || '', totalQuantity: data.totalQuantity };
            });

            const sortedByProfit = Object.entries(productSales).map(([id, data]) => {
                const avgProfitMargin = data.profitMargins.reduce((a, b) => a + b, 0) / data.profitMargins.length;
                return { id, avgProfitMargin };
            }).sort((a, b) => b.avgProfitMargin - a.avgProfitMargin);

            const mostProfitable = sortedByProfit.slice(0, 5).map(p => {
                 const product = products.find(prod => prod.id === p.id);
                 return { id: p.id, name: product?.name || 'Bilinmiyor', brand: product?.brand || '', avgProfitMargin: p.avgProfitMargin }
            });

            const totalRevenue = Object.values(productSales).reduce((sum, p) => sum + p.totalRevenue, 0);
            const totalItemsSold = Object.values(productSales).reduce((sum, p) => sum + p.count, 0);
            const averageSellingPrice = totalItemsSold > 0 ? totalRevenue / totalItemsSold : 0;


            setAnalytics({
                totalProducts: products.length,
                topSelling,
                mostProfitable,
                averageSellingPrice
            });

        } catch (e) {
            console.error("Analytics calculation failed:", e);
            setAnalytics(null);
        } finally {
            setIsAnalyticsLoading(false);
        }
    };

    calculateAnalytics();
  }, [firestore, products]);


  // --- Memoized Maps and Lists for Display and Filtering ---
  const categoryNameMap = useMemo(() => {
    if (!installationTypes) return new Map();
    return buildCategoryNameMap(installationTypes);
  }, [installationTypes]);

  const supplierMap = useMemo(() => {
    if (!suppliers) return new Map<string, string>();
    return new Map(suppliers.map(s => [s.id, s.name]));
  }, [suppliers]);

  const uniqueBrands = useMemo(() => {
    if (!products) return [];
    const brands = products.map(p => p.brand).filter(Boolean);
    return [...new Set(brands)].sort((a,b) => a.localeCompare(b, 'tr'));
  }, [products]);

  const hierarchicalCategoriesForFilter = useMemo(() => {
    if (!installationTypes) return [];
    return buildCategoryTreeForFilter(installationTypes);
  }, [installationTypes]);
  
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        return products.filter(p => {
            const searchTerms = searchTerm.toLocaleLowerCase('tr-TR').split(' ').filter(term => term.length > 0);
            if (searchTerms.length > 0) {
                const productText = `${p.name} ${p.code} ${p.brand} ${p.model || ''}`.toLocaleLowerCase('tr-TR');
                const isMatch = searchTerms.every(term => productText.includes(term));
                if (!isMatch) return false;
            }

            const supplierMatch = supplierFilter.length === 0 || (p.supplierId && supplierFilter.includes(p.supplierId));
            const brandMatch = brandFilter.length === 0 || brandFilter.includes(p.brand);
            const categoryMatch = categoryFilter.length === 0 || (p.installationTypeId && categoryFilter.includes(p.installationTypeId));

            return supplierMatch && brandMatch && categoryMatch;
        });
    }, [products, searchTerm, supplierFilter, brandFilter, categoryFilter]);

    // --- Pagination Logic ---
    const paginatedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredProducts.slice(startIndex, endIndex);
    }, [filteredProducts, currentPage]);

    const totalPages = useMemo(() => {
        return Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
    }, [filteredProducts]);

  
  // --- Event Handlers ---
  const handleOpenAddDialog = () => {
    setEditingProduct(null);
    setIsCopyMode(false);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsCopyMode(false);
    setIsDialogOpen(true);
  };

  const handleOpenCopyDialog = (productToCopy: Product) => {
    if (!products) return;

    // Base code is the part before a potential trailing number, e.g., "CODE-A" from "CODE-A-10"
    const baseCodeMatch = productToCopy.code.match(/^(.*?)(\d*)$/);
    let baseCode = productToCopy.code;
    if (baseCodeMatch) {
        // Check if the original code ends with a number separated by a hyphen
        const lastPart = productToCopy.code.split('-').pop();
        if (!isNaN(Number(lastPart))) {
            baseCode = productToCopy.code.substring(0, productToCopy.code.lastIndexOf('-'));
        }
    }
    
    // Find all existing codes that start with the base code + hyphen
    const regex = new RegExp(`^${baseCode}-?(\\d+)$`);
    let maxNum = 0;

    products.forEach(p => {
        const match = p.code.match(regex);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) {
                maxNum = num;
            }
        }
    });

    const newCodeNumber = maxNum + 1;
    const newCode = `${baseCode}-${newCodeNumber}`;
    const newName = `${productToCopy.name.replace(/\(Kopya \d+\)$/, '').trim()} (Kopya ${newCodeNumber})`;

    const copiedProduct = {
      ...productToCopy,
      code: newCode,
      name: newName,
    };

    setEditingProduct(copiedProduct);
    setIsCopyMode(true);
    setIsDialogOpen(true);
  }

  const handleDeleteProduct = (productId: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'products', productId));
    toast({ title: 'Başarılı', description: 'Ürün silindi.' });
    refetchProducts();
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
    });
  };
  
  const handleBulkDelete = async () => {
    if (!firestore || selectedIds.size === 0) return;

    toast({title: 'Siliniyor...', description: `${selectedIds.size} ürün siliniyor.`});

    try {
        const batch = writeBatch(firestore);
        selectedIds.forEach(id => {
            batch.delete(doc(firestore, 'products', id));
        });
        await batch.commit();

        toast({title: 'Başarılı!', description: 'Seçili ürünler silindi.'});
        setSelectedIds(new Set());
        refetchProducts();

    } catch (error: any) {
        toast({variant: 'destructive', title: 'Hata', description: `Ürünler silinemedi: ${error.message}`});
    }
  };
  
  const toggleAllSelection = (isChecked: boolean) => {
    if (!filteredProducts) return;
    const newSelectedIds = new Set<string>();
    if (isChecked) {
        filteredProducts.forEach(p => newSelectedIds.add(p.id));
    }
    setSelectedIds(newSelectedIds);
  };

  const toggleSelection = (id: string, isChecked: boolean) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (isChecked) {
            newSet.add(id);
        } else {
            newSet.delete(id);
        }
        return newSet;
    });
  };

  const allVisibleSelected = filteredProducts && filteredProducts.length > 0 && selectedIds.size >= filteredProducts.length && filteredProducts.every(p => selectedIds.has(p.id));
  const someVisibleSelected = filteredProducts && selectedIds.size > 0 && !allVisibleSelected;

  const tableIsLoading = isLoadingProducts || isLoadingInstallationTypes || isLoadingSuppliers;

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
                Sayfa {currentPage} / {totalPages} ({filteredProducts.length} sonuç)
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Önceki
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                    Sonraki <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
            </div>
        </div>
    );
  }

  const handleClearFilters = () => {
    setSearchTerm('');
    setSupplierFilter([]);
    setBrandFilter([]);
    setCategoryFilter([]);
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ürünler / Malzemeler</h2>
          <p className="text-muted-foreground">Tekliflerinizde kullandığınız tüm ürün, malzeme ve hizmetleri yönetin.</p>
        </div>
        <div className="flex items-center space-x-2">
            <Button onClick={() => setIsImporterOpen(true)} variant="outline">
              <UploadCloud className="mr-2 h-4 w-4" />
              Excel ile Ürün Yükle
            </Button>
          <Button onClick={handleOpenAddDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Yeni Ürün Ekle
          </Button>
        </div>
      </div>

       <Card>
            <CardHeader>
                <CardTitle>Ürün Analitiği</CardTitle>
                <CardDescription>Ürün performansınıza genel bakış.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Toplam Ürün Çeşidi" value={analytics?.totalProducts || 0} icon={<BarChart className="h-4 w-4 text-muted-foreground" />} isLoading={isAnalyticsLoading} />
                <StatCard title="Ort. Satış Fiyatı" value={formatCurrency(analytics?.averageSellingPrice || 0)} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} isLoading={isAnalyticsLoading} />
                
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center"><TrendingUp className="h-5 w-5 mr-2 text-blue-500"/> En Çok Teklif Edilenler</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isAnalyticsLoading ? <Skeleton className="h-24 w-full" /> : (
                            <div className="space-y-2">
                                {analytics?.topSelling.map(p => (
                                    <div key={p.id} className="flex items-center justify-between text-sm">
                                        <div>
                                            <p className="font-medium">{p.name}</p>
                                            <p className="text-xs text-muted-foreground">{p.brand}</p>
                                        </div>
                                        <Badge variant="secondary">{p.totalQuantity} adet</Badge>
                                    </div>
                                ))}
                                {analytics?.topSelling.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Henüz veri yok.</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center"><TrendingUp className="h-5 w-5 mr-2 text-green-500"/> En Kârlı Ürünler</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isAnalyticsLoading ? <Skeleton className="h-24 w-full" /> : (
                            <div className="space-y-2">
                               {analytics?.mostProfitable.map(p => (
                                    <div key={p.id} className="flex items-center justify-between text-sm">
                                        <div>
                                            <p className="font-medium">{p.name}</p>
                                            <p className="text-xs text-muted-foreground">{p.brand}</p>
                                        </div>
                                        <Badge className="bg-green-100 text-green-800">%{ (p.avgProfitMargin * 100).toFixed(1) }</Badge>
                                    </div>
                                ))}
                                {analytics?.mostProfitable.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Henüz veri yok.</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ürün Listesi</CardTitle>
          <CardDescription>
            Tüm ürün, malzeme ve hizmetleriniz. Gelişmiş filtreleri kullanarak listeyi daraltabilirsiniz.
          </CardDescription>
          <div className="pt-4 flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ürün adı, kodu, marka veya model ara..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
                {/* Supplier Filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">Tedarikçi <ChevronDown className="ml-2 h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {suppliers?.map(supplier => (
                             <DropdownMenuCheckboxItem key={supplier.id} checked={supplierFilter.includes(supplier.id)} onCheckedChange={(checked) => setSupplierFilter(prev => checked ? [...prev, supplier.id] : prev.filter(id => id !== supplier.id))}>
                                {supplier.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Brand Filter */}
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">Marka <ChevronDown className="ml-2 h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {uniqueBrands.map(brand => (
                             <DropdownMenuCheckboxItem key={brand} checked={brandFilter.includes(brand)} onCheckedChange={(checked) => setBrandFilter(prev => checked ? [...prev, brand] : prev.filter(b => b !== brand))}>
                                {brand}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                 {/* Category Filter */}
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">Kategori <ChevronDown className="ml-2 h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-96 overflow-y-auto">
                        {hierarchicalCategoriesForFilter.map(cat => (
                             <DropdownMenuCheckboxItem key={cat.id} checked={categoryFilter.includes(cat.id)} onCheckedChange={(checked) => setCategoryFilter(prev => checked ? [...prev, cat.id] : prev.filter(id => id !== cat.id))}>
                                {cat.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="ghost" onClick={handleClearFilters}>Filtreleri Temizle</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {selectedIds.size > 0 && (
            <div className="bg-primary/10 border-y border-primary/20 px-4 py-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-primary">
                    {selectedIds.size} ürün seçildi.
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled><DollarSign /> Toplu Fiyat Güncelle</Button>
                    <Button variant="outline" size="sm" disabled><Tags /> Toplu Kategori Değiştir</Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2" /> Seçilenleri Sil
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Bu işlem geri alınamaz. Seçilen {selectedIds.size} ürün kalıcı olarak silinecektir.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                                    Evet, Sil
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedIds(new Set())}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 w-12">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleAllSelection(!!checked)}
                    aria-label="Tümünü seç"
                    data-state={someVisibleSelected ? 'indeterminate' : (allVisibleSelected ? 'checked' : 'unchecked')}
                  />
                </TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Marka</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead>Tesisat Kategorisi</TableHead>
                <TableHead>Birim Alış Fiyatı</TableHead>
                <TableHead>Birim Satış Fiyatı</TableHead>
                <TableHead className="text-right w-20"><span className="sr-only">İşlemler</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableIsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : error ? (
                 <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-red-600">
                        Ürünler yüklenirken bir hata oluştu: {error.message}
                    </TableCell>
                </TableRow>
              ) : paginatedProducts && paginatedProducts.length > 0 ? (
                paginatedProducts.map((product) => (
                  <TableRow key={product.id} data-state={selectedIds.has(product.id) ? 'selected' : undefined}>
                    <TableCell className="px-4">
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={(checked) => toggleSelection(product.id, !!checked)}
                        aria-label={`${product.name} seç`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                        <div>{product.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{product.code}</div>
                    </TableCell>
                    <TableCell>{product.brand}</TableCell>
                    <TableCell>{product.model || '-'}</TableCell>
                    <TableCell>
                      {product.supplierId && (
                        <Badge variant="secondary">{supplierMap.get(product.supplierId) || 'Bilinmiyor'}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.installationTypeId && (
                        <Badge variant="outline">{categoryNameMap.get(product.installationTypeId) || 'Bilinmiyor'}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(product.basePrice || 0, product.currency)}</TableCell>
                    <TableCell>{formatCurrency(product.listPrice, product.currency)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Menüyü aç</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                           <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}>
                            <Eye />
                            Detayları Gör
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(product)}>
                            <Edit />
                            Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenCopyDialog(product)}>
                            <Copy />
                            Kopyala
                          </DropdownMenuItem>
                           <DropdownMenuItem disabled>
                            <DollarSign />
                            Fiyat Güncelle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <DropdownMenuItem disabled>
                            <ShoppingCart />
                            Teklife Ekle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:bg-red-100 focus:text-red-700">
                                <Trash2 />
                                Sil
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bu işlem geri alınamaz. Bu ürünü kalıcı olarak silecektir.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteProduct(product.id)} className="bg-destructive hover:bg-destructive/90">
                                  Evet, Sil
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    Henüz ürün bulunmuyor veya arama kriterlerinize uyan ürün yok.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
         {totalPages > 1 && (
            <CardFooter>
                <PaginationControls />
            </CardFooter>
        )}
      </Card>
      <QuickAddProduct
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={() => {
            refetchProducts();
        }}
        existingProduct={editingProduct}
        isCopyMode={isCopyMode}
      />
      <BulkProductImporter
        isOpen={isImporterOpen}
        onOpenChange={setIsImporterOpen}
        onSuccess={() => {
            refetchProducts();
        }}
      />
    </div>
  );
}

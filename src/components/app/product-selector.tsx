'use client';
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Product } from '@/app/products/page';
import type { InstallationType, TreeNode } from '@/app/installation-types/page';
import { Loader2, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


interface ProductSelectorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onProductsSelected: (products: Product[]) => void;
  targetGroupName?: string; // Add this prop
}

const buildTree = (categories: InstallationType[]): TreeNode[] => {
    const categoryMap: { [id: string]: TreeNode } = {};
    const roots: TreeNode[] = [];

    if (!categories) return roots;

    categories.forEach(category => {
        categoryMap[category.id] = { ...category, children: [] };
    });

    categories.forEach(category => {
        if (category.parentId && categoryMap[category.parentId]) {
            if (category.id !== category.parentId) { 
                categoryMap[category.parentId].children.push(categoryMap[category.id]);
            }
        } else {
            roots.push(categoryMap[category.id]);
        }
    });

    Object.values(categoryMap).forEach(node => {
        node.children.sort((a, b) => a.name.localeCompare(b.name, 'tr', { numeric: true }));
    });
    
    roots.sort((a, b) => a.name.localeCompare(b.name, 'tr', { numeric: true }));

    return roots;
};

const CategoryNode = ({ node, level, onSelect, selectedCategoryId }: { node: TreeNode; level: number; onSelect: (id: string) => void; selectedCategoryId: string | null }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.id === selectedCategoryId;

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent",
                    isSelected && "bg-accent text-accent-foreground"
                )}
                style={{ paddingLeft: `${level * 16 + 4}px` }}
                onClick={() => onSelect(node.id)}
            >
                {hasChildren ? (
                    <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="p-1 -ml-1">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                ) : <div className="w-6"/> }
                <span className="text-sm truncate">{node.name}</span>
            </div>
            {isExpanded && hasChildren && node.children.map(child => (
                <CategoryNode key={child.id} node={child} level={level + 1} onSelect={onSelect} selectedCategoryId={selectedCategoryId} />
            ))}
        </div>
    )
}

export function ProductSelector({
  isOpen,
  onOpenChange,
  onProductsSelected,
  targetGroupName,
}: ProductSelectorProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, Product>>(new Map());

  const productsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'products')) : null),
    [firestore]
  );
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

  const installationTypesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'installation_types')) : null),
    [firestore]
  );
  const { data: allCategories, isLoading: isLoadingCategories } = useCollection<InstallationType>(installationTypesQuery);

  const categoryTree = useMemo(() => buildTree(allCategories || []), [allCategories]);
  const categoryDescendants = useMemo(() => {
    const map = new Map<string, string[]>();
    const getDescendants = (nodeId: string): string[] => {
        const node = allCategories?.find(c => c.id === nodeId);
        if (!node) return [];
        let ids = [node.id];
        const children = allCategories?.filter(c => c.parentId === nodeId) || [];
        children.forEach(child => {
            ids = ids.concat(getDescendants(child.id));
        });
        return ids;
    };
    allCategories?.forEach(cat => map.set(cat.id, getDescendants(cat.id)));
    return map;
  }, [allCategories]);


  const filteredProducts = useMemo(() => {
    let products = allProducts;

    if (selectedCategoryId) {
        const idsToFilter = categoryDescendants.get(selectedCategoryId) || [];
        products = products?.filter(p => p.installationTypeId && idsToFilter.includes(p.installationTypeId))
    }

    if (searchTerm) {
        products = products?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return products || [];
  }, [allProducts, searchTerm, selectedCategoryId, categoryDescendants]);

  const handleSelectProduct = (product: Product, isChecked: boolean) => {
    setSelectedProducts(prev => {
        const newMap = new Map(prev);
        if (isChecked) {
            newMap.set(product.id, product);
        } else {
            newMap.delete(product.id);
        }
        return newMap;
    });
  }

  const handleAddClick = () => {
    onProductsSelected(Array.from(selectedProducts.values()));
    setSelectedProducts(new Map());
    onOpenChange(false);
  }
  
  const handleClose = () => {
    setSelectedProducts(new Map());
    setSearchTerm('');
    setSelectedCategoryId(null);
    onOpenChange(false);
  }


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Teklife Ürün Ekle</DialogTitle>
          <DialogDescription>
             {targetGroupName 
                ? `"${targetGroupName}" grubuna ürün ekliyorsunuz.`
                : "Kategori seçerek ve arama yaparak ürünleri filtreleyin, ardından eklemek istediklerinizi seçin."
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 overflow-hidden">
            {/* Left Panel: Categories */}
            <div className="md:col-span-1 border-r pr-4">
                <h3 className="font-semibold mb-2 px-2">Tesisat Kategorileri</h3>
                <ScrollArea className="h-full">
                    <div className="flex flex-col gap-1">
                        <div
                            className={cn("flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent", !selectedCategoryId && "bg-accent text-accent-foreground")}
                            onClick={() => setSelectedCategoryId(null)}
                        >
                            Tüm Ürünler
                        </div>
                        {isLoadingCategories ? <Loader2 className="animate-spin mx-auto mt-4" /> : categoryTree.map(node => (
                            <CategoryNode key={node.id} node={node} level={0} onSelect={setSelectedCategoryId} selectedCategoryId={selectedCategoryId} />
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Panel: Products */}
            <div className="md:col-span-3 flex flex-col gap-4 overflow-hidden">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Ürün adı veya marka ara..." 
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-4">
                        {isLoadingProducts ? <Loader2 className="animate-spin mx-auto mt-8" /> : (
                            filteredProducts.map(product => (
                                <div key={product.id} className="flex items-center gap-4 p-2 border rounded-md">
                                    <Checkbox
                                        id={`product-${product.id}`}
                                        checked={selectedProducts.has(product.id)}
                                        onCheckedChange={(checked) => handleSelectProduct(product, !!checked)}
                                    />
                                    <label htmlFor={`product-${product.id}`} className="flex-1 cursor-pointer">
                                        <p className="font-medium">{product.name}</p>
                                        <p className="text-sm text-muted-foreground">{product.brand}</p>
                                    </label>
                                    <div className="text-sm font-mono">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: product.currency }).format(product.listPrice)}</div>
                                </div>
                            ))
                        )}
                         {!isLoadingProducts && filteredProducts.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                Bu kategoriye ait veya aramanızla eşleşen ürün bulunamadı.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            İptal
          </Button>
          <Button onClick={handleAddClick} disabled={selectedProducts.size === 0}>
            {selectedProducts.size > 0 ? `${selectedProducts.size} Ürün Ekle` : 'Ürün Ekle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

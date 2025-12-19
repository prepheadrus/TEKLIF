
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Product } from '@/app/products/products-client-page';
import type { InstallationType, TreeNode } from '@/app/installation-types/installation-types-client-page';
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
    const [isExpanded, setIsExpanded] = useState(false);
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

const formatCurrency = (amount: number, currency: string) => {
    // Intl.NumberFormat expects ISO 4217 currency codes. 'TL' is not valid, 'TRY' is.
    const validCurrency = currency.toUpperCase() === 'TL' ? 'TRY' : currency;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: validCurrency }).format(amount);
};


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
        const searchTerms = searchTerm.toLocaleLowerCase('tr-TR').split(' ').filter(term => term.length > 0);
        products = products?.filter(p => {
            const productText = `${p.name} ${p.brand} ${p.model || ''}`.toLocaleLowerCase('tr-TR');
            return searchTerms.every(term => productText.includes(term));
        });
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
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle>Teklife Ürün Ekle</DialogTitle>
            <DialogDescription>
              {targetGroupName
                ? `"${targetGroupName}" grubuna ürün ekliyorsunuz.`
                : "Kategori seçerek ve arama yaparak ürünleri filtreleyin, ardından eklemek istediklerinizi seçin."
              }
            </DialogDescription>
          </DialogHeader>
        </div>
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 rounded-lg border-t"
        >
          <ResizablePanel defaultSize={30} minSize={20}>
            <div className="flex flex-col h-full">
              <h3 className="font-semibold p-4 border-b">Tesisat Kategorileri</h3>
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1 p-2">
                  <div
                    className={cn("flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent text-sm", !selectedCategoryId && "bg-accent text-accent-foreground")}
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
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={70}>
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ürün adı, marka veya model ara..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2 p-4">
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
                          <p className="text-sm text-muted-foreground">{product.brand} - {product.model}</p>
                        </label>
                        <div className="text-sm font-mono">{formatCurrency(product.listPrice, product.currency)}</div>
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
          </ResizablePanel>
        </ResizablePanelGroup>
        <div className="p-6 border-t">
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              İptal
            </Button>
            <Button onClick={handleAddClick} disabled={selectedProducts.size === 0}>
              {selectedProducts.size > 0 ? `${selectedProducts.size} Ürün Ekle` : 'Ürün Ekle'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

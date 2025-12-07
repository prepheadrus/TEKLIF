'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
} from '@/components/ui/form';
import {
  PlusCircle,
  Trash2,
  Loader2,
  BookCopy,
  Search,
  Clock,
  Package,
} from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  setDocumentNonBlocking,
} from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import type { Product } from '@/app/products/products-client-page';
import { ProductSelector } from '@/components/app/product-selector';

// --- Types ---
const recipeItemSchema = z.object({
    id: z.string().optional(),
    type: z.enum(['material', 'labor']),
    itemId: z.string(),
    name: z.string(),
    quantity: z.coerce.number().min(0.01, 'Miktar 0\'dan büyük olmalıdır.'),
    unit: z.string().optional(),
    cost: z.coerce.number(), // Birim maliyet
});

const recipeSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  recipeItems: z.array(recipeItemSchema),
});

type RecipeFormValues = z.infer<typeof recipeSchema>;
type RecipeItemForm = z.infer<typeof recipeItemSchema>;

type Recipe = {
  id: string;
  productId: string;
  recipeItems: {
    type: 'material' | 'labor';
    itemId: string;
    quantity: number;
  }[];
};

type LaborCost = {
  id: string;
  role: string;
  hourlyRate: number;
};

// --- Main Component ---
export function RecipesPageContent() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- Data Fetching ---
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, 'products')) : null), [firestore])
  );
  const { data: recipes, isLoading: isLoadingRecipes, refetch: refetchRecipes } = useCollection<Recipe>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, 'recipes')) : null), [firestore])
  );
  const { data: laborCosts, isLoading: isLoadingLabor } = useCollection<LaborCost>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, 'labor_costs')) : null), [firestore])
  );

  const productsWithRecipeStatus = useMemo(() => {
    if (!products) return [];
    const recipeProductIds = new Set(recipes?.map(r => r.productId));
    return products
      .map(p => ({ ...p, hasRecipe: recipeProductIds.has(p.id) }))
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.brand.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, recipes, searchTerm]);

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
        id: undefined,
        productId: '',
        recipeItems: [],
    }
  });

  const { fields, append, remove, reset } = useFieldArray({
    control: form.control,
    name: 'recipeItems',
  });

  useEffect(() => {
    if (selectedProduct) {
      const recipe = recipes?.find(r => r.productId === selectedProduct.id);
      
      let itemsToSet: RecipeItemForm[] = [];
      if (recipe && recipe.recipeItems && products && laborCosts) {
        itemsToSet = recipe.recipeItems.map(item => {
          let name = 'Bilinmeyen';
          let unit: string | undefined = 'adet';
          let cost = 0;
          if (item.type === 'material') {
            const product = products.find(p => p.id === item.itemId);
            name = product?.name || 'Silinmiş Ürün';
            unit = product?.unit;
            cost = product?.basePrice || 0;
          } else { // labor
            const labor = laborCosts.find(l => l.id === item.itemId);
            name = labor?.role || 'Silinmiş İşçilik';
            unit = 'saat';
            cost = labor?.hourlyRate || 0;
          }
          return { ...item, id: Math.random().toString(), name, unit, cost };
        });
      }

      reset({
        id: recipe?.id,
        productId: selectedProduct.id,
        recipeItems: itemsToSet,
      });
    } else {
        reset({ id: undefined, productId: '', recipeItems: [] });
    }
  }, [selectedProduct, recipes, products, laborCosts, reset]);

  const watchedItems = form.watch('recipeItems');

  const totalRecipeCost = useMemo(() => {
      return watchedItems?.reduce((total, item) => total + (item.cost * item.quantity), 0) || 0;
  }, [watchedItems]);


  const handleAddProductsAsMaterials = (selectedMaterials: Product[]) => {
    selectedMaterials.forEach(material => {
      append({
        type: 'material',
        itemId: material.id,
        name: material.name,
        quantity: 1,
        unit: material.unit,
        cost: material.basePrice,
      });
    });
    setIsProductSelectorOpen(false);
  };
  
  const handleAddLabor = (labor: LaborCost) => {
    append({
        type: 'labor',
        itemId: labor.id,
        name: labor.role,
        quantity: 1,
        unit: 'saat',
        cost: labor.hourlyRate,
    })
  }

  const handleSaveRecipe = async (data: RecipeFormValues) => {
    if (!firestore || !selectedProduct) return;
    setIsSaving(true);
    
    const recipeToSave = {
        productId: selectedProduct.id,
        recipeItems: data.recipeItems.map(({ id, name, unit, cost, ...rest}) => rest), // Form-only fields are removed
    };

    try {
        const docRef = data.id 
            ? doc(firestore, 'recipes', data.id)
            : doc(collection(firestore, 'recipes'));

        setDocumentNonBlocking(docRef, recipeToSave, { merge: true });
        
        toast({ title: "Başarılı!", description: `${selectedProduct.name} reçetesi kaydedildi.` });
        refetchRecipes();

    } catch (error: any) {
        toast({ variant: 'destructive', title: "Hata", description: `Reçete kaydedilemedi: ${error.message}` });
    } finally {
        setIsSaving(false);
    }
  };

  const isLoading = isLoadingProducts || isLoadingRecipes || isLoadingLabor;

  return (
    <>
    <div className="hidden h-full flex-col md:flex">
         <ResizablePanelGroup direction="horizontal" className="h-full max-h-full items-stretch">
            <ResizablePanel defaultSize={30} minSize={25}>
                <div className="flex h-full flex-col">
                    <CardHeader>
                        <CardTitle>Ürünler</CardTitle>
                        <CardDescription>Reçetesini görüntülemek veya oluşturmak için bir ürün seçin.</CardDescription>
                        <div className="relative pt-2">
                             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                             <Input 
                                placeholder="Ürün veya marka ara..." 
                                className="pl-8"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                             />
                        </div>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-4 pt-0 space-y-2">
                            {isLoading && <Loader2 className="mx-auto my-8 animate-spin" />}
                            {productsWithRecipeStatus?.map(p => (
                                <Card 
                                    key={p.id} 
                                    className={`cursor-pointer hover:bg-accent ${selectedProduct?.id === p.id ? 'border-primary' : ''}`}
                                    onClick={() => setSelectedProduct(p)}
                                >
                                    <CardContent className="p-3 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold">{p.name}</p>
                                            <p className="text-xs text-muted-foreground">{p.brand}</p>
                                        </div>
                                        {p.hasRecipe && <BookCopy className="h-5 w-5 text-primary" />}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
                 <div className="flex h-full flex-col">
                    {selectedProduct ? (
                         <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSaveRecipe)} className="flex flex-col h-full">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-2xl">{selectedProduct.name} Reçetesi</CardTitle>
                                            <CardDescription>Bu ürünü oluşturmak için gereken malzemeleri ve işçilikleri tanımlayın.</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button type="button" variant="outline" onClick={() => setIsProductSelectorOpen(true)}>
                                                <PlusCircle className="mr-2" /> Malzeme Ekle
                                            </Button>
                                             <Button type="submit" disabled={isSaving}>
                                                {isSaving && <Loader2 className="animate-spin mr-2" />}
                                                Reçeteyi Kaydet
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-hidden flex flex-col">
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">İşçilikler</CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex flex-wrap gap-2">
                                                {laborCosts?.map(l => (
                                                    <Button key={l.id} size="sm" type="button" variant="secondary" onClick={() => handleAddLabor(l)}>
                                                        <PlusCircle className="mr-2 h-3 w-3" /> {l.role}
                                                    </Button>
                                                ))}
                                            </CardContent>
                                        </Card>
                                         <Card className="bg-slate-800 text-white">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">Toplam Reçete Maliyeti</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-3xl font-bold font-mono">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalRecipeCost)}</p>
                                                <p className="text-sm text-slate-300">Bu maliyet, tekliflerdeki kar hesaplaması için kullanılacaktır.</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="border rounded-md flex-1 overflow-hidden">
                                        <Table>
                                             <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="w-12"></TableHead>
                                                    <TableHead className="w-2/5">Kalem (Malzeme/İşçilik)</TableHead>
                                                    <TableHead>Miktar</TableHead>
                                                    <TableHead>Birim</TableHead>
                                                    <TableHead className="text-right">Birim Maliyet</TableHead>
                                                    <TableHead className="text-right">Toplam Maliyet</TableHead>
                                                    <TableHead className="w-12"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {fields.map((field, index) => {
                                                    const itemTotalCost = watchedItems[index].quantity * watchedItems[index].cost;
                                                    return (
                                                    <TableRow key={field.id}>
                                                        <TableCell className="text-center">
                                                            {field.type === 'material' ? <Package className="h-5 w-5 text-slate-500" /> : <Clock className="h-5 w-5 text-blue-500" />}
                                                        </TableCell>
                                                        <TableCell className="font-medium">{field.name}</TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`recipeItems.${index}.quantity`} render={({field}) => (
                                                                <Input {...field} type="number" step="any" className="w-24 h-8" />
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>{field.unit}</TableCell>
                                                        <TableCell className="text-right font-mono">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(field.cost)}</TableCell>
                                                        <TableCell className="text-right font-mono font-semibold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(itemTotalCost)}</TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(index)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </form>
                         </Form>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <BookCopy className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold">Reçete Görüntüle veya Oluştur</h3>
                            <p className="text-muted-foreground mt-2">Lütfen soldaki listeden bir ürün seçin.</p>
                        </div>
                    )}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    </div>
    <ProductSelector 
        isOpen={isProductSelectorOpen}
        onOpenChange={setIsProductSelectorOpen}
        onProductsSelected={handleAddProductsAsMaterials}
    />
    </>
  );
}

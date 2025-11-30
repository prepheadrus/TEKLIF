'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Loader2, Save, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

// Schemas
const recipeItemSchema = z.object({
    type: z.enum(['material', 'labor']),
    itemId: z.string().min(1, 'Kalem seçimi zorunludur.'),
    quantity: z.coerce.number().min(0.001, 'Miktar 0 dan büyük olmalıdır.'),
});

const recipeSchema = z.object({
  productId: z.string().min(1, 'Ürün seçimi zorunludur.'),
  recipeItems: z.array(recipeItemSchema).min(1, 'Reçetede en az bir kalem olmalıdır.'),
});

type RecipeFormValues = z.infer<typeof recipeSchema>;

// Types for fetched data
type Product = { id: string; name: string; brand: string; };
type Material = { id: string; name: string; unit: string; };
type LaborCost = { id: string; role: string; };
type Recipe = RecipeFormValues & { id: string; };

export default function RecipesPage() {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  // Data fetching
  const productsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  
  const materialsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'materials') : null, [firestore]);
  const { data: materials, isLoading: areMaterialsLoading } = useCollection<Material>(materialsQuery);

  const laborCostsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'labor_costs') : null, [firestore]);
  const { data: laborCosts, isLoading: areLaborCostsLoading } = useCollection<LaborCost>(laborCostsQuery);
  
  const recipesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'recipes') : null, [firestore]);
  const { data: recipes, isLoading: areRecipesLoading } = useCollection<Recipe>(recipesQuery);

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      productId: '',
      recipeItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "recipeItems",
  });

  const isLoading = areProductsLoading || areMaterialsLoading || areLaborCostsLoading || areRecipesLoading;

  const onSubmit = (values: RecipeFormValues) => {
    if (!firestore) return;
    
    const recipeId = selectedRecipe ? selectedRecipe.id : doc(collection(firestore, 'recipes')).id;
    const recipeDocRef = doc(firestore, 'recipes', recipeId);
    
    setDocumentNonBlocking(recipeDocRef, values, { merge: true });

    toast({
      title: "Başarılı",
      description: `Reçete başarıyla ${selectedRecipe ? 'güncellendi' : 'kaydedildi'}.`,
    });
    
    form.reset();
    setSelectedRecipe(null);
  };

  const handleSelectRecipe = (recipeId: string) => {
    const recipe = recipes?.find(r => r.id === recipeId);
    if (recipe) {
      setSelectedRecipe(recipe);
      form.reset(recipe);
    }
  };

  const handleDeleteRecipe = (recipeId: string) => {
     if (!firestore) return;
     deleteDocumentNonBlocking(doc(firestore, 'recipes', recipeId));
     toast({ title: "Başarılı", description: "Reçete silindi."});
     if(selectedRecipe?.id === recipeId) {
        form.reset();
        setSelectedRecipe(null);
     }
  }
  
  const getResourceName = (type: 'material' | 'labor', id: string) => {
    if (type === 'material') {
        return materials?.find(m => m.id === id)?.name ?? 'Bilinmeyen Malzeme';
    }
    return laborCosts?.find(l => l.id === id)?.role ?? 'Bilinmeyen İşçilik';
  }
  
  const getResourceUnit = (type: 'material' | 'labor', id: string) => {
    if (type === 'material') {
        return materials?.find(m => m.id === id)?.unit ?? 'Birim';
    }
    return 'Saat';
  }

  const getProductName = (productId: string) => {
    return products?.find(p => p.id === productId)?.name ?? 'Bilinmeyen Ürün';
  };

  return (
    <div className="grid md:grid-cols-[1fr,2fr] gap-8">
      {/* Recipe List */}
      <Card>
        <CardHeader>
          <CardTitle>Kayıtlı Reçeteler</CardTitle>
          <CardDescription>Bir ürün seçerek reçetesini düzenleyin.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                 <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : recipes && recipes.length > 0 ? (
                <ul className="space-y-2">
                    {recipes.map(recipe => (
                        <li key={recipe.id}>
                            <Card className={`cursor-pointer hover:bg-muted ${selectedRecipe?.id === recipe.id ? 'border-primary' : ''}`}>
                                <CardContent className="p-3 flex justify-between items-center" onClick={() => handleSelectRecipe(recipe.id)}>
                                    <div>
                                        <p className="font-semibold">{getProductName(recipe.productId)}</p>
                                        <p className="text-sm text-muted-foreground">{recipe.recipeItems.length} kalem içeriyor</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteRecipe(recipe.id); }}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </CardContent>
                            </Card>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-10">Henüz reçete oluşturulmamış.</p>
            )}
        </CardContent>
      </Card>

      {/* Recipe Form */}
      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <div className="flex justify-between items-start">
                  <div>
                      <CardTitle>{selectedRecipe ? 'Reçeteyi Düzenle' : 'Yeni Reçete Oluştur'}</CardTitle>
                      <CardDescription>Bir ürünün maliyetini oluşturan malzeme ve işçilikleri tanımlayın.</CardDescription>
                  </div>
                  {selectedRecipe && (
                      <Button variant="outline" size="sm" onClick={() => { setSelectedRecipe(null); form.reset(); }}>
                          <PlusCircle className="mr-2 h-4 w-4"/> Yeni Oluştur
                      </Button>
                  )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ürün</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!selectedRecipe}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={areProductsLoading ? "Ürünler Yükleniyor..." : "Reçete oluşturulacak ürünü seçin"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products?.filter(p => !recipes?.some(r => r.productId === p.id && r.id !== selectedRecipe?.id)).map(product => (
                          <SelectItem key={product.id} value={product.id}>{product.name} ({product.brand})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <h3 className="text-lg font-medium mb-2">Reçete Kalemleri</h3>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[20%]">Tip</TableHead>
                            <TableHead className="w-[50%]">Kalem</TableHead>
                            <TableHead className="w-[20%]">Miktar</TableHead>
                            <TableHead className="w-[10%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => (
                           <TableRow key={field.id}>
                             <TableCell className="p-1">
                                <Controller
                                    control={form.control}
                                    name={`recipeItems.${index}.type`}
                                    render={({ field: controllerField }) => (
                                         <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="material">Malzeme</SelectItem>
                                                <SelectItem value="labor">İşçilik</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                             </TableCell>
                             <TableCell className="p-1">
                                 <Controller
                                    control={form.control}
                                    name={`recipeItems.${index}.itemId`}
                                    render={({ field: controllerField }) => (
                                         <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Kalem seçin..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {form.watch(`recipeItems.${index}.type`) === 'material' ? (
                                                    materials?.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)
                                                ) : (
                                                    laborCosts?.map(l => <SelectItem key={l.id} value={l.id}>{l.role}</SelectItem>)
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                             </TableCell>
                             <TableCell className="p-1">
                                 <Controller
                                    control={form.control}
                                    name={`recipeItems.${index}.quantity`}
                                    render={({ field: controllerField }) => (
                                        <Input type="number" placeholder="Miktar" {...controllerField} />
                                    )}
                                />
                             </TableCell>
                             <TableCell className="p-1 text-right">
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <XCircle className="h-5 w-5 text-destructive" />
                                </Button>
                             </TableCell>
                           </TableRow>
                        ))}
                    </TableBody>
                 </Table>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => append({ type: 'material', itemId: '', quantity: 1 })}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Yeni Kalem Ekle
                </Button>
                <FormMessage>{form.formState.errors.recipeItems?.message}</FormMessage>

              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                 {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {selectedRecipe ? 'Reçeteyi Güncelle' : 'Reçeteyi Kaydet'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

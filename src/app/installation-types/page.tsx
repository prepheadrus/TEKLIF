
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  doc,
  deleteDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QuickAddInstallationType } from '@/components/app/quick-add-installation-type';
import { cn } from '@/lib/utils';
import { initialInstallationTypesData } from '@/lib/seed-data';

export type InstallationType = {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
};

// This is the new type for the hierarchical tree structure
export type TreeNode = InstallationType & {
  children: TreeNode[];
};

// Function to build the tree from a flat list of categories
const buildTree = (categories: InstallationType[]): TreeNode[] => {
  const categoryMap: { [id: string]: TreeNode } = {};
  const roots: TreeNode[] = [];

  // Initialize map and children arrays
  categories.forEach(category => {
    categoryMap[category.id] = { ...category, children: [] };
  });

  // Populate children arrays and find roots
  categories.forEach(category => {
    if (category.parentId && categoryMap[category.parentId]) {
      categoryMap[category.parentId].children.push(categoryMap[category.id]);
    } else {
      roots.push(categoryMap[category.id]);
    }
  });
  
  // Sort roots and all children alphabetically by name
  const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach(node => sortNodes(node.children));
  };
  
  sortNodes(roots);

  return roots;
};


// Recursive component to render the category tree. It's simpler now.
const CategoryNode = ({
  node,
  level,
  onEdit,
  onDelete,
  onAddSub,
}: {
  node: TreeNode;
  level: number;
  onEdit: (category: InstallationType) => void;
  onDelete: (categoryId: string) => void;
  onAddSub: (parentId: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between py-2 px-4 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
           level > 0 && "border-t"
        )}
        style={{ paddingLeft: `${level * 24 + 16}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
             <div className="w-6 h-6" />
          )}
          <span className="font-medium">{node.name}</span>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onAddSub(node.id)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Alt Kategori Ekle
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Menüyü aç</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onEdit(node)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Düzenle
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Sil
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bu işlem geri alınamaz. Bu kategoriyi ve tüm alt
                        kategorilerini kalıcı olarak silecektir.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>İptal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(node.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Evet, Sil
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
      {isExpanded && hasChildren &&
        node.children.map((childNode) => (
          <CategoryNode
            key={childNode.id}
            node={childNode}
            level={level + 1}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddSub={onAddSub}
          />
        ))}
    </div>
  );
};

export default function InstallationTypesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  // State for managing the dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<InstallationType | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  const categoriesQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'installation_types'))
        : null,
    [firestore]
  );
  const {
    data: categories,
    isLoading,
    error,
    refetch,
  } = useCollection<InstallationType>(categoriesQuery);

  const seedData = useCallback(async () => {
    if (!firestore) return;

    setIsSeeding(true);
    toast({ title: 'Başlangıç verisi oluşturuluyor...' });
    try {
        const batch = writeBatch(firestore);
        const collectionRef = collection(firestore, 'installation_types');
        const parentMap: { [name: string]: string } = {};

        // Pass 1: Create all parent categories and map their names to temporary IDs
        const parentItems = initialInstallationTypesData.filter(item => !item.name.includes('>'));
        for (const item of parentItems) {
            const newDocRef = doc(collectionRef);
            batch.set(newDocRef, { name: item.name, description: item.description, parentId: null });
            parentMap[item.name] = newDocRef.id;
        }

        // Commit the first batch to get the parent IDs into the system
        await batch.commit();

        // Pass 2: Create child categories using the IDs from the parentMap
        const childBatch = writeBatch(firestore);
        const childItems = initialInstallationTypesData.filter(item => item.name.includes('>'));
        for (const item of childItems) {
            const parts = item.name.split(' > ');
            const parentName = parts[0];
            const childName = parts[1];
            const parentId = parentMap[parentName];

            if (parentId) {
                const newChildRef = doc(collectionRef);
                childBatch.set(newChildRef, { name: childName, description: item.description, parentId: parentId });
            } else {
                console.warn(`Parent category "${parentName}" not found for child "${childName}"`);
            }
        }
        
        await childBatch.commit();

        toast({
            title: 'Başarılı!',
            description: 'Temel tesisat kategorileri oluşturuldu.',
        });
        refetch();
    } catch (err: any) {
        console.error("Seeding error:", err);
        toast({
            variant: 'destructive',
            title: 'Veri oluşturma hatası',
            description: err.message,
        });
    } finally {
        setIsSeeding(false);
    }
}, [firestore, refetch, toast]);


  // Seed initial data if the collection is empty
  useEffect(() => {
    if (!isLoading && categories?.length === 0 && !isSeeding) {
        seedData();
    }
  }, [isLoading, categories, isSeeding, seedData]);


  const categoryTree = useMemo(() => {
    if (!categories) return [];
    return buildTree(categories);
  }, [categories]);

  const handleOpenDialogForNew = (parentId: string | null = null) => {
    setEditingCategory(null);
    setDefaultParentId(parentId);
    setIsDialogOpen(true);
  };

  const handleOpenDialogForEdit = (category: InstallationType) => {
    setDefaultParentId(null);
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleDelete = async (categoryId: string) => {
    if (!firestore || !categories) return;

    // Find all children recursively to delete them as well
    const idsToDelete = new Set<string>([categoryId]);
    const queue = [categoryId];
    const categoryMap = buildTree(categories); // We need the tree to find children easily
    
    const findNode = (nodes: TreeNode[], id: string): TreeNode | null => {
        for(const node of nodes) {
            if (node.id === id) return node;
            const found = findNode(node.children, id);
            if (found) return found;
        }
        return null;
    };

    const nodeToDelete = findNode(categoryMap, categoryId);

    const collectChildrenIds = (node: TreeNode) => {
        idsToDelete.add(node.id);
        node.children.forEach(collectChildrenIds);
    };

    if (nodeToDelete) {
        collectChildrenIds(nodeToDelete);
    }


    try {
      const batch = writeBatch(firestore);
      idsToDelete.forEach((id) => {
        batch.delete(doc(firestore, 'installation_types', id));
      });
      await batch.commit();
      toast({ title: 'Başarılı', description: 'Kategori(ler) silindi.' });
      refetch();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: `Kategori silinemedi: ${error.message}`,
      });
    }
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Tesisat Kategorileri
            </h1>
            <p className="text-muted-foreground">
              Ürün ve hizmetlerinizi sınıflandırdığınız mekanik disiplinleri
              yönetin.
            </p>
          </div>
          <Button onClick={() => handleOpenDialogForNew(null)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Yeni Ana Disiplin Ekle
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Kategori Hiyerarşisi</CardTitle>
            <CardDescription>
              Tüm disiplinler ve alt kategorileriniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || isSeeding ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-4">Kategoriler yükleniyor...</p>
              </div>
            ) : error ? (
              <p className="text-red-600">Hata: {error.message}</p>
            ) : categoryTree.length > 0 ? (
              <div className="border rounded-lg">
                {categoryTree.map((node) => (
                  <CategoryNode
                    key={node.id}
                    node={node}
                    level={0}
                    onEdit={handleOpenDialogForEdit}
                    onDelete={handleDelete}
                    onAddSub={(parentId) => handleOpenDialogForNew(parentId)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                 {categories && categories.length === 0 && !isSeeding ? 
                    "Henüz kategori oluşturulmamış." : 
                    "Başlangıç verileri yükleniyor veya yüklenemedi..."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <QuickAddInstallationType
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={refetch}
        existingCategory={editingCategory}
        defaultParentId={defaultParentId}
        allCategories={categories || []}
      />
    </>
  );
}

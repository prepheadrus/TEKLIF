
'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
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
  AlertTriangle,
  UploadCloud,
} from 'lucide-react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  query,
  doc,
  deleteDoc,
  writeBatch,
  getDocs,
  addDoc,
  where,
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
import type { InitialInstallationType } from '@/lib/seed-data';


export type InstallationType = {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
};

export type TreeNode = InstallationType & {
  children: TreeNode[];
};


const buildTree = (categories: InstallationType[]): TreeNode[] => {
  const categoryMap: { [id: string]: TreeNode } = {};
  const roots: TreeNode[] = [];

  if (!categories) return roots;

  categories.forEach(category => {
    categoryMap[category.id] = { ...category, children: [] };
  });

  categories.forEach(category => {
    if (category.parentId && categoryMap[category.parentId]) {
      // Avoid a category being its own parent
      if (category.id !== category.parentId) { 
        categoryMap[category.parentId].children.push(categoryMap[category.id]);
      }
    } else {
      roots.push(categoryMap[category.id]);
    }
  });
  
  // Sort children for each node
  Object.values(categoryMap).forEach(node => {
      node.children.sort((a, b) => a.name.localeCompare(b.name, 'tr', { numeric: true }));
  });
  
  // Sort root nodes
  roots.sort((a, b) => a.name.localeCompare(b.name, 'tr', { numeric: true }));

  return roots;
};

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
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between py-2 px-4 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
           level > 0 && "border-t"
        )}
        style={{ paddingLeft: `${level * 24 + 16}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
           <div className="flex items-center self-start pt-1">
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
                <div className="w-6 h-6" /> // Placeholder to maintain alignment
            )}
           </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{node.name}</p>
             {node.description && (
                <p className="text-xs text-muted-foreground truncate">{node.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
            <Button variant="outline" size="sm" onClick={() => onAddSub(node.id)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Alt Kategori
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


export function InstallationTypesPageContent() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InstallationType | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

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
    const idsToDelete = new Set<string>();
    const queue: string[] = [categoryId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      idsToDelete.add(currentId);
      
      const children = categories.filter(c => c.parentId === currentId);
      children.forEach(child => queue.push(child.id));
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

  const handleDeleteAllCategories = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Veritabanı bağlantısı yok.' });
      return;
    }
    try {
      const collectionRef = collection(firestore, 'installation_types');
      const snapshot = await getDocs(collectionRef);
      if (snapshot.empty) {
        toast({ title: 'Bilgi', description: 'Silinecek kategori bulunmuyor.' });
        return;
      }
      const batch = writeBatch(firestore);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({ title: 'Başarılı!', description: 'Tüm kategoriler veritabanından silindi.' });
      refetch();
    } catch (error: any) {
      console.error("Error deleting all categories: ", error);
      toast({
        variant: 'destructive',
        title: 'Toplu Silme Hatası',
        description: `Kategoriler silinirken bir hata oluştu: ${error.message}`,
      });
    }
  };

  const seedData = async () => {
    if (!firestore) return;
    setIsSeeding(true);

    try {
      const collectionRef = collection(firestore, 'installation_types');
      const parentIdMap = new Map<string, string>();
      const batch = writeBatch(firestore);

      // Recursive function to process categories
      const processCategory = (category: InitialInstallationType, parentId: string | null) => {
        const newDocRef = doc(collectionRef);
        batch.set(newDocRef, { 
          name: category.name, 
          description: category.description || "", 
          parentId: parentId 
        });
        if (category.children) {
          category.children.forEach(child => processCategory(child, newDocRef.id));
        }
      };

      // Start processing top-level categories
      initialInstallationTypesData.forEach(cat => processCategory(cat, null));
      
      await batch.commit();
      toast({ title: 'Başarılı!', description: 'Örnek kategoriler veritabanına yüklendi.' });
      refetch();
    } catch (error: any) {
      console.error("Error seeding data:", error);
      toast({
        variant: 'destructive',
        title: 'Veri Yükleme Hatası',
        description: `Örnek veriler yüklenirken bir hata oluştu: ${error.message}`,
      });
    } finally {
      setIsSeeding(false);
    }
  };


  return (
    <>
      <div className="flex flex-col gap-8 p-8">
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
          <div className="flex items-center gap-2">
             <Button onClick={seedData} disabled={isSeeding} variant="outline">
              {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Örnek Kategorileri Yükle
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                 <Button variant="destructive">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Tüm Kategorileri Temizle
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Tüm Kategorileri Silmek Üzeresiniz!</AlertDialogTitle>
                      <AlertDialogDescription>
                          Bu işlem geri alınamaz. Veritabanındaki tüm tesisat kategorileri kalıcı olarak silinecektir. Emin misiniz?
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>İptal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllCategories} className="bg-destructive hover:bg-destructive/90">
                          Evet, Hepsini Sil
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>

            <Button onClick={() => handleOpenDialogForNew(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Yeni Ana Disiplin Ekle
            </Button>
          </div>

        </div>
        <Card>
          <CardHeader>
            <CardTitle>Kategori Hiyerarşisi</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
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
                Henüz kategori oluşturulmamış. Yeni bir ana disiplin ekleyerek
                başlayın veya örnek verileri yükleyin.
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

    
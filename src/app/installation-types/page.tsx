'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { initialInstallationTypes } from '@/lib/seed-data';

export type InstallationType = {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
};

// Recursive component to render the category tree
const CategoryNode = ({
  category,
  allCategories,
  level,
  onEdit,
  onDelete,
  onAddSub,
}: {
  category: InstallationType;
  allCategories: InstallationType[];
  level: number;
  onEdit: (category: InstallationType) => void;
  onDelete: (categoryId: string) => void;
  onAddSub: (parentId: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const children = allCategories.filter((c) => c.parentId === category.id);

  return (
    <div>
      <div
        className="flex items-center justify-between py-2 px-4 rounded-md hover:bg-gray-100"
        style={{ paddingLeft: `${level * 24 + 16}px` }}
      >
        <div className="flex items-center gap-2">
          {children.length > 0 && (
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
          )}
          {children.length === 0 && <div className="w-6 h-6" />}{' '}
          {/* Placeholder for alignment */}
          <span className="font-medium">{category.name}</span>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onAddSub(category.id)}>
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
                <DropdownMenuItem onClick={() => onEdit(category)}>
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
                        onClick={() => onDelete(category.id)}
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
      {isExpanded &&
        children.map((child) => (
          <CategoryNode
            key={child.id}
            category={child}
            allCategories={allCategories}
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
        ? query(collection(firestore, 'installation_types'), orderBy('name'))
        : null,
    [firestore]
  );
  const {
    data: categories,
    isLoading,
    error,
    refetch,
  } = useCollection<InstallationType>(categoriesQuery);

  // Seed initial data if the collection is empty
  useEffect(() => {
    if (
      !isLoading &&
      categories &&
      categories.length === 0 &&
      firestore &&
      !isSeeding
    ) {
      const seedData = async () => {
        setIsSeeding(true);
        toast({ title: 'Başlangıç verisi oluşturuluyor...' });
        try {
          const batch = writeBatch(firestore);
          initialInstallationTypes.forEach((category) => {
            const docRef = doc(collection(firestore, 'installation_types'));
            batch.set(docRef, category);
          });
          await batch.commit();
          toast({
            title: 'Başarılı!',
            description: 'Temel tesisat kategorileri oluşturuldu.',
          });
          refetch();
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: 'Veri oluşturma hatası',
            description: err.message,
          });
        } finally {
          setIsSeeding(false);
        }
      };
      seedData();
    }
  }, [isLoading, categories, firestore, refetch, toast, isSeeding]);

  const categoryTree = useMemo(() => {
    if (!categories) return [];
    return categories.filter((c) => !c.parentId); // Get only top-level categories
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
    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = categories.filter((c) => c.parentId === currentId);
      children.forEach((child) => {
        idsToDelete.add(child.id);
        queue.push(child.id);
      });
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
                {categoryTree.map((category) => (
                  <CategoryNode
                    key={category.id}
                    category={category}
                    allCategories={categories || []}
                    level={0}
                    onEdit={handleOpenDialogForEdit}
                    onDelete={handleDelete}
                    onAddSub={(parentId) => handleOpenDialogForNew(parentId)}
                  />
                ))}
              </div>
            ) : (
              <p>Henüz kategori oluşturulmamış.</p>
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

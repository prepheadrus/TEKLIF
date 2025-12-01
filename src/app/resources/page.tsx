'use client';

import { useState, useMemo } from 'react';
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
  UploadCloud
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  deleteDocumentNonBlocking,
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, getDocs, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuickAddMaterial } from '@/components/app/quick-add-material';
import { materialSeedData } from '@/lib/material-seed-data';

// Data Types
export type Material = {
  id: string;
  name: string;
  unit: string;
  currency: 'TRY' | 'USD' | 'EUR';
  basePrice: number;
  supplierId: string;
  categoryName?: string;
};

export type Supplier = {
  id: string;
  name: string;
};

export type LaborCost = {
  id: string;
  role: string;
  hourlyRate: number;
};


// Main Component
export default function ResourcesPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('materials');

  // --- Materials State ---
  const [isMaterialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialSearchTerm, setMaterialSearchTerm] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  // --- Data Fetching ---
  const materialsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'materials'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: materials, isLoading: isLoadingMaterials, refetch: refetchMaterials } = useCollection<Material>(materialsQuery);

  const suppliersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'suppliers')) : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);

  const supplierMap = useMemo(() => {
    if (!suppliers) return new Map<string, string>();
    return new Map(suppliers.map(s => [s.id, s.name]));
  }, [suppliers]);


  // --- Event Handlers for Materials ---
  const handleOpenAddMaterialDialog = () => {
    setEditingMaterial(null);
    setMaterialDialogOpen(true);
  };

  const handleOpenEditMaterialDialog = (material: Material) => {
    setEditingMaterial(material);
    setMaterialDialogOpen(true);
  };

  const handleDeleteMaterial = (materialId: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'materials', materialId));
    toast({ title: 'Başarılı', description: 'Malzeme silindi.' });
    refetchMaterials();
  };

  const handleSeedMaterials = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    toast({ title: 'Başlatılıyor...', description: 'Örnek malzeme verileri veritabanına yükleniyor.' });

    try {
      const batch = writeBatch(firestore);
      const suppliersCollection = collection(firestore, 'suppliers');
      const materialsCollection = collection(firestore, 'materials');
      const seededSupplierIds = new Map<string, string>();

      // 1. Create or find suppliers
      const uniqueSupplierNames = [...new Set(materialSeedData.map(m => m.supplierName))];

      for (const name of uniqueSupplierNames) {
        const q = query(suppliersCollection, where("name", "==", name));
        const existingSupplierSnap = await getDocs(q);
        if (existingSupplierSnap.empty) {
          const newSupplierRef = doc(suppliersCollection);
          batch.set(newSupplierRef, { name, contactEmail: `${name.toLowerCase().replace(/ /g, '.')}@example.com` });
          seededSupplierIds.set(name, newSupplierRef.id);
        } else {
          seededSupplierIds.set(name, existingSupplierSnap.docs[0].id);
        }
      }

      // 2. Create materials with supplier IDs
      for (const material of materialSeedData) {
        const supplierId = seededSupplierIds.get(material.supplierName);
        if (!supplierId) {
          console.warn(`Tedarikçi bulunamadı: ${material.supplierName}`);
          continue;
        }
        const newMaterialRef = doc(materialsCollection);
        const { supplierName, ...restOfMaterial } = material;
        batch.set(newMaterialRef, { ...restOfMaterial, supplierId });
      }

      await batch.commit();
      toast({ title: 'Başarılı!', description: 'Örnek malzemeler ve tedarikçiler başarıyla yüklendi.' });
      refetchMaterials();
      // refetchSuppliers(); // Assuming useCollection has this
    } catch (error: any) {
      console.error("Seeding error:", error);
      toast({ variant: 'destructive', title: 'Hata', description: `Veri yüklenemedi: ${error.message}` });
    } finally {
      setIsSeeding(false);
    }
  };
  
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);
  };

  const filteredMaterials = materials?.filter(
    (m) =>
      m.name.toLowerCase().includes(materialSearchTerm.toLowerCase()) ||
      (supplierMap.get(m.supplierId) || '').toLowerCase().includes(materialSearchTerm.toLowerCase())
  );
  
  const tableIsLoading = isLoadingMaterials || isLoadingSuppliers;

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Kaynak Yönetimi</h2>
          <p className="text-muted-foreground">
            Maliyet analizleriniz için malzeme ve işçilik kaynaklarınızı yönetin.
          </p>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="materials">Malzemeler</TabsTrigger>
          <TabsTrigger value="labor">İşçilik</TabsTrigger>
        </TabsList>
        
        {/* Materials Tab */}
        <TabsContent value="materials">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Malzeme Listesi</CardTitle>
                    <CardDescription>Tüm malzemeleriniz ve alış fiyatlarınız.</CardDescription>
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={handleSeedMaterials} disabled={isSeeding} variant="outline">
                        {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                        Örnek Malzemeleri Yükle
                    </Button>
                    <Button onClick={handleOpenAddMaterialDialog}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Yeni Malzeme Ekle
                    </Button>
                </div>
              </div>
              <div className="relative pt-4">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Malzeme adı veya tedarikçi ara..."
                  className="pl-8"
                  value={materialSearchTerm}
                  onChange={(e) => setMaterialSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Malzeme Adı</TableHead>
                    <TableHead>Tedarikçi</TableHead>
                    <TableHead>Birim</TableHead>
                    <TableHead>Birim Alış Fiyatı</TableHead>
                    <TableHead><span className="sr-only">İşlemler</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableIsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : filteredMaterials && filteredMaterials.length > 0 ? (
                    filteredMaterials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">
                          <div>{material.name}</div>
                          {material.categoryName && <div className="text-xs text-muted-foreground">{material.categoryName}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{supplierMap.get(material.supplierId) || 'Bilinmiyor'}</Badge>
                        </TableCell>
                        <TableCell>{material.unit}</TableCell>
                        <TableCell>{formatCurrency(material.basePrice, material.currency)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Menüyü aç</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleOpenEditMaterialDialog(material)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Düzenle
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Sil
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Bu işlem geri alınamaz. Bu malzemeyi kalıcı olarak silecektir.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteMaterial(material.id)} className="bg-destructive hover:bg-destructive/90">
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
                      <TableCell colSpan={5} className="h-24 text-center">
                        Henüz malzeme bulunmuyor. Örnek verileri yükleyebilir veya yeni malzeme ekleyebilirsiniz.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Labor Tab */}
        <TabsContent value="labor">
          <Card>
            <CardHeader>
              <CardTitle>İşçilik Maliyetleri</CardTitle>
              <CardDescription>
                Farklı roller için saatlik işçilik maliyetlerinizi yönetin. Bu özellik yakında eklenecektir.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <div className="h-24 flex items-center justify-center text-muted-foreground">
                Yakında...
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <QuickAddMaterial
        isOpen={isMaterialDialogOpen}
        onOpenChange={setMaterialDialogOpen}
        onSuccess={() => {
            refetchMaterials();
        }}
        existingMaterial={editingMaterial}
      />
    </>
  );
}

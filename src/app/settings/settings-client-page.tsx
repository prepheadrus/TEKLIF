
'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const COLLECTIONS_TO_MANAGE = [
  { id: 'customers', name: 'Müşteriler', subcollections: ['interactions'] },
  { id: 'products', name: 'Ürünler ve Malzemeler', subcollections: ['notes'] },
  { id: 'proposals', name: 'Teklifler ve Revizyonlar', subcollections: ['proposal_items'] },
  { id: 'personnel', name: 'Ustalar ve Personel', subcollections: [] },
  { id: 'job_assignments', name: 'İş Atamaları ve Hakedişler', subcollections: [] },
  { id: 'recipes', name: 'Reçeteler', subcollections: [] },
  { id: 'installation_types', name: 'Tesisat Kategorileri', subcollections: [] },
  { id: 'suppliers', name: 'Tedarikçiler', subcollections: [] },
  { id: 'labor_costs', name: 'İşçilik Maliyetleri', subcollections: [] },
  { id: 'app_settings', name: 'Uygulama Ayarları (Aylık Hedef vb.)', subcollections: [] },
];

export function SettingsPageContent() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());

  const handleSelectionChange = (collectionId: string, checked: boolean) => {
    setSelectedCollections(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(collectionId);
      } else {
        newSet.delete(collectionId);
      }
      return newSet;
    });
  };

  const handleDeleteSelectedData = async () => {
    if (!firestore || selectedCollections.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Silinecek bir veri türü seçmediniz veya veritabanı bağlantısı yok.',
      });
      return;
    }

    setIsDeleting(true);
    toast({
      title: 'İşlem Başlatıldı',
      description: 'Seçili veriler siliniyor. Bu işlem biraz zaman alabilir...',
    });

    try {
      const collectionsToDelete = COLLECTIONS_TO_MANAGE.filter(c => selectedCollections.has(c.id));

      for (const collectionInfo of collectionsToDelete) {
        const mainCollectionRef = collection(firestore, collectionInfo.id);
        const mainDocsSnap = await getDocs(mainCollectionRef);
        const batch = writeBatch(firestore);

        if (mainDocsSnap.empty) {
          console.log(`Koleksiyon boş: ${collectionInfo.id}, geçiliyor.`);
          continue;
        }

        console.log(`${mainDocsSnap.size} belge silinecek: ${collectionInfo.id}`);

        for (const docSnap of mainDocsSnap.docs) {
          // Önce alt koleksiyonları temizle
          if (collectionInfo.subcollections.length > 0) {
            for (const subcollectionName of collectionInfo.subcollections) {
              const subcollectionRef = collection(docSnap.ref, subcollectionName);
              const subcollectionSnap = await getDocs(subcollectionRef);
              subcollectionSnap.forEach(subDoc => batch.delete(subDoc.ref));
            }
          }
          // Ana belgeyi sil
          batch.delete(docSnap.ref);
        }
        await batch.commit();
        console.log(`Koleksiyon temizlendi: ${collectionInfo.id}`);
      }

      toast({
        title: 'İşlem Başarılı!',
        description: `${collectionsToDelete.map(c => c.name).join(', ')} verileri kalıcı olarak silindi.`,
      });

      setSelectedCollections(new Set());

    } catch (error: any) {
      console.error('Veri silme hatası:', error);
      toast({
        variant: 'destructive',
        title: 'Silme Hatası',
        description: `Veriler silinirken bir hata oluştu: ${error.message}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ayarlar</h2>
          <p className="text-muted-foreground">
            Uygulama ve veri yönetimi.
          </p>
        </div>
      </div>
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle />
            Tehlikeli Alan
          </CardTitle>
          <CardDescription>
            Bu alandaki işlemler geri alınamaz. Lütfen dikkatli olun.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg">Veritabanı Verilerini Yönet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Veritabanından kalıcı olarak silmek istediğiniz veri türlerini seçin. Bu işlem, seçilen kategorideki tüm kayıtları ve ilişkili alt verileri (örneğin tekliflerin kalemleri) silecektir.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 rounded-md border p-4">
              {COLLECTIONS_TO_MANAGE.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2">
                      <Checkbox
                          id={item.id}
                          checked={selectedCollections.has(item.id)}
                          onCheckedChange={(checked) => handleSelectionChange(item.id, !!checked)}
                          disabled={isDeleting}
                      />
                      <label htmlFor={item.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {item.name}
                      </label>
                  </div>
              ))}
            </div>
            
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Uyarı</AlertTitle>
                <AlertDescription>
                    Bu işlem, seçtiğiniz tüm verileri kalıcı olarak silecektir ve geri alınamaz. Örneğin "Müşteriler" seçeneğini silmek, tüm müşteri kayıtlarınızı ve onlarla ilgili notları yok edecektir.
                </AlertDescription>
            </Alert>
            
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={selectedCollections.size === 0 || isDeleting}>
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Seçili {selectedCollections.size} Veri Grubunu Sil
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                <AlertDialogDescription>
                  Seçtiğiniz {selectedCollections.size} veri grubundaki tüm kayıtlar kalıcı olarak silinecektir. Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteSelectedData}
                  className="bg-destructive hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                   {isDeleting ? 'Siliniyor...' : 'Evet, Seçilenleri Sil'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </CardContent>
      </Card>
    </div>
  );
}


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
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const COLLECTIONS_TO_DELETE = [
  'suppliers',
  'labor_costs',
  'recipes',
  'customers',
  'proposals',
  'products',
  'installation_types',
  'personnel',
  'job_assignments',
];

const SUBCOLLECTIONS_MAP: Record<string, string[]> = {
    customers: ['interactions'],
    proposals: ['proposal_items'],
    products: ['notes'],
}

export function SettingsPageContent() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleDeleteAllData = async () => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Veritabanı bağlantısı kurulamadı.',
      });
      return;
    }

    setIsDeleting(true);
    toast({
        title: 'İşlem Başlatıldı',
        description: 'Tüm veriler siliniyor. Bu işlem biraz zaman alabilir...',
    });

    try {
        for (const collectionName of COLLECTIONS_TO_DELETE) {
            const mainCollectionRef = collection(firestore, collectionName);
            const mainCollectionSnap = await getDocs(mainCollectionRef);
            const batch = writeBatch(firestore);

            if (mainCollectionSnap.empty) {
                console.log(`Koleksiyon boş: ${collectionName}, geçiliyor.`);
                continue;
            }

            console.log(`${mainCollectionSnap.size} belge silinecek: ${collectionName}`);

            for (const docSnap of mainCollectionSnap.docs) {
                // Check for and delete subcollections first
                if (SUBCOLLECTIONS_MAP[collectionName]) {
                    for (const subcollectionName of SUBCOLLECTIONS_MAP[collectionName]) {
                        const subcollectionRef = collection(docSnap.ref, subcollectionName);
                        const subcollectionSnap = await getDocs(subcollectionRef);
                        subcollectionSnap.forEach(subDoc => batch.delete(subDoc.ref));
                    }
                }
                // Delete the main document
                batch.delete(docSnap.ref);
            }
            await batch.commit();
            console.log(`Koleksiyon temizlendi: ${collectionName}`);
        }

      toast({
        title: 'İşlem Başarılı!',
        description: 'Tüm veritabanı verileri kalıcı olarak silindi. Uygulama yeniden başlatılıyor...',
      });
      
      // Reset confirmation and reload the app to reflect changes
      setIsConfirmed(false);
      setTimeout(() => window.location.reload(), 2000);

    } catch (error: any) {
      console.error('Veritabanı sıfırlama hatası:', error);
      toast({
        variant: 'destructive',
        title: 'Sıfırlama Hatası',
        description: `Veriler silinirken bir hata oluştu: ${error.message}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-8">
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
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Veritabanını Sıfırla</h3>
            <p className="text-sm text-muted-foreground">
              Bu işlem, veritabanındaki tüm müşterileri, ürünleri, teklifleri,
              ustaları, iş atamalarını ve diğer tüm verileri kalıcı olarak
              siler. Uygulama, ilk kurulum haline döner.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="confirmation"
              checked={isConfirmed}
              onCheckedChange={(checked) => setIsConfirmed(Boolean(checked))}
              disabled={isDeleting}
            />
            <label
              htmlFor="confirmation"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Tüm verileri kalıcı olarak silmek istediğimi anlıyorum.
            </label>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!isConfirmed || isDeleting}>
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Tüm Verileri Sil ve Veritabanını Sıfırla
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu işlem kesinlikle geri alınamaz. Tüm uygulama verileri
                  kalıcı olarak silinecek. Bu, test verilerini temizlemek ve
                  uygulamaya sıfırdan başlamak için kullanılır.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAllData}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Evet, Tüm Verileri Sil
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

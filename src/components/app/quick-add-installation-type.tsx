'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { InstallationType } from '@/app/installation-types/page';

const installationTypeSchema = z.object({
  name: z.string().min(2, 'Kategori adı en az 2 karakter olmalıdır.'),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof installationTypeSchema>;

interface QuickAddInstallationTypeProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  existingCategory?: InstallationType | null;
  defaultParentId?: string | null;
  allCategories: InstallationType[];
}

export function QuickAddInstallationType({
  isOpen,
  onOpenChange,
  onSuccess,
  existingCategory,
  defaultParentId,
  allCategories,
}: QuickAddInstallationTypeProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<FormValues>({
    resolver: zodResolver(installationTypeSchema),
  });

  useEffect(() => {
    if (isOpen) {
      if (existingCategory) {
        form.reset({
          name: existingCategory.name,
          description: existingCategory.description || '',
          parentId: existingCategory.parentId || null,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          parentId: defaultParentId || null,
        });
      }
    }
  }, [isOpen, existingCategory, defaultParentId, form]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Veritabanı bağlantısı kurulamamış.',
      });
      return;
    }

    try {
        const collectionRef = collection(firestore, 'installation_types');
        const dataToSave = {
            ...values,
            parentId: values.parentId || null
        };

        if (existingCategory) {
            // Update existing document
            const docRef = doc(collectionRef, existingCategory.id);
            setDocumentNonBlocking(docRef, dataToSave, { merge: true });
             toast({
                title: 'Başarılı',
                description: 'Kategori başarıyla güncellendi.',
            });
        } else {
            // Add new document
            addDocumentNonBlocking(collectionRef, dataToSave);
             toast({
                title: 'Başarılı',
                description: 'Yeni kategori başarıyla eklendi.',
            });
        }
        
        onSuccess();
        onOpenChange(false);
    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Hata",
            description: `İşlem başarısız oldu: ${error.message}`,
        });
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const dialogTitle = existingCategory ? 'Kategoriyi Düzenle' : 'Yeni Kategori Ekle';
  const dialogDescription = existingCategory
    ? 'Kategori bilgilerini güncelleyin.'
    : 'Yeni bir tesisat disiplini veya alt kategorisi oluşturun.';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Üst Kategori</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Ana disiplin (üst kategori yok)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">
                        Ana disiplin (üst kategori yok)
                      </SelectItem>
                      {allCategories.filter(c => c.id !== existingCategory?.id).map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn: Sıhhi Tesisat" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Bu kategorinin amacını açıklayın (isteğe bağlı)..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                İptal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {existingCategory ? 'Güncelle' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

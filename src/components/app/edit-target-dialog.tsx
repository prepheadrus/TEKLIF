
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';

interface EditTargetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentTarget?: number;
  onSuccess: () => void;
}

const targetSchema = z.object({
  targetAmount: z.coerce.number().min(0, 'Hedef tutar 0 veya daha büyük olmalıdır.'),
});

type TargetFormValues = z.infer<typeof targetSchema>;

export function EditTargetDialog({
  isOpen,
  onOpenChange,
  currentTarget,
  onSuccess,
}: EditTargetDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TargetFormValues>({
    resolver: zodResolver(targetSchema),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ targetAmount: currentTarget ?? 0 });
    }
  }, [isOpen, currentTarget, form]);

  const onSubmit = async (values: TargetFormValues) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Veritabanı bağlantısı kurulamadı.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const settingsRef = doc(firestore, 'app_settings', 'dashboard');
      await setDocumentNonBlocking(settingsRef, { monthlyTargetAmount: values.targetAmount }, { merge: true });

      toast({
        title: 'Başarılı!',
        description: 'Aylık hedef başarıyla güncellendi.',
      });
      onSuccess();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Hata', description: `Hedef güncellenemedi: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aylık Hedefi Düzenle</DialogTitle>
          <DialogDescription>
            Yönetim panelinde gösterilecek olan aylık ciro hedefinizi güncelleyin.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="targetAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aylık Hedef Tutar (TL)</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" placeholder="100000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">İptal</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Hedefi Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import type { Proposal } from '@/app/quotes/quotes-client-page';
import type { Personnel } from '@/app/personnel/personnel-client-page';

interface AssignJobDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal | null;
  personnelList: Personnel[];
  onSuccess: () => void;
}

const assignJobSchema = z.object({
  personnelId: z.string().min(1, 'Bir personel seçmek zorunludur.'),
  assignedAmount: z.coerce.number().min(0, 'Atanan tutar 0 veya daha büyük olmalıdır.'),
  notes: z.string().optional(),
});

type AssignJobFormValues = z.infer<typeof assignJobSchema>;

export function AssignJobDialog({
  isOpen,
  onOpenChange,
  proposal,
  personnelList,
  onSuccess,
}: AssignJobDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AssignJobFormValues>({
    resolver: zodResolver(assignJobSchema),
    defaultValues: {
      personnelId: '',
      assignedAmount: 0,
      notes: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = async (values: AssignJobFormValues) => {
    if (!firestore || !proposal) {
        toast({ variant: "destructive", title: "Hata", description: "Gerekli bilgiler eksik." });
        return;
    }
    setIsSubmitting(true);
    try {
        const jobAssignmentsRef = collection(firestore, 'job_assignments');
        
        const newAssignment = {
            ...values,
            proposalId: proposal.id,
            paymentStatus: 'Ödenmedi',
            assignedAt: serverTimestamp(),
        };

        await addDocumentNonBlocking(jobAssignmentsRef, newAssignment);
        
        toast({
            title: 'Başarılı!',
            description: `'${proposal.projectName}' projesi atandı.`,
        });
        onSuccess();
    } catch (error: any) {
         toast({ variant: "destructive", title: "Hata", description: `İş ataması yapılamadı: ${error.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Proje İçin Usta Ata</DialogTitle>
          <DialogDescription>
            Onaylanmış olan "{proposal?.projectName}" projesini bir ustaya atayın ve anlaşma tutarını kaydedin.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
              control={form.control}
              name="personnelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Atanacak Usta</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Bir usta seçin..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {personnelList.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.role})
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
              name="assignedAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anlaşma Tutarı (TL)</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" placeholder="15000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notlar (Opsiyonel)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Örn: Malzeme hariç sadece işçilik bedeli." {...field} />
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
                    İşi Ata
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

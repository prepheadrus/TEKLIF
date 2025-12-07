
'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, doc, arrayUnion, updateDoc } from 'firebase/firestore';
import { JobAssignment } from '@/app/assignments/assignments-client-page';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface ManagePaymentsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: JobAssignment | null;
  onSuccess: () => void;
}

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Tutar 0\'dan büyük olmalıdır.'),
  date: z.date({ required_error: 'Ödeme tarihi zorunludur.' }),
  note: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
};

export function ManagePaymentsDialog({
  isOpen,
  onOpenChange,
  assignment,
  onSuccess,
}: ManagePaymentsDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      date: new Date(),
      note: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onPaymentSubmit = async (values: PaymentFormValues) => {
    if (!firestore || !assignment) return;
    setIsSubmitting(true);
    
    try {
      const assignmentRef = doc(firestore, 'job_assignments', assignment.id);
      
      const newPayment = {
          ...values,
          date: values.date, // Already a Date object
      };

      await updateDoc(assignmentRef, {
          paymentHistory: arrayUnion(newPayment)
      });

      toast({
          title: 'Başarılı!',
          description: 'Yeni ödeme kaydı eklendi.',
      });

      // Recalculate status and update if necessary
      const currentTotalPaid = (assignment.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0) + newPayment.amount;
      let newStatus: JobAssignment['paymentStatus'] = 'Kısmi Ödendi';
      if (currentTotalPaid >= assignment.assignedAmount) {
          newStatus = 'Ödendi';
      } else if (currentTotalPaid === 0) {
          newStatus = 'Ödenmedi';
      }
      
      await updateDoc(assignmentRef, { paymentStatus: newStatus });
      
      form.reset({ amount: 0, date: new Date(), note: '' });
      onSuccess();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Hata', description: `Ödeme eklenemedi: ${error.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentIndex: number) => {
    if (!firestore || !assignment || !assignment.paymentHistory) return;

    const paymentToDelete = assignment.paymentHistory[paymentIndex];
    if (!paymentToDelete) return;

    try {
      const assignmentRef = doc(firestore, 'job_assignments', assignment.id);
      
      const updatedHistory = [...(assignment.paymentHistory || [])];
      updatedHistory.splice(paymentIndex, 1);
      
      await updateDoc(assignmentRef, {
        paymentHistory: updatedHistory,
      });

      toast({
        title: 'Başarılı',
        description: 'Ödeme kaydı silindi.',
      });
      onSuccess();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Hata', description: `Ödeme silinemedi: ${error.message}` });
    }
  };

  const totalPaid = useMemo(() => {
    return (assignment?.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
  }, [assignment]);
  
  const remainingBalance = useMemo(() => {
    return (assignment?.assignedAmount || 0) - totalPaid;
  }, [assignment, totalPaid]);

  if (!assignment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Ödeme Yönetimi: {assignment.personnelName}</DialogTitle>
          <DialogDescription>
            Proje: "{assignment.projectName}" için yapılan ödemeleri yönetin.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 my-4">
            <Card className="bg-slate-50 dark:bg-slate-800"><CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Toplam Hakediş</div>
                <div className="text-2xl font-bold">{formatCurrency(assignment.assignedAmount)}</div>
            </CardContent></Card>
             <Card className="bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-800"><CardContent className="pt-6">
                <div className="text-sm font-medium text-green-700 dark:text-green-300">Toplam Ödenen</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</div>
            </CardContent></Card>
             <Card className="bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800"><CardContent className="pt-6">
                <div className="text-sm font-medium text-red-700 dark:text-red-300">Kalan Bakiye</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(remainingBalance)}</div>
            </CardContent></Card>
        </div>

        <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
                <h4 className="font-semibold mb-2">Ödeme Geçmişi</h4>
                <ScrollArea className="h-64 border rounded-md">
                   <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Not</TableHead>
                                <TableHead className="text-right">Tutar</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(assignment.paymentHistory || []).length > 0 ? (
                                assignment.paymentHistory?.map((p, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{format(p.date.seconds * 1000, 'dd MMMM yyyy', { locale: tr })}</TableCell>
                                        <TableCell className="text-muted-foreground">{p.note}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(p.amount)}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeletePayment(index)}>
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        Bu iş için henüz ödeme kaydedilmemiş.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                   </Table>
                </ScrollArea>
            </div>
            <div>
                 <h4 className="font-semibold mb-2">Yeni Ödeme Ekle</h4>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onPaymentSubmit)} className="space-y-4 rounded-md border p-4">
                        <FormField control={form.control} name="amount" render={({ field }) => (
                            <FormItem><FormLabel>Ödeme Tutarı (TL)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="date" render={({ field }) => (
                             <FormItem className="flex flex-col">
                                <FormLabel>Ödeme Tarihi</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                            >
                                                {field.value ? format(field.value, "PPP", { locale: tr }) : <span>Tarih seç</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                            initialFocus
                                            locale={tr}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="note" render={({ field }) => (
                            <FormItem><FormLabel>Not (Opsiyonel)</FormLabel><FormControl><Input placeholder="İş avansı" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            Ödemeyi Kaydet
                        </Button>
                    </form>
                 </Form>
            </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Kapat</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
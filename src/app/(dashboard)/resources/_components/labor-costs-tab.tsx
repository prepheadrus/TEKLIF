
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

const laborCostSchema = z.object({
  role: z.string().min(2, { message: "Rol en az 2 karakter olmalıdır." }),
  hourlyRate: z.coerce.number().min(0, { message: "Saatlik ücret pozitif olmalıdır." }),
});

type LaborCostFormValues = z.infer<typeof laborCostSchema>;
type LaborCost = LaborCostFormValues & { id: string; };

export function LaborCostsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<LaborCostFormValues>({
    resolver: zodResolver(laborCostSchema),
    defaultValues: {
      role: "",
      hourlyRate: 0,
    },
  });

  const laborCostsQuery = useMemoFirebase(() => 
    firestore ? collection(firestore, 'labor_costs') : null, 
    [firestore]
  );
  const { data: laborCosts, isLoading } = useCollection<LaborCost>(laborCostsQuery);

  const onSubmit = (values: LaborCostFormValues) => {
    if (!firestore) return;
    const laborCostsCollectionRef = collection(firestore, 'labor_costs');
    addDocumentNonBlocking(laborCostsCollectionRef, values);
    toast({
      title: "Başarılı",
      description: "Yeni işçilik maliyeti eklendi.",
    });
    form.reset();
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const laborCostDocRef = doc(firestore, 'labor_costs', id);
    deleteDocumentNonBlocking(laborCostDocRef);
    toast({
      title: "Başarılı",
      description: "İşçilik maliyeti silindi.",
    });
  };
  
  const formatCurrency = (price: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(price);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
              <CardTitle>İşçilik Maliyetleri</CardTitle>
              <CardDescription>Reçetelerde kullanılacak saatlik işçilik ücretleri.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2" />
                  Yeni İşçilik Ekle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <DialogHeader><DialogTitle>Yeni İşçilik Maliyeti</DialogTitle></DialogHeader>
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rol</FormLabel>
                          <FormControl><Input placeholder="Usta, Kalfa, vb." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hourlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Saatlik Ücret (TL)</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                      <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Kaydet
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rol</TableHead>
              <TableHead>Saatlik Ücret</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : laborCosts && laborCosts.length > 0 ? (
              laborCosts.map((cost) => (
                <TableRow key={cost.id}>
                  <TableCell className="font-medium">{cost.role}</TableCell>
                  <TableCell>{formatCurrency(cost.hourlyRate)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cost.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={3} className="text-center">Henüz işçilik maliyeti eklenmemiş.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

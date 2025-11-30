
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
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useUser, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';

// Zod schema for form validation
const installationTypeSchema = z.object({
  name: z.string().min(3, { message: "Tesisat türü adı en az 3 karakter olmalıdır." }),
  description: z.string().optional(),
});

type InstallationTypeFormValues = z.infer<typeof installationTypeSchema>;
type InstallationType = InstallationTypeFormValues & { id: string };

export default function InstallationTypesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const form = useForm<InstallationTypeFormValues>({
    resolver: zodResolver(installationTypeSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const installationTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'installation_types');
  }, [firestore]);

  const { data: installationTypes, isLoading: areInstallationTypesLoading } = useCollection<InstallationType>(installationTypesQuery);

  const onSubmit = (values: InstallationTypeFormValues) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Veritabanı bağlantısı kurulamamış.",
      });
      return;
    }
    const installationTypesCollectionRef = collection(firestore, 'installation_types');
    addDocumentNonBlocking(installationTypesCollectionRef, values);
    
    toast({
      title: "Başarılı",
      description: "Yeni tesisat türü başarıyla eklendi.",
    });
    form.reset();
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const typeDocRef = doc(firestore, 'installation_types', id);
    deleteDocumentNonBlocking(typeDocRef);
    toast({
      title: "Başarılı",
      description: "Tesisat türü silindi.",
    });
  };

  const isLoading = isUserLoading || areInstallationTypesLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tesisat Türleri</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2" />
              Yeni Tesisat Türü Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Yeni Tesisat Türü Ekle</DialogTitle>
                  <DialogDescription>
                    Ürünleri ve hizmetleri sınıflandırmak için yeni bir kategori oluşturun.
                  </DialogDescription>
                </DialogHeader>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tesisat Türü Adı</FormLabel>
                      <FormControl>
                        <Input placeholder="Örn: Isıtma Tesisatı" {...field} />
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
                      <FormLabel>Açıklama (Opsiyonel)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Bu kategori hakkında kısa bir açıklama." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">İptal</Button>
                  </DialogClose>
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
      <Card>
        <CardHeader>
          <CardTitle>Mevcut Tesisat Türleri</CardTitle>
          <CardDescription>Mekanik tesisat disiplinlerinizi buradan yönetebilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tesisat Türü</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : installationTypes && installationTypes.length > 0 ? (
                installationTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>{type.description || '-'}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => handleDelete(type.id)}>
                          <Trash2 className="h-4 w-4" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    Henüz bir tesisat türü eklenmemiş.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

    
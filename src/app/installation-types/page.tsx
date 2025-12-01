'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function InstallationTypesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tesisat Kategorileri</h1>
        <p className="text-muted-foreground">Ürün ve hizmetlerinizi sınıflandırdığınız mekanik disiplinleri yönetin.</p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Kategori Listesi</CardTitle>
            <CardDescription>Tüm kategorileriniz burada listelenecektir.</CardDescription>
        </CardHeader>
        <CardContent>
            <p>Tesisat kategorisi yönetimi özellikleri yakında eklenecektir.</p>
        </CardContent>
       </Card>
    </div>
  );
}

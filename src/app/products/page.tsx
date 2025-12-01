'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ürünler</h1>
        <p className="text-muted-foreground">Ürün ve hizmetlerinizi yönetin.</p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Ürün Listesi</CardTitle>
            <CardDescription>Tüm ürünleriniz burada listelenecektir.</CardDescription>
        </CardHeader>
        <CardContent>
            <p>Ürün yönetimi özellikleri yakında eklenecektir.</p>
        </CardContent>
       </Card>
    </div>
  );
}

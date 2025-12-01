'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Müşteriler</h1>
        <p className="text-muted-foreground">Müşteri listesini yönetin.</p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Müşteri Listesi</CardTitle>
            <CardDescription>Tüm müşterileriniz burada listelenecektir.</CardDescription>
        </CardHeader>
        <CardContent>
            <p>Müşteri yönetimi özellikleri yakında eklenecektir.</p>
        </CardContent>
       </Card>
    </div>
  );
}

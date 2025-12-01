'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function ResourcesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kaynaklar</h1>
        <p className="text-muted-foreground">Malzeme ve işçilik kaynaklarınızı yönetin.</p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Kaynak Listesi</CardTitle>
            <CardDescription>Tüm kaynaklarınız burada listelenecektir.</CardDescription>
        </CardHeader>
        <CardContent>
            <p>Kaynak yönetimi özellikleri yakında eklenecektir.</p>
        </CardContent>
       </Card>
    </div>
  );
}

'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: 'Reçeteler',
};


export function RecipesPageContent() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reçeteler</h1>
        <p className="text-muted-foreground">Ürün maliyet reçetelerinizi yönetin.</p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Reçete Listesi</CardTitle>
            <CardDescription>Tüm reçeteleriniz burada listelenecektir.</CardDescription>
        </CardHeader>
        <CardContent>
            <p>Reçete yönetimi özellikleri yakında eklenecektir.</p>
        </CardContent>
       </Card>
    </div>
  );
}

export default function RecipesPage() {
    return <RecipesPageContent />;
}

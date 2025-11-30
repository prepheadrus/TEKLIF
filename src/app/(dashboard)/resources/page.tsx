
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialsTab } from "./_components/materials-tab";
import { LaborCostsTab } from "./_components/labor-costs-tab";
import { SuppliersTab } from "./_components/suppliers-tab";

export default function ResourcesPage() {
  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Kaynak Yönetimi</h1>
      </div>
      <Tabs defaultValue="materials">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="materials">Malzemeler</TabsTrigger>
          <TabsTrigger value="labor_costs">İşçilik Maliyetleri</TabsTrigger>
          <TabsTrigger value="suppliers">Tedarikçiler</TabsTrigger>
        </TabsList>
        <TabsContent value="materials">
          <MaterialsTab />
        </TabsContent>
        <TabsContent value="labor_costs">
          <LaborCostsTab />
        </TabsContent>
        <TabsContent value="suppliers">
           <SuppliersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

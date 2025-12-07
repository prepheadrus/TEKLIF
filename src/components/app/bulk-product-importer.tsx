
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as XLSX from 'xlsx';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUp, TableProperties, CheckCircle, ArrowRight, Loader2, Info } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { Supplier, Product } from '@/app/products/products-client-page';

type Step = 'upload' | 'map' | 'review' | 'importing' | 'done';

const productFields: { key: keyof Omit<Product, 'id'>; label: string, required: boolean }[] = [
    { key: 'name', label: 'Ürün Adı', required: true },
    { key: 'brand', label: 'Marka', required: true },
    { key: 'code', label: 'Ürün Kodu', required: true },
    { key: 'model', label: 'Model', required: false },
    { key: 'unit', label: 'Birim', required: true },
    { key: 'basePrice', label: 'Birim Alış Fiyatı', required: true },
    { key: 'listPrice', label: 'Birim Satış Fiyatı', required: true },
    { key: 'currency', label: 'Para Birimi (TRY, USD, EUR)', required: true },
    { key: 'supplierName', label: 'Tedarikçi Adı', required: false },
];


export function BulkProductImporter({ isOpen, onOpenChange, onSuccess }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void; }) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  const suppliersQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'suppliers')) : null), [firestore]);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);

  const form = useForm();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if(jsonData.length < 2) {
              toast({variant: 'destructive', title: 'Dosya Hatası', description: 'Excel dosyası başlık satırı ve en az bir veri satırı içermelidir.'})
              return;
          }
          
          const fileHeaders = jsonData[0];
          const fileData = jsonData.slice(1).map(row => {
              let rowData: any = {};
              fileHeaders.forEach((header: string, index: number) => {
                  rowData[header] = row[index];
              });
              return rowData;
          });
          
          setHeaders(fileHeaders);
          setParsedData(fileData);
          setStep('map');

        } catch (error) {
          toast({ variant: 'destructive', title: 'Dosya Okuma Hatası', description: 'Dosya okunurken bir hata oluştu. Lütfen geçerli bir Excel dosyası (.xlsx, .xls, .csv) seçin.' });
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!firestore) return;
    setStep('importing');
    
    try {
        const batch = writeBatch(firestore);
        const productsCollection = collection(firestore, 'products');
        const suppliersCollection = collection(firestore, 'suppliers');
        
        const columnMapping = form.getValues();
        const requiredFieldsMet = productFields.filter(f => f.required).every(f => !!columnMapping[f.key]);

        if(!requiredFieldsMet) {
            toast({variant: 'destructive', title: 'Eksik Eşleştirme', description: 'Lütfen tüm zorunlu alanları eşleştirin.'});
            setStep('map');
            return;
        }

        const supplierNameToIdMap = new Map(suppliers?.map(s => [s.name.toLowerCase(), s.id]));

        for (const row of parsedData) {
            const productDocRef = doc(productsCollection);
            const newProduct: any = {};

            for (const field of productFields) {
                const excelHeader = columnMapping[field.key];
                if (excelHeader && row[excelHeader] !== undefined) {
                    let value = row[excelHeader];
                    if (['basePrice', 'listPrice'].includes(field.key)) {
                        value = parseFloat(value) || 0;
                    }
                    if (field.key === 'supplierName') {
                      const supplierName = value.toString().toLowerCase();
                      if (supplierNameToIdMap.has(supplierName)) {
                          newProduct['supplierId'] = supplierNameToIdMap.get(supplierName);
                      } else {
                          const newSupplierRef = doc(suppliersCollection);
                          batch.set(newSupplierRef, { name: value.toString() });
                          supplierNameToIdMap.set(supplierName, newSupplierRef.id);
                          newProduct['supplierId'] = newSupplierRef.id;
                      }
                    } else {
                      newProduct[field.key] = value;
                    }
                } else if(field.required) {
                    throw new Error(`'${field.label}' alanı için veri bulunamadı. Lütfen eşleştirmeyi kontrol edin veya dosyanıza sütun ekleyin.`);
                }
            }
            
            // Set defaults for non-mapped optional fields
            newProduct.discountRate = newProduct.discountRate || 0;
            newProduct.category = newProduct.category || 'Genel';


            batch.set(productDocRef, newProduct);
        }

        await batch.commit();
        setStep('done');

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'İçeri Aktarma Hatası', description: error.message });
        setStep('review'); // Go back to review step on error
    }
  };

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    form.reset();
    setStep('upload');
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  }
  
  const handleSuccessAndClose = () => {
    onSuccess();
    handleClose();
  }

  const mappedData = useMemo(() => {
    if (step !== 'review') return [];
    const columnMapping = form.getValues();

    return parsedData.map(row => {
        const newRow: any = {};
        for (const field of productFields) {
            const excelHeader = columnMapping[field.key];
            newRow[field.key] = excelHeader ? row[excelHeader] : (field.required ? 'EKSİK BİLGİ' : '-');
        }
        return newRow;
    });
  }, [step, parsedData, form.watch()]);

  const renderContent = () => {
    switch (step) {
      case 'upload':
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 border-2 border-dashed rounded-lg">
            <FileUp className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Excel Dosyanızı Buraya Sürükleyin</h3>
            <p className="text-muted-foreground mb-4">veya</p>
            <input type="file" id="file-upload" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
            <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                Dosya Seç
            </label>
            <Alert variant="default" className="mt-8">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Dosyanızın ilk satırı başlıkları içermelidir: Ürün Adı, Marka, Birim Fiyat gibi.
              </AlertDescription>
            </Alert>
          </div>
        );
      case 'map':
        return (
          <div>
            <h3 className="text-lg font-medium mb-4">Sütunları Eşleştir</h3>
            <p className="text-muted-foreground mb-6">Excel dosyanızdaki sütun başlıklarını sistemdeki ürün alanlarıyla eşleştirin. <span className="text-destructive">*</span> ile işaretli alanlar zorunludur.</p>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4">
              {productFields.map(field => (
                <div key={field.key} className="grid grid-cols-2 items-center gap-4">
                  <label className="font-medium">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </label>
                  <Select onValueChange={(value) => form.setValue(field.key, value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Bir sütun seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        );
    case 'review':
        return (
            <div>
                <h3 className="text-lg font-medium mb-4">Verileri Gözden Geçir</h3>
                <p className="text-muted-foreground mb-6">Aşağıda içeri aktarılacak verilerin bir önizlemesi bulunmaktadır. Her şey doğru görünüyorsa "İçeri Aktar" butonuna tıklayın.</p>
                <ScrollArea className="h-[50vh] border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary">
                            <TableRow>
                                {productFields.map(field => <TableHead key={field.key}>{field.label}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mappedData.map((row, index) => (
                                <TableRow key={index}>
                                    {productFields.map(field => <TableCell key={field.key} className={row[field.key] === 'EKSİK BİLGİ' ? 'text-destructive font-bold' : ''}>{row[field.key]}</TableCell>)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        )
    case 'importing':
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
                <h3 className="text-2xl font-bold mb-2">Ürünler İçeri Aktarılıyor...</h3>
                <p className="text-muted-foreground">Bu işlem birkaç saniye sürebilir. Lütfen bekleyin.</p>
            </div>
        )
    case 'done':
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-6" />
                <h3 className="text-2xl font-bold mb-2">İçeri Aktarma Başarılı!</h3>
                <p className="text-muted-foreground">{parsedData.length} ürün başarıyla veritabanına eklendi.</p>
            </div>
        )
      default:
        return null;
    }
  };

  const renderFooter = () => {
      switch (step) {
        case 'map':
            return (
                <DialogFooter>
                    <Button variant="outline" onClick={resetState}>İptal</Button>
                    <Button onClick={() => setStep('review')}>Gözden Geçir <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </DialogFooter>
            )
        case 'review':
             return (
                <DialogFooter>
                    <Button variant="outline" onClick={() => setStep('map')}>Geri Dön</Button>
                    <Button onClick={handleImport}>İçeri Aktar</Button>
                </DialogFooter>
            )
        case 'done':
            return (
                <DialogFooter>
                    <Button onClick={handleSuccessAndClose}>Kapat</Button>
                </DialogFooter>
            )
        case 'upload':
        default:
            return (
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Kapat</Button></DialogClose>
                </DialogFooter>
            )
      }
  }
  
  const getDialogTitle = () => {
    switch (step) {
        case 'upload': return 'Toplu Ürün Yükle (Adım 1/3)';
        case 'map': return 'Sütunları Eşleştir (Adım 2/3)';
        case 'review': return 'Verileri Kontrol Et (Adım 3/3)';
        case 'importing': return 'İşleniyor...';
        case 'done': return 'İşlem Tamamlandı';
        default: return 'Toplu Ürün Yükle';
    }
  }


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'upload' && <FileUp className="h-6 w-6" />}
            {step === 'map' && <TableProperties className="h-6 w-6" />}
            {step === 'review' && <CheckCircle className="h-6 w-6" />}
            {getDialogTitle()}
          </DialogTitle>
           {step !== 'importing' && step !== 'done' && <DialogDescription>Excel dosyanızdaki ürünleri sisteme hızlıca aktarın.</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-auto -mx-6 px-6">
            {renderContent()}
        </div>
        {!['importing', 'done'].includes(step) && renderFooter()}
         {['importing', 'done'].includes(step) && <div className="pt-6 border-t">{renderFooter()}</div>}
      </DialogContent>
    </Dialog>
  );
}

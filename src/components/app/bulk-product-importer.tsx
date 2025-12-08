
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, TableProperties, CheckCircle, ArrowRight, Loader2, Info, Download } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { Supplier, Product } from '@/app/products/products-client-page';
import type { InstallationType } from '@/app/installation-types/installation-types-client-page';

type Step = 'upload' | 'map' | 'review' | 'importing' | 'done';

const productFields: { key: keyof Omit<Product, 'id' | 'installationTypeId' | 'basePrice'> | 'supplierName' | 'installationCategoryName'; label: string, required: boolean, description?: string }[] = [
    { key: 'code', label: 'Ürün Kodu', required: true, description: "Her ürün için benzersiz bir kod (SKU)." },
    { key: 'name', label: 'Ürün Adı', required: true, description: "Ürünün tam ve açıklayıcı adı." },
    { key: 'brand', label: 'Marka', required: true, description: "Ürünün markası." },
    { key: 'model', label: 'Model', required: false, description: "Ürünün spesifik model numarası veya adı (isteğe bağlı)." },
    { key: 'unit', label: 'Birim', required: true, description: "Örn: Adet, Metre, Kg, Set." },
    { key: 'listPrice', label: 'Liste Fiyatı (Tedarikçi)', required: false, description: "Tedarikçinin KDV hariç liste fiyatı. Maliyet hesaplaması için kullanılır." },
    { key: 'discountRate', label: 'İskonto Oranı (%)', required: false, description: "Liste fiyatına uygulanacak tedarikçi iskontosu. Örn: 15." },
    { key: 'currency', label: 'Para Birimi', required: true, description: "Geçerli değerler: TRY, USD, EUR." },
    { key: 'vatRate', label: 'KDV Oranı (%)', required: true, description: "Ürünün KDV oranı. Örn: 20, 10, 1, 0." },
    { key: 'priceIncludesVat', label: 'Fiyatlara KDV Dahil mi?', required: false, description: "Girilen fiyatların KDV içerip içermediği. EVET veya HAYIR yazın." },
    { key: 'supplierName', label: 'Tedarikçi Adı', required: false, description: "Bu ürünün tedarikçisinin adı. Sistemde yoksa yeni tedarikçi oluşturulur (isteğe bağlı)." },
    { key: 'category', label: 'Genel Kategori', required: false, description: "Ürünün genel kategorisi. Örn: Kazan, Pompa (isteğe bağlı)." },
    { key: 'installationCategoryName', label: 'Tesisat Kategorisi Adı', required: false, description: "Ürünün ait olduğu detaylı tesisat kategorisinin tam adı (isteğe bağlı)." }
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
  const installationTypesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'installation_types')) : null), [firestore]);
  const { data: installationTypes } = useCollection<InstallationType>(installationTypesQuery);


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
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
          
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
  
  const handleDownloadTemplate = () => {
    const headers = productFields.map(f => f.label);
    const exampleRow = productFields.map(f => {
        if(f.key === 'code') return 'PRD-001';
        if(f.key === 'name') return 'Örnek Kazan';
        if(f.key === 'brand') return 'Örnek Marka';
        if(f.key === 'unit') return 'Adet';
        if(f.key === 'listPrice') return 1000;
        if(f.key === 'discountRate') return 15;
        if(f.key === 'currency') return 'TRY';
        if(f.key === 'vatRate') return 20;
        if(f.key === 'priceIncludesVat') return 'HAYIR';
        if(f.key === 'supplierName') return 'Örnek Tedarikçi A.Ş.';
        if(f.key === 'installationCategoryName') return 'Isıtma > Kazanlar';
        return '';
    });
    
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ürün Listesi");
    XLSX.writeFile(wb, "Urun_Yukleme_Sablonu.xlsx");
  }

  const handleImport = async () => {
    if (!firestore) return;
    setStep('importing');
    
    try {
        const batch = writeBatch(firestore);
        const productsCollection = collection(firestore, 'products');
        const suppliersCollection = collection(firestore, 'suppliers');
        const installationTypesCollection = collection(firestore, 'installation_types');
        
        const columnMapping = form.getValues();
        const requiredFieldsMet = productFields.filter(f => f.required).every(f => !!columnMapping[f.key]);

        if(!requiredFieldsMet) {
            toast({variant: 'destructive', title: 'Eksik Eşleştirme', description: 'Lütfen tüm zorunlu alanları eşleştirin.'});
            setStep('map');
            return;
        }

        const supplierNameToIdMap = new Map(suppliers?.map(s => [s.name.toLowerCase(), s.id]));
        
        const categoryPathToIdMap = new Map<string, string>();
        
        if (installationTypes) {
            const buildPath = (catId: string, allCats: InstallationType[]): string => {
                const cat = allCats.find(c => c.id === catId);
                if (!cat) return '';
                if (!cat.parentId) return cat.name.toLowerCase().trim();
                const parentPath = buildPath(cat.parentId, allCats);
                return `${parentPath} > ${cat.name.toLowerCase().trim()}`;
            };
            installationTypes.forEach(cat => {
                const path = buildPath(cat.id, installationTypes);
                if (path) categoryPathToIdMap.set(path, cat.id);
            });
        }
        

        for (const row of parsedData) {
            const productDocRef = doc(productsCollection);
            const newProduct: any = {};

            // Map standard fields
            for (const field of productFields) {
                const excelHeader = columnMapping[field.key];
                let value = excelHeader ? row[excelHeader] : undefined;

                if (value !== undefined && value !== null && value !== '') {
                    if (['listPrice'].includes(field.key)) {
                        value = parseFloat(String(value).replace(',', '.')) || 0;
                    }

                    if (['discountRate', 'vatRate'].includes(field.key)) {
                        const rate = parseFloat(String(value).replace(',', '.'));
                        value = isNaN(rate) ? 0 : rate / 100;
                    }

                    if (field.key === 'priceIncludesVat') {
                        const strValue = String(value).toLowerCase().trim();
                        value = ['evet', 'true', '1', 'yes'].includes(strValue);
                    }

                    if (field.key === 'supplierName') {
                      const supplierName = String(value).toLowerCase().trim();
                      if (supplierNameToIdMap.has(supplierName)) {
                          newProduct['supplierId'] = supplierNameToIdMap.get(supplierName);
                      } else {
                          const newSupplierRef = doc(suppliersCollection);
                          batch.set(newSupplierRef, { name: String(value).trim() });
                          supplierNameToIdMap.set(supplierName, newSupplierRef.id);
                          newProduct['supplierId'] = newSupplierRef.id;
                      }
                    } else if (field.key === 'installationCategoryName') {
                        const categoryHierarchy = String(value).split('>').map(s => s.trim());
                        let parentId: string | null = null;
                        let currentPath = '';

                        for (const categoryName of categoryHierarchy) {
                            if (!categoryName) continue;
                            const lowerCatName = categoryName.toLowerCase();
                            currentPath = parentId ? `${currentPath} > ${lowerCatName}` : lowerCatName;

                            if (categoryPathToIdMap.has(currentPath)) {
                                parentId = categoryPathToIdMap.get(currentPath)!;
                            } else {
                                const newCategoryRef = doc(installationTypesCollection);
                                batch.set(newCategoryRef, { name: categoryName, parentId: parentId });
                                categoryPathToIdMap.set(currentPath, newCategoryRef.id);
                                parentId = newCategoryRef.id;
                            }
                        }
                        newProduct['installationTypeId'] = parentId;
                    } else {
                      newProduct[field.key] = value;
                    }
                } else if(field.required) {
                    throw new Error(`'${field.label}' alanı için veri bulunamadı. Lütfen eşleştirmeyi kontrol edin veya dosyanıza sütun ekleyin.`);
                }
            }
            
            // Set defaults and calculate basePrice
            newProduct.listPrice = newProduct.listPrice ?? 0;
            newProduct.discountRate = newProduct.discountRate ?? 0;
            newProduct.vatRate = newProduct.vatRate ?? 0.20;
            newProduct.priceIncludesVat = newProduct.priceIncludesVat ?? false;
            newProduct.category = newProduct.category || 'Genel';
            newProduct.model = newProduct.model || '';

            // Calculate basePrice (cost) from list price and discount
            const netListPrice = newProduct.priceIncludesVat
              ? newProduct.listPrice / (1 + newProduct.vatRate)
              : newProduct.listPrice;
            newProduct.basePrice = netListPrice * (1 - newProduct.discountRate);

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
            <div className='flex gap-2'>
              <input type="file" id="file-upload" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
              <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                  Dosya Seç
              </label>
              <Button variant="secondary" onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Örnek Şablonu İndir
              </Button>
            </div>
            <Alert variant="default" className="mt-8 text-left">
              <Info className="h-4 w-4" />
              <AlertTitle>Nasıl Çalışır?</AlertTitle>
              <AlertDescription>
                <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li><b>Örnek Şablonu İndirin:</b> Doğru formatı kullanmak için şablonu indirin.</li>
                    <li><b>Verilerinizi Girin:</b> Ürün bilgilerinizi şablondaki ilgili sütunlara doldurun.</li>
                    <li><b>Dosyayı Yükleyin:</b> Hazırladığınız dosyayı seçin veya sürükleyip bırakın.</li>
                    <li><b>Eşleştirin ve Kontrol Edin:</b> Sonraki adımlarda sütunları doğrulayın ve verileri gözden geçirin.</li>
                </ol>
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
                                    {productFields.map(field => <TableCell key={field.key} className={row[field.key] === 'EKSİK BİLGİ' ? 'text-destructive font-bold' : ''}>{String(row[field.key])}</TableCell>)}
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
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            {step === 'upload' && <FileUp className="h-6 w-6" />}
            {step === 'map' && <TableProperties className="h-6 w-6" />}
            {step === 'review' && <CheckCircle className="h-6 w-6" />}
            {getDialogTitle()}
          </DialogTitle>
           {step !== 'importing' && step !== 'done' && <DialogDescription>Excel dosyanızdaki ürünleri sisteme hızlıca aktarın.</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-auto -mx-6 px-6 border-y">
            {renderContent()}
        </div>
        {!['importing', 'done'].includes(step) && <div className="p-6 pt-4">{renderFooter()}</div>}
         {['importing', 'done'].includes(step) && <div className="p-6 pt-4">{renderFooter()}</div>}
      </DialogContent>
    </Dialog>
  );
}


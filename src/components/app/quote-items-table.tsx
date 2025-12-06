
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface QuoteItem {
  id: string;
  sira: number;
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  toplam: number;
}

interface QuoteTotals {
  araToplam: number;
  iskontoOrani?: number;
  iskontoTutari?: number;
  kdvOrani: number;
  kdvTutari: number;
  genelToplam: number;
}

interface QuoteItemsTableProps {
  items: QuoteItem[];
  totals: QuoteTotals;
  currency?: string;
  className?: string;
}

export function QuoteItemsTable({ 
  items, 
  totals, 
  currency = '₺',
  className 
}: QuoteItemsTableProps) {
  const formatCurrency = (value: number) => {
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Teklif Kalemleri Tablosu */}
      <Table>
        <TableHeader className="bg-muted/50 print:bg-gray-100">
          <TableRow>
            <TableHead className="w-[50px] print:w-[40px]">Sıra</TableHead>
            <TableHead className="min-w-[200px]">Açıklama</TableHead>
            <TableHead className="w-[80px] text-right">Miktar</TableHead>
            <TableHead className="w-[80px]">Birim</TableHead>
            <TableHead className="w-[120px] text-right">Birim Fiyat</TableHead>
            <TableHead className="w-[120px] text-right">Toplam</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow 
              key={item.id} 
              className="print-avoid-break"
            >
              <TableCell className="font-medium">{item.sira}</TableCell>
              <TableCell className="break-words max-w-[300px]">
                {item.aciklama}
              </TableCell>
              <TableCell className="text-right">{item.miktar}</TableCell>
              <TableCell>{item.birim}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(item.birimFiyat)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(item.toplam)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Toplamlar Bölümü - Sayfanın ortasında kesilmemeli */}
      <div className="flex justify-end print-avoid-break">
        <div className="w-[300px] space-y-2 border-t-2 pt-4">
          {/* Ara Toplam */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ara Toplam:</span>
            <span>{formatCurrency(totals.araToplam)}</span>
          </div>
          
          {/* İskonto (varsa) */}
          {totals.iskontoOrani && totals.iskontoOrani > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                İskonto (%{totals.iskontoOrani}):
              </span>
              <span className="text-red-600">
                -{formatCurrency(totals.iskontoTutari || 0)}
              </span>
            </div>
          )}
          
          {/* KDV */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              KDV (%{totals.kdvOrani}):
            </span>
            <span>{formatCurrency(totals.kdvTutari)}</span>
          </div>
          
          {/* Genel Toplam */}
          <div className="flex justify-between pt-2 border-t-2 border-primary print:border-black">
            <span className="text-lg font-bold">Genel Toplam:</span>
            <span className="text-lg font-bold text-primary print:text-black">
              {formatCurrency(totals.genelToplam)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuoteItemsTable;

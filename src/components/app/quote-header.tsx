
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface QuoteHeaderProps {
  firmaLogo?: string;
  firmaAdi: string;
  firmaAltBaslik?: string;
  firmaAdres: string;
  firmaEmail: string;
  firmaTelefon: string;
  teklifNo: string;
  tarih: string;
  className?: string;
}

export function QuoteHeader({
  firmaLogo,
  firmaAdi,
  firmaAltBaslik,
  firmaAdres,
  firmaEmail,
  firmaTelefon,
  teklifNo,
  tarih,
  className
}: QuoteHeaderProps) {
  return (
    <div className={cn("flex justify-between items-start", className)}>
      {/* Sol: Firma Bilgileri */}
      <div className="flex-1">
        {firmaLogo && (
          <Image 
            src={firmaLogo} 
            alt={firmaAdi} 
            width={120} 
            height={60}
            className="mb-2 print:mb-2"
          />
        )}
        <h1 className="text-2xl font-bold text-primary print:text-black">
          {firmaAdi}
        </h1>
        {firmaAltBaslik && (
          <p className="text-sm text-muted-foreground print:text-gray-600">
            {firmaAltBaslik}
          </p>
        )}
        <p className="text-sm mt-1 print:text-xs">{firmaAdres}</p>
        <p className="text-sm print:text-xs">
          {firmaEmail} | {firmaTelefon}
        </p>
      </div>

      {/* Sağ: Teklif Bilgileri */}
      <div className="text-right">
        <h2 className="text-3xl font-bold tracking-tight print:text-2xl">
          TEKLİF
        </h2>
        <div className="mt-2 text-sm space-y-1">
          <p><span className="font-medium">Teklif No:</span> {teklifNo}</p>
          <p><span className="font-medium">Tarih:</span> {tarih}</p>
        </div>
      </div>
    </div>
  );
}

export default QuoteHeader;

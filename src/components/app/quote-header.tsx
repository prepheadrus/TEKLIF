
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
    <div className={cn("flex justify-between items-start pb-3 border-b border-gray-300 mb-4", className)}>
      {/* Sol: Logo + Firma (kompakt) */}
      <div className="flex items-start gap-3">
        {firmaLogo && (
            <Image 
              src={firmaLogo} 
              alt="Logo" 
              width={48}
              height={48}
              className="h-12 w-auto" // Küçük logo: 48px
            />
        )}
        <div className="text-xs leading-tight">
          <p className="font-bold text-sm">{firmaAdi}</p>
          {firmaAltBaslik && <p className="text-gray-600">{firmaAltBaslik}</p>}
          <p className="text-gray-500 mt-1">{firmaAdres}</p>
          <p className="text-gray-500">{firmaEmail} | {firmaTelefon}</p>
        </div>
      </div>

      {/* Sağ: Teklif bilgisi */}
      <div className="text-right flex-shrink-0 ml-4">
        <p className="text-2xl font-bold">TEKLİF</p>
        <p className="text-sm mt-1">
          <span className="font-medium">Teklif No:</span> {teklifNo}
        </p>
        <p className="text-sm">
          <span className="font-medium">Tarih:</span> {tarih}
        </p>
      </div>
    </div>
  );
}

export default QuoteHeader;

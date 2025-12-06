import { cn } from '@/lib/utils';
import Image from 'next/image';

interface QuoteFooterProps {
  firmaTelefon?: string;
  firmaEmail?: string;
  firmaKase?: string; // Kaşe/mühür görseli
  notlar?: string;
  kosullar?: string[];
  className?: string;
}

export function QuoteFooter({
  firmaTelefon,
  firmaEmail,
  firmaKase,
  notlar,
  kosullar,
  className
}: QuoteFooterProps) {
  return (
    <div className={cn("space-y-4 text-sm", className)}>
      {/* Notlar */}
      {notlar && (
        <div className="print-avoid-break">
          <h3 className="font-semibold mb-1">Notlar:</h3>
          <p className="text-muted-foreground print:text-gray-600">
            {notlar}
          </p>
        </div>
      )}

      {/* Koşullar */}
      {kosullar && kosullar.length > 0 && (
        <div className="print-avoid-break">
          <h3 className="font-semibold mb-1">Genel Koşullar:</h3>
          <ul className="list-disc list-inside text-muted-foreground print:text-gray-600 space-y-0.5">
            {kosullar.map((kosul, index) => (
              <li key={index}>{kosul}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Kaşe/İmza Alanı */}
      <div className="flex justify-end mt-8 print-avoid-break">
        <div className="text-center">
          {firmaKase ? (
            <Image 
              src={firmaKase} 
              alt="Firma Kaşe" 
              width={150} 
              height={80}
              className="mx-auto"
            />
          ) : (
            <div className="w-[150px] h-[80px] border-b border-dashed border-gray-400 mx-auto" />
          )}
          <p className="mt-2 text-xs text-muted-foreground">Kaşe / İmza</p>
        </div>
      </div>

      {/* İletişim */}
      {(firmaTelefon || firmaEmail) && (
        <div className="flex justify-center gap-4 pt-2 border-t text-xs text-muted-foreground print:text-gray-500">
          {firmaTelefon && <span>{firmaTelefon}</span>}
          {firmaTelefon && firmaEmail && <span>|</span>}
          {firmaEmail && <span>{firmaEmail}</span>}
        </div>
      )}
    </div>
  );
}

export default QuoteFooter;

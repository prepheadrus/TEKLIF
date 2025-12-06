
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CustomerInfo {
  ad: string;
  adres?: string;
  ilce?: string;
  email?: string;
  telefon?: string;
  vergiNo?: string;
}

interface QuoteCustomerInfoProps {
  customer: CustomerInfo;
  projectName?: string;
  projectDescription?: string;
  className?: string;
}

export function QuoteCustomerInfo({
  customer,
  projectName,
  projectDescription,
  className
}: QuoteCustomerInfoProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 print:grid-cols-2", className)}>
      {/* Müşteri Bilgileri */}
      <Card className="print-avoid-break print:shadow-none print:border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            MÜŞTERİ BİLGİLERİ
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p className="font-bold text-primary print:text-black">
            {customer.ad}
          </p>
          {customer.adres && <p>{customer.adres}</p>}
          {customer.ilce && <p>{customer.ilce}</p>}
          {(customer.email || customer.telefon) && (
            <p>
              {customer.email}
              {customer.email && customer.telefon && ' | '}
              {customer.telefon}
            </p>
          )}
          {customer.vergiNo && (
            <p className="text-muted-foreground print:text-gray-600">
              Vergi No/TCKN: {customer.vergiNo}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Proje Bilgisi */}
      {projectName && (
        <Card className="print-avoid-break print:shadow-none print:border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              PROJE BİLGİSİ
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{projectName}</p>
            {projectDescription && (
              <p className="mt-1 text-muted-foreground print:text-gray-600">
                {projectDescription}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default QuoteCustomerInfo;

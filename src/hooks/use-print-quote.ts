'use client';

import { useCallback, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

interface UsePrintQuoteOptions {
  teklifNo: string;
  onBeforePrint?: () => Promise<void> | void;
  onAfterPrint?: () => void;
}

export function usePrintQuote(options: UsePrintQuoteOptions) {
  const { teklifNo, onBeforePrint, onAfterPrint } = options;
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    // `contentRef` yerine `content` fonksiyonunu kullanmak React 18 uyumluluğu sağlar
    // ve `findDOMNode` hatasını çözer.
    content: () => printRef.current,
    
    documentTitle: `Teklif-${teklifNo}`,
    
    pageStyle: `
      @page {
        size: A4;
        margin: 15mm 12mm 20mm 12mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-hidden {
          display: none !important;
        }
      }
    `,
    
    onBeforePrint: onBeforePrint ? async () => {
      await onBeforePrint();
    } : undefined,
    
    onAfterPrint: onAfterPrint,
    
    // Tarayıcı belleğini temizlemek için yazdırma sonrası iframe'i kaldırır.
    removeAfterPrint: true,
  });

  // handleSaveAsPdf fonksiyonu, handlePrint ile aynı işlevi gördüğü için
  // ve PDF indirme seçeneği zaten tarayıcının yazdırma diyalogunda sunulduğu için kaldırıldı.
  // Bu, kod tekrarını önler.
  return {
    printRef,
    handlePrint,
  };
}

export default usePrintQuote;

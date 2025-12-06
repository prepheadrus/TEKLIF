'use client';

import { useCallback, useRef } from 'react';

interface UsePrintQuoteOptions {
  teklifNo: string;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

export function usePrintQuote(options: UsePrintQuoteOptions) {
  const { teklifNo, onBeforePrint, onAfterPrint } = options;
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    // Orijinal title'ı sakla
    const originalTitle = document.title;
    
    // PDF dosya adı için title'ı değiştir
    document.title = `Teklif-${teklifNo}`;

    // Before print callback
    if (onBeforePrint) {
      onBeforePrint();
    }

    // Yazdırma dialogunu aç
    window.print();

    // Title'ı geri al
    document.title = originalTitle;

    // After print callback
    if (onAfterPrint) {
      onAfterPrint();
    }
  }, [teklifNo, onBeforePrint, onAfterPrint]);

  return {
    printRef,
    handlePrint,
  };
}

export default usePrintQuote;

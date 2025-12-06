
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
    content: () => printRef.current,
    documentTitle: `Teklif-${teklifNo}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 20mm 15mm 25mm 15mm;
      }
      @page :first {
        margin-top: 15mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-hidden {
          display: none !important;
        }
        .print-avoid-break {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid !important;
        }
      }
    `,
    onBeforePrint: async () => {
      if (onBeforePrint) {
        await onBeforePrint();
      }
    },
    onAfterPrint: () => {
      if (onAfterPrint) {
        onAfterPrint();
      }
    },
  });

  // PDF olarak kaydetme (tarayıcı print dialog'undan)
  const handleSaveAsPdf = useCallback(() => {
    handlePrint();
  }, [handlePrint]);

  return {
    printRef,
    handlePrint,
    handleSaveAsPdf,
  };
}

export default usePrintQuote;

'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface PrintableQuoteProps {
  children: React.ReactNode;
  header: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const PrintableQuote = forwardRef<HTMLDivElement, PrintableQuoteProps>(
  ({ children, header, footer, className }, ref) => {
    return (
      <div 
        ref={ref} 
        className={cn(
          "bg-white min-h-screen",
          "print:m-0 print:p-0 print:shadow-none",
          "screen:max-w-[210mm] screen:mx-auto screen:my-8 screen:shadow-lg",
          className
        )}
      >
        {/* Print Header - her sayfada tekrarlanır */}
        <table className="w-full">
          <thead>
            <tr>
              <td>
                <div className="pb-4 mb-4 border-b print:border-b">
                  {header}
                </div>
              </td>
            </tr>
          </thead>
          
          <tbody>
            <tr>
              <td>
                <div className="py-4">
                  {children}
                </div>
              </td>
            </tr>
          </tbody>
          
          {footer && (
            <tfoot>
              <tr>
                <td>
                  <div className="pt-4 mt-4 border-t print:border-t">
                    {footer}
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  }
);

PrintableQuote.displayName = 'PrintableQuote';

export default PrintableQuote;

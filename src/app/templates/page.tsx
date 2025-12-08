
import { Metadata } from 'next';
import { TemplatesPageContent } from '@/app/templates/templates-client-page';

export const metadata: Metadata = {
    title: 'Şablonlar',
};

export default function TemplatesPage() {
    return <TemplatesPageContent />;
}

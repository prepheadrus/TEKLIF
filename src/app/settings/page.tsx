import { Metadata } from 'next';
import { SettingsPageContent } from './settings-client-page';

export const metadata: Metadata = {
  title: 'Ayarlar',
  description: 'Uygulama ayarlarını yönetin ve veritabanı işlemlerini gerçekleştirin.',
};

export default function SettingsPage() {
  return <SettingsPageContent />;
}

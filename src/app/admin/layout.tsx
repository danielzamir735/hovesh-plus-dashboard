import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'חובש+ | דשבורד אנליטיקס',
  description: 'לוח מחוונים אנליטיקס עבור אפליקציית חובש+',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" lang="he" className="min-h-screen">
      {children}
    </div>
  );
}

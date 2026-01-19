import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardWrapper from '@/components/DashboardWrapper';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <DashboardWrapper>{children}</DashboardWrapper>;
}

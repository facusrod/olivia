'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';

export default function DashboardWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="w-px bg-gray-200" />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

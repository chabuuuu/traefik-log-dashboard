import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import DemoDashboardClient from '@/features/demo/DemoDashboardClient';
import { useConfig } from '@/utils/contexts/ConfigContext';

export default function DemoDashboardPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const showDemoPage = config.showDemoPage;

  useEffect(() => {
    if (!showDemoPage) {
      void navigate({ to: '/dashboard', replace: true });
    }
  }, [navigate, showDemoPage]);

  if (!showDemoPage) {
    return null;
  }
  return <DemoDashboardClient />;
}

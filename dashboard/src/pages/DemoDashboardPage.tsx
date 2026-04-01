import { useEffect } from 'react'; // eslint-disable-line no-restricted-syntax
import { useNavigate } from '@tanstack/react-router';
import DemoDashboardClient from '@/features/demo/DemoDashboardClient';
import { useConfig } from '@/utils/contexts/ConfigContext';

export default function DemoDashboardPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const showDemoPage = config.showDemoPage;

  // eslint-disable-next-line no-restricted-syntax -- redirect on config change
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

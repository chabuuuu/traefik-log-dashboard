import { ThemeProvider } from 'next-themes';
import { AgentProvider } from '@/utils/contexts/AgentContext';
import { FilterProvider } from '@/utils/contexts/FilterContext';
import { ConfigProvider } from '@/utils/contexts/ConfigContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ConfigProvider>
        <AgentProvider>
          <FilterProvider>
            {children}
          </FilterProvider>
        </AgentProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

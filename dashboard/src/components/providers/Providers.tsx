import { ThemeProvider } from 'next-themes';
import { AgentProvider } from '@/utils/contexts/AgentContext';
import { FilterProvider } from '@/utils/contexts/FilterContext';
import { ConfigProvider } from '@/utils/contexts/ConfigContext';
import { LogProvider } from '@/utils/contexts/LogContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ConfigProvider>
        <AgentProvider>
          <FilterProvider>
            <LogProvider>
              {children}
            </LogProvider>
          </FilterProvider>
        </AgentProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

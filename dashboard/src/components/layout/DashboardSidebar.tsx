import type { ComponentType, SVGProps } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import packageJson from '../../../package.json';
import {
  LayoutDashboard,
  Settings,
  Bell,
  Filter,
  Server,
  Activity,
  Play,
  Github,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
} from '@/components/ui/ui-sidebar';
import { useConfig } from '@/utils/contexts/ConfigContext';

function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function PlayStoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3 2.75v18.5a.75.75 0 0 0 1.14.64l8.95-5.33L3 2.75zm10.32 12.37l2.48-1.48l2.44 1.45a.75.75 0 0 0 .77 0l1.86-1.1a.75.75 0 0 0 0-1.3l-1.86-1.1a.75.75 0 0 0-.77 0l-2.44 1.45l-2.48-1.48l-1.78 1.06a.75.75 0 0 0 0 1.3l1.78 1.06zM3 2.75l10.32 6.13l2.48-1.48L4.14 2.11A.75.75 0 0 0 3 2.75zm10.32 18.37L3 21.25a.75.75 0 0 0 1.14.64L15.8 16.6l-2.48-1.48z" />
    </svg>
  );
}

function AppStoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.58 4.08a.75.75 0 0 1 1.03.27l1.03 1.78a.75.75 0 1 1-1.3.75l-1.03-1.78a.75.75 0 0 1 .27-1.02zm-6.2.24a.75.75 0 0 1 1.02.28l5.95 10.3a.75.75 0 0 1-1.3.75L10.1 5.35a.75.75 0 0 1 .28-1.03zM4.22 18.5a.75.75 0 0 1 .75-.75h14.06a.75.75 0 1 1 0 1.5H4.97a.75.75 0 0 1-.75-.75zm7.46-5.72L8.17 18.9a.75.75 0 1 1-1.3-.75l3.51-6.12a.75.75 0 0 1 1.3.75zm-2.93-5.02a.75.75 0 0 1 1.3.75l-1.47 2.57a.75.75 0 1 1-1.3-.75l1.47-2.57z" />
    </svg>
  );
}

type SocialItem = {
  label: string;
  href: string | null;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  isComingSoon: boolean;
};

const baseNavItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
  },
];

const demoNavItem = {
  title: 'Demo Mode',
  url: '/dashboard/demo',
  icon: Play,
};

const settingsNavItems = [
  {
    title: 'General',
    url: '/settings',
    icon: Settings,
  },
  {
    title: 'Agents',
    url: '/settings/agents',
    icon: Server,
  },
  {
    title: 'Alerts',
    url: '/settings/alerts',
    icon: Bell,
  },
  {
    title: 'Filters',
    url: '/settings/filters',
    icon: Filter,
  },
];

const socialItems: SocialItem[] = [
  {
    label: 'Play Store',
    href: null,
    icon: PlayStoreIcon,
    isComingSoon: true,
  },
  {
    label: 'App Store',
    href: null,
    icon: AppStoreIcon,
    isComingSoon: true,
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/HDCt9MjyMJ',
    icon: DiscordIcon,
    isComingSoon: false,
  },
  {
    label: 'GitHub',
    href: 'https://github.com/hhftechnology/traefik-log-dashboard',
    icon: Github,
    isComingSoon: false,
  },
];

export function DashboardSidebar() {
  const { config } = useConfig();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const appVersion = `v${packageJson.version}`;
  const mainNavItems = config.showDemoPage ? [...baseNavItems, demoNavItem] : baseNavItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border py-1 px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Activity className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Traefik Logs</span>
                  <span className="text-xs text-muted-foreground">Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-center gap-1 px-2 py-1">
              {socialItems.map((item) => {
                const isDisabled = item.isComingSoon || !item.href;
                const tooltipLabel = isDisabled ? `${item.label} (Coming soon)` : item.label;

                if (!isDisabled && item.href) {
                  return (
                    <SidebarMenuButton
                      key={item.label}
                      asChild
                      size="sm"
                      className="size-8 justify-center p-0"
                      tooltip={{ children: tooltipLabel, hidden: false }}
                    >
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={item.label}
                      >
                        <item.icon className="size-4" />
                      </a>
                    </SidebarMenuButton>
                  );
                }

                return (
                  <SidebarMenuButton
                    key={item.label}
                    size="sm"
                    disabled
                    className="size-8 cursor-not-allowed justify-center p-0 opacity-50"
                    aria-label={`${item.label} coming soon`}
                    tooltip={{ children: tooltipLabel, hidden: false }}
                  >
                    <item.icon className="size-4" />
                  </SidebarMenuButton>
                );
              })}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="sm">
              <a
                href="https://github.com/hhftechnology/traefik-log-dashboard"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-xs text-muted-foreground">{appVersion}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

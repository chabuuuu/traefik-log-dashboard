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
import { DiscordIcon, PlayStoreIcon, AppStoreIcon } from '@/components/ui/icons';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useConfig } from '@/utils/contexts/ConfigContext';

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
      <SidebarHeader className="h-14 shrink-0 border-b border-sidebar-border px-2 flex items-center">
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
        <div className="flex items-center justify-center gap-3 py-2 group-data-[collapsible=icon]:hidden">
          {socialItems.map((item) => {
            const isDisabled = item.isComingSoon || !item.href;
            const tooltipLabel = isDisabled
              ? `${item.label} (Coming soon)`
              : item.label;

            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  {!isDisabled && item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.label}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    >
                      <item.icon className="size-4" />
                    </a>
                  ) : (
                    <span
                      aria-label={`${item.label} coming soon`}
                      className="inline-flex cursor-not-allowed items-center justify-center rounded-md p-1.5 text-sidebar-foreground/30"
                    >
                      <item.icon className="size-4" />
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent side="top">{tooltipLabel}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <SidebarMenu>
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

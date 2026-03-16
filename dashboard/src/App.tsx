import React from 'react';
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { AppLayout } from '@/layouts/AppLayout';
import HomePage from '@/pages/HomePage';
import DashboardPage from '@/pages/DashboardPage';
import DemoDashboardPage from '@/pages/DemoDashboardPage';
import SettingsPage from '@/pages/SettingsPage';
import SettingsAgentsPage from '@/pages/SettingsAgentsPage';
import SettingsAlertsPage from '@/pages/SettingsAlertsPage';
import SettingsFiltersPage from '@/pages/SettingsFiltersPage';

function NotFoundPage() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Page Not Found</h1>
        <p className="text-muted-foreground">The page you’re looking for doesn’t exist.</p>
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const dashboardDemoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard/demo',
  component: DemoDashboardPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const settingsAgentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/agents',
  component: SettingsAgentsPage,
});

const settingsAlertsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/alerts',
  component: SettingsAlertsPage,
});

const settingsFiltersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/filters',
  component: SettingsFiltersPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  dashboardDemoRoute,
  settingsRoute,
  settingsAgentsRoute,
  settingsAlertsRoute,
  settingsFiltersRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}

import { Stack } from 'expo-router';

export default function PathsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} initialRouteName="welcome" />;
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';

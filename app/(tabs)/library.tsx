import { useRouter } from 'expo-router';

import { RouteErrorBoundary } from '@/components/route-error-boundary';
import { LibraryOverview } from '@/features/library';

/** Trasa wyłącznie składa nawigację; dane i hierarchia żyją w feature Library. */
export default function LibraryScreen() {
  const router = useRouter();

  return (
    <LibraryOverview
      onOpenCatalog={() => {
        router.push('/paths');
      }}
      onOpenBookLab={() => {
        router.push('../book-lab');
      }}
      onOpenIntentSuggestions={() => {
        router.push('/habit/new');
      }}
      onOpenPath={(slug, pathId) => {
        router.push({ pathname: '/paths/[slug]', params: { slug, pathId } });
      }}
      onAddTemplate={(templateId) => {
        router.push(`/habit/new?templateId=${templateId}`);
      }}
    />
  );
}

export { RouteErrorBoundary as ErrorBoundary };

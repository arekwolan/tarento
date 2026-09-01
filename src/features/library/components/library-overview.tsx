import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { trackEvent } from '@/features/analytics';
import { RetiredHabitsSection } from '@/features/habits';
import { useLibraryOverview } from '@/features/library/hooks/use-library-overview';
import { PathContinueCard, PathContinueSkeleton } from '@/features/paths';
import {
  TemplateCard,
  TemplatePreviewSheet,
  type HabitTemplate,
  type TemplateCategory,
} from '@/features/templates';
import type { TranslationKey } from '@/i18n/keys';
import { formatFullDay, type SupportedLocale } from '@/lib/date';

const CATEGORY_LABEL = {
  focus: 'categories.focus',
  mindfulness: 'categories.mindfulness',
  health: 'categories.health',
  learning: 'categories.learning',
  relationships: 'categories.relationships',
} as const satisfies Record<TemplateCategory, TranslationKey>;

export type LibraryOverviewProps = {
  onOpenCatalog: () => void;
  onOpenBookLab: () => void;
  onOpenIntentSuggestions: () => void;
  onOpenPath: (slug: string, pathId: string) => void;
  onAddTemplate: (templateId: string) => void;
};

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <View className="gap-1">
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {description === undefined ? null : (
        <Text variant="body" tone="secondary">
          {description}
        </Text>
      )}
    </View>
  );
}

function RetryState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <Banner message={message} />
      <Button label={t('common.retry')} variant="secondary" onPress={onRetry} />
    </View>
  );
}

function SectionSkeleton() {
  return (
    <View
      className="gap-3"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-24 w-full rounded-md" />
      <Skeleton className="h-12 w-full rounded-md" />
    </View>
  );
}

function QuoteEntry({
  content,
  author,
  meta,
}: {
  content: string;
  author: string;
  meta?: string;
}) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <Text variant="quote">{content}</Text>
      <Text variant="caption" tone="tertiary">
        {meta === undefined ? author : t('library.meta', { author, meta })}
      </Text>
    </Card>
  );
}

export function LibraryOverview({
  onOpenCatalog,
  onOpenBookLab,
  onOpenIntentSuggestions,
  onOpenPath,
  onAddTemplate,
}: LibraryOverviewProps) {
  const { t, i18n } = useTranslation();
  const locale: SupportedLocale = i18n.language.startsWith('en') ? 'en' : 'pl';
  const [category, setCategory] = useState<TemplateCategory | null>(null);
  const [preview, setPreview] = useState<HabitTemplate | null>(null);
  const library = useLibraryOverview(category);
  const [isCompletedOpen, setCompletedOpen] = useState<boolean>(
    library.view.completedInitiallyExpanded,
  );

  return (
    <>
      <Screen scroll>
        <Text variant="titleLg" accessibilityRole="header">
          {t('library.title')}
        </Text>

        {library.view.offline ? <Banner message={t('library.offline')} /> : null}

        <View className="gap-8">
          {library.view.primary.kind === 'loading' ? (
            <PathContinueSkeleton />
          ) : library.view.primary.kind === 'continue' ? (
            <PathContinueCard
              continuation={library.view.primary.continuation}
              onPress={(entry) => {
                trackEvent('path_continue_opened', {
                  stage_ordinal: entry.stage.ordinal,
                  total_stages: entry.totalStages,
                });
                onOpenPath(entry.slug, entry.pathId);
              }}
            />
          ) : library.view.primary.kind === 'error' ? (
            <RetryState
              message={t('library.sections.continue.error')}
              onRetry={library.retryPrimary}
            />
          ) : library.view.primary.kind === 'offline_unavailable' ? (
            <Banner message={t('library.sections.continue.offlineUnavailable')} />
          ) : (
            <View className="gap-3">
              <SectionHeading
                title={t('library.sections.start.title')}
                description={t('library.sections.start.description')}
              />
              <Card className="gap-3">
                <Button
                  label={t('library.sections.start.catalog')}
                  onPress={onOpenCatalog}
                />
                <Button
                  label={t('library.sections.start.bookLab')}
                  variant="secondary"
                  onPress={onOpenBookLab}
                />
              </Card>
            </View>
          )}

          <View className="gap-3">
            <SectionHeading
              title={t('library.sections.tools.title')}
              description={t('library.sections.tools.description')}
            />

            <Card className="gap-3">
              <Text variant="bodyLg">{t('library.sections.tools.intentTitle')}</Text>
              <Text variant="body" tone="secondary">
                {t('library.sections.tools.intentDescription')}
              </Text>
              <Button
                label={t('library.sections.tools.intentAction')}
                variant="secondary"
                onPress={onOpenIntentSuggestions}
              />
            </Card>

            <Text variant="label" tone="secondary">
              {t('library.sections.tools.templates')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Chip
                label={t('library.filterAll')}
                selected={category === null}
                onPress={() => {
                  setCategory(null);
                }}
              />
              {library.availableCategories.map((available) => (
                <Chip
                  key={available}
                  label={t(CATEGORY_LABEL[available])}
                  selected={category === available}
                  onPress={() => {
                    setCategory(available);
                  }}
                />
              ))}
            </View>

            {library.view.templates.state === 'loading' ? (
              <SectionSkeleton />
            ) : library.view.templates.state === 'error' ? (
              <RetryState
                message={t('library.sections.tools.error')}
                onRetry={library.retryTemplates}
              />
            ) : library.view.templates.state === 'empty' ? (
              <EmptyState
                icon="albums-outline"
                title={t('library.emptyTemplates.title')}
                description={t('library.emptyTemplates.description')}
              />
            ) : (
              <>
                {library.view.templates.refreshFailed ? (
                  <RetryState
                    message={t('library.sections.tools.refreshError')}
                    onRetry={library.retryTemplates}
                  />
                ) : null}
                <View className="flex-row flex-wrap justify-between gap-3">
                  {library.templates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onPress={setPreview}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          <View className="gap-3">
            <SectionHeading
              title={t('library.sections.reflection.title')}
              description={t('library.sections.reflection.description')}
            />

            {library.view.reflection.state === 'loading' ? (
              <SectionSkeleton />
            ) : library.view.reflection.state === 'error' ? (
              <RetryState
                message={t('library.sections.reflection.error')}
                onRetry={library.retryReflection}
              />
            ) : library.view.reflection.state === 'empty' ? (
              <EmptyState
                icon="book-outline"
                title={t('library.sections.reflection.emptyTitle')}
                description={t('library.sections.reflection.emptyDescription')}
              />
            ) : (
              <View className="gap-8">
                {library.view.reflection.refreshFailed ? (
                  <RetryState
                    message={t('library.sections.reflection.refreshError')}
                    onRetry={library.retryReflection}
                  />
                ) : null}

                {library.quote === null ? null : (
                  <View className="gap-3">
                    <Text variant="label" tone="secondary">
                      {t('library.quotes.today')}
                    </Text>
                    <QuoteEntry
                      content={library.quote.content}
                      author={library.quote.author}
                      meta={library.quote.sourceBook ?? undefined}
                    />
                  </View>
                )}

                {library.favorites.length === 0 ? null : (
                  <View className="gap-3">
                    <Text variant="label" tone="secondary">
                      {t('library.quotes.favorites')}
                    </Text>
                    {library.favorites.map((favorite) => (
                      <QuoteEntry
                        key={favorite.id}
                        content={favorite.content}
                        author={favorite.author}
                        meta={favorite.sourceBook ?? undefined}
                      />
                    ))}
                  </View>
                )}

                {library.quoteHistory.length === 0 ? null : (
                  <View className="gap-3">
                    <Text variant="label" tone="secondary">
                      {t('library.quotes.history')}
                    </Text>
                    {library.quoteHistory.map((entry) => (
                      <QuoteEntry
                        key={entry.shownOn}
                        content={entry.quote.content}
                        author={entry.quote.author}
                        meta={formatFullDay(entry.shownOn, locale)}
                      />
                    ))}
                  </View>
                )}

                {library.letters.length === 0 ? null : (
                  <View className="gap-3">
                    <Text variant="label" tone="secondary">
                      {t('library.sections.reflection.letters')}
                    </Text>
                    {library.letters.map((letter) => (
                      <Card key={letter.id} className="gap-3">
                        <Text variant="caption" tone="tertiary">
                          {formatFullDay(letter.writtenOn, locale)}
                        </Text>
                        <Text variant="quote">{letter.body}</Text>
                      </Card>
                    ))}
                  </View>
                )}

                <RetiredHabitsSection
                  habits={library.retiredHabits}
                  isRestoring={library.isRestoring}
                  onRestore={library.restore}
                />
              </View>
            )}
          </View>

          <View className="gap-3">
            <SectionHeading title={t('library.sections.completed.title')} />

            {library.view.completed.state === 'loading' ? (
              <SectionSkeleton />
            ) : library.view.completed.state === 'error' ? (
              <RetryState
                message={t('library.sections.completed.error')}
                onRetry={library.retryCompleted}
              />
            ) : (
              <Card className="gap-3">
                <Button
                  label={t(
                    isCompletedOpen
                      ? 'library.sections.completed.hide'
                      : 'library.sections.completed.show',
                    { count: library.endedPaths.length },
                  )}
                  variant="ghost"
                  accessibilityState={{ expanded: isCompletedOpen }}
                  onPress={() => {
                    setCompletedOpen((current) => !current);
                  }}
                />

                {!isCompletedOpen ? null : library.endedPaths.length === 0 ? (
                  <Text variant="body" tone="secondary">
                    {t('library.sections.completed.empty')}
                  </Text>
                ) : (
                  library.endedPaths.map((ended, index) => (
                    <View key={ended.id} className="gap-3">
                      {index === 0 ? null : <Divider />}
                      <View className="gap-1">
                        <Text variant="bodyLg">{ended.title}</Text>
                        <Text variant="caption" tone="tertiary">
                          {formatFullDay(ended.endedAt.slice(0, 10), locale)}
                        </Text>
                      </View>
                      <Button
                        label={t('library.sections.completed.open')}
                        variant="secondary"
                        onPress={() => {
                          onOpenPath(ended.slug, ended.pathId);
                        }}
                      />
                    </View>
                  ))
                )}
              </Card>
            )}
          </View>
        </View>
      </Screen>

      <TemplatePreviewSheet
        template={preview}
        onClose={() => {
          setPreview(null);
        }}
        onAdd={(template) => {
          setPreview(null);
          onAddTemplate(template.id);
        }}
      />
    </>
  );
}

import { useLayoutEffect } from 'react';

export interface ScrollViewport {
  scrollTo(options: ScrollToOptions): void;
}

export function scrollToPageTop(viewport: ScrollViewport = window): void {
  viewport.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

export function getAppNavigationScrollKey(
  phase: string,
  stepIndex: number,
  detailSpecialty: string | null,
): string {
  if (phase === 'quiz') return `quiz:${stepIndex}`;
  if (phase === 'detail') return `detail:${detailSpecialty ?? ''}`;
  return phase;
}

export function getDashboardNavigationScrollKey(accessState: string, view: string): string {
  return accessState === 'authorized'
    ? `dashboard:authorized:${view}`
    : `dashboard:${accessState}`;
}

export function getSpecialistPromptNavigationScrollKey(success: boolean): string {
  return success ? 'specialist:success' : 'specialist:form';
}

export function useScrollToPageTop(navigationKey: string): void {
  useLayoutEffect(() => {
    scrollToPageTop();
  }, [navigationKey]);
}

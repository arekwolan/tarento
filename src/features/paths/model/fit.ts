// Import prosto z czystego modułu budżetu, nie z jego publicznego indeksu:
// indeks wciąga hooki, a przez nie klienta Supabase i MMKV. Ten plik ma
// zostać czysty — tak samo robi reszta feature'ów z modelem nawyków.
import { budgetCeiling } from '@/features/day-budget/model/windows';
import type { PathFit, PathPractice, PathStage } from '@/features/paths/model/schemas';

/**
 * Bramka budżetowa: ścieżka proponuje, budżet rozstrzyga.
 *
 * Ścieżka nigdy nie decyduje, ile miejsca zajmie w dniu — deklaruje
 * zapotrzebowanie (`dailyMinutesP50` etapów), a okno użytkownika je przycina
 * albo odmawia zapisu. Czyste funkcje: bez sieci, bez zegara.
 */

export type FitVerdict = 'fits' | 'tight' | 'lite' | 'blocked';

export type PathFitCheck = {
  verdict: FitVerdict;
  /** Najcięższy etap ścieżki — to on rozstrzyga, a nie średnia. */
  peakMinutes: number;
};

/** Wystarczy tyle, żeby policzyć zapotrzebowanie. */
export type StageMinutes = Pick<PathStage, 'dailyMinutesP50'>;

/**
 * Ile ścieżka potrzebuje: na starcie, najmniej i najwięcej.
 *
 * `start` bierze się z pierwszego etapu, a nie z minimum — zwykle to ta sama
 * liczba, ale ścieżka wolno może zaczynać od cięższego etapu i wtedy
 * użytkownikowi należy się prawda o pierwszym dniu.
 *
 * @param stages etapy w kolejności `ordinal` — tak jak oddaje je api ścieżek
 */
export type PathMinutes = { start: number; min: number; max: number };

export function pathMinutes(stages: readonly StageMinutes[]): PathMinutes {
  const minutes = stages.map((stage) => stage.dailyMinutesP50);

  if (minutes.length === 0) return { start: 0, min: 0, max: 0 };

  return {
    start: minutes[0] ?? 0,
    min: Math.min(...minutes),
    max: Math.max(...minutes),
  };
}

/**
 * Czy ścieżka mieści się w oknie użytkownika.
 *
 * Progi w kolejności od najłagodniejszego:
 *   * `fits`    — szczyt mieści się w suficie propozycji (60% okna),
 *   * `tight`   — mieści się w oknie, ale zajmie prawie całe,
 *   * `lite`    — do półtora okna: da się poprowadzić wariant lekki,
 *   * `blocked` — powyżej: żadna wersja tej ścieżki nie ma tu miejsca.
 *
 * Współczynnik sufitu bierzemy z `budgetCeiling` — 0.6 ma w kodzie jedno
 * miejsce i nie wolno go tutaj powtórzyć.
 *
 * @param allocatedMinutes okno użytkownika w minutach; `Infinity`, gdy nie ma
 *   jeszcze kształtu dnia — wtedy nie ma czego przycinać i wychodzi `fits`
 */
export function checkPathFit(
  stages: readonly StageMinutes[],
  allocatedMinutes: number,
): PathFitCheck {
  const peakMinutes = pathMinutes(stages).max;

  if (peakMinutes <= budgetCeiling({ selfMinutes: allocatedMinutes })) {
    return { verdict: 'fits', peakMinutes };
  }

  if (peakMinutes <= allocatedMinutes) return { verdict: 'tight', peakMinutes };
  if (peakMinutes <= allocatedMinutes * 1.5) return { verdict: 'lite', peakMinutes };

  return { verdict: 'blocked', peakMinutes };
}

/**
 * Dopasowanie, które powstaje bez modelu.
 *
 * Ścieżka ma działać w całości bez ani jednego wywołania modelu (IDEAS.md §C).
 * To jest ten wariant: sam werdykt bramki budżetowej, zero pominięć, zero
 * zmian wartości, zero zdania.
 *
 * Mirror `deterministicPathFit()` z supabase/functions/_shared/path-fit.ts.
 */
export function deterministicPathFit(verdict: FitVerdict): PathFit {
  return { lite: verdict === 'lite', skip: [], adjust: [], note: '' };
}

/** Czy dopasowanie w ogóle ma co pokazać na ekranie przeglądu. */
export function hasFitChanges(fit: PathFit): boolean {
  return fit.skip.length > 0 || fit.adjust.length > 0 || fit.note !== '';
}

/** Identyfikatory praktyk, które wariant lekki pomija. */
export function optionalPracticeIds(practices: readonly PathPractice[]): string[] {
  return practices
    .filter((practice) => practice.isOptional)
    .map((practice) => practice.id);
}

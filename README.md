# Tarento

Tarento to mobilny asystent rozwoju osobistego na iOS i Androida. Łączy
krótką listę na dziś z realnym budżetem dnia, nawykami, jedną aktywną ścieżką
oraz prywatnymi protokołami budowanymi z notatek użytkownika.

**Stan zweryfikowany: 2026-08-31.** Źródłem prawdy o regułach pracy i aktualnej
mapie kodu jest [CLAUDE.md](CLAUDE.md). Pomysły w `IDEAS.md`, `IDEAS_GPT.md`
i `FRONTEND.md` są kierunkiem lub promptami, nie deklaracją wdrożenia.

## Co jest w produkcie

- Dzisiaj: trwały plan dnia, budżet minut, `planned`/`overflow`, odpoczynek,
  quiet week, cytat, notatka dnia, listy i jednorazowy setup etapu.
- Nawyki: przypomnienia, serie, historia, wersje zachowania, tarcie, downshift,
  emerytura i małe eksperymenty A/B.
- Statystyki: tempo, obserwacje, prognozy, adherence i mapa dni.
- Biblioteka i ścieżki: katalog, jedna aktywna ścieżka, etapy, czytania,
  pauza/powrót, transfer, zakończenie i historia.
- Prywatne protokoły: notatki → draft → preview; konflikt strukturalny jest
  liczony deterministycznie, a AI może tylko zasugerować konflikt semantyczny.
- Konto, synchronizacja Supabase, RLS, cache offline, eksport danych, PL/EN
  i lokalne powiadomienia.

AI działa wyłącznie w Supabase Edge Functions. Odpowiedź modelu jest
walidowaną propozycją i nie mutuje danych bez decyzji użytkownika. Trasa
`/plan` oraz `generate-daily-plan` pozostają powierzchnią kompatybilności;
główne wejście AI prowadzi przez intencję w tworzeniu nawyku.

## Uruchomienie

Wymagane są Node.js 20+, Docker Desktop oraz development build aplikacji
(Expo Go nie obsługuje użytych modułów natywnych).

```bash
npm install
npm run dev
```

`npm run dev` uruchamia lokalny Supabase, stosuje migracje, przygotowuje
`.env.local` i startuje Metro. Instrukcja dla Windows/macOS, emulatora i danych
demo jest w [URUCHAMIANIE.md](URUCHAMIANIE.md).

Najważniejsze kontrole:

```bash
npm run doctor
npm run typecheck
npm run lint
npm run test
npm run prompt:test -- --dry-run
```

Pełny `prompt:test` wymaga `GEMINI_API_KEY` w środowisku procesu. Liczby testów
nie są utrwalane w dokumentacji; miarodajny jest wynik bieżącego uruchomienia.

## Mapa repozytorium

- `app/` — trasy: auth, onboarding, zakładki Dzisiaj/Statystyki/Biblioteka/
  Ustawienia, nawyki, ścieżki i czytania, Laboratorium książki, privacy oraz
  legacy `/plan`.
- `src/features/` — `ai-plan`, `analytics`, `auth`, `book-lab`,
  `conflict-radar`, `data-export`, `day-budget`, `experiments`, `friction`,
  `habits`, `journal`, `letters`, `library`, `notifications`, `paths`,
  `quotes`, `self-knowledge`, `stats`, `templates`.
- `supabase/migrations/` i `supabase/tests/` — schema, RLS, RPC i pgTAP.
- `supabase/functions/` — `generate-daily-plan`, `suggest-habit`,
  `suggest-downshift`, `suggest-path-fit`, `book-lab`, `protocol-conflicts`.
- `docs/` — dokumentacja semantyki planu i modułów domenowych.

Szczegółowa mapa tras oraz zasada jej utrzymywania są w
[CLAUDE.md](CLAUDE.md#4-mapa-kodu).

## Dokumentacja

- [CLAUDE.md](CLAUDE.md) — obowiązujące reguły architektury, bezpieczeństwa,
  i18n, offline, testów i raportowania oraz aktualny stan produktu.
- [URUCHAMIANIE.md](URUCHAMIANIE.md) — konfiguracja lokalnego środowiska.
- [FRONTEND.md](FRONTEND.md) — kierunek wizualny i prompty UI.
- [IDEAS.md](IDEAS.md) — historyczny plan produktu i starsze prompty.
- [IDEAS_GPT.md](IDEAS_GPT.md) — nowszy audyt, statusy i prompty wdrożeniowe;
  bank pomysłów pozostaje warunkowy.

Przy dodaniu lub usunięciu trasy, tabeli albo Edge Function zaktualizuj w tej
samej zmianie ten skrót i mapę w `CLAUDE.md`.

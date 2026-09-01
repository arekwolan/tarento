-- Kategoria nawyku.
--
-- Formularz pyta o nią w pierwszym kroku, a szablony z habit_templates
-- przenoszą swoją kategorię do zakładanego nawyku. Ten sam zbiór wartości
-- co w katalogu, żeby dało się je później zestawiać.
alter table public.habits
  add column category text
    check (category in ('mindfulness', 'health', 'focus', 'learning', 'relationships'));

comment on column public.habits.category is
  'Obszar nawyku. Ten sam słownik co habit_templates.category.';

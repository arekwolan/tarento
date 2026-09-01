-- Sufit liczby pozycji pokazywanych na dziś.
--
-- Lista dłuższa niż kilka pozycji przestaje być „jedną rzeczą na dziś", a to
-- jedyna obietnica tego ekranu. Nadmiar nie znika z danych — zostaje poza
-- widokiem, do rozwinięcia jednym dotknięciem.

alter table public.profiles
  add column daily_ceiling smallint not null default 5
    check (daily_ceiling between 1 and 12);

comment on column public.profiles.daily_ceiling is
  'Ile pozycji maksymalnie widać na liście „Dziś". Reszta czeka poza widokiem, bez oznaczenia. 12 to praktyczny brak limitu.';

-- RLS i polityki dla public.profiles istnieją od migracji 20260825134141
-- i nie zmieniają się: kolumna dziedziczy je razem z tabelą.

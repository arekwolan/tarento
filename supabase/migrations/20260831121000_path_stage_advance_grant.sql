-- advance_path_stage było kilkukrotnie redefiniowane przez lifecycle i fit.
-- Jawny grant chroni przejście etapu (a więc i archiwizację setupu) także na
-- bazach aktualizowanych inkrementalnie ze starszej wersji.

grant execute on function public.advance_path_stage(uuid, uuid, date)
  to authenticated, service_role;

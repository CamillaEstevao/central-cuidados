-- MANHÃ - 07:00
update medications
set schedule = '["07:00"]'::jsonb
where user_id = '1d8d075b-85dd-4ee0-bd26-b9435969a58c'
and name in (
  'Hidroclorotiazida 25 mg',
  'Dapagliflozina 10 mg',
  'Losartana 50 mg',
  'Retinol (Vit. A) + Colecalciferol (Vit. D)'
);

-- CAPTOPRIL - 12/12H
update medications
set schedule = '["07:00","19:00"]'::jsonb
where user_id = '1d8d075b-85dd-4ee0-bd26-b9435969a58c'
and name = 'Captopril 25 mg';

-- METFORMINA - 12/12H
update medications
set schedule = '["07:00","19:00"]'::jsonb
where user_id = '1d8d075b-85dd-4ee0-bd26-b9435969a58c'
and name = 'Metformina 500 mg XR';

-- AAS - APÓS ALMOÇO
update medications
set schedule = '["12:00"]'::jsonb
where user_id = '1d8d075b-85dd-4ee0-bd26-b9435969a58c'
and name = 'Ácido acetilsalicílico 100 mg';

-- INSULINA NPH
-- A receita indica 6 UI cedo e 4 UI após almoço.
update medications
set schedule = '["07:00","12:00"]'::jsonb
where user_id = '1d8d075b-85dd-4ee0-bd26-b9435969a58c'
and name = 'Insulina Humana NPH 100 UI/mL';

-- NOITE - 23:00
update medications
set schedule = '["23:00"]'::jsonb
where user_id = '1d8d075b-85dd-4ee0-bd26-b9435969a58c'
and name in (
  'Sinvastatina 40 mg',
  'Valproato de sódio 500 mg'
);

-- INSULINA REGULAR:
-- NÃO colocamos como aplicação automática.
-- Os lembretes serão para medir a glicemia.
update medications
set schedule = '[]'::jsonb
where user_id = '1d8d075b-85dd-4ee0-bd26-b9435969a58c'
and name = 'Insulina Humana Regular 100 UI/mL';
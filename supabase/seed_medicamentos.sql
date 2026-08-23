-- Substitua SEU_USER_UUID pelo UUID do usuário criado no Supabase Auth.

insert into medications (user_id,name,dose,frequency,schedule,prescription_text,stock,stock_unit) values
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Insulina Humana NPH 100 UI/mL','6 UI cedo / 4 UI após almoço','2x ao dia','[]','Aplicar 6 UI cedo e 4 UI após o almoço.',null,'UI'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Ácido acetilsalicílico 100 mg','1 comprimido','1x ao dia','[]','Tomar 1 comprimido após o almoço.',null,'comprimidos'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Hidroclorotiazida 25 mg','1 comprimido','1x ao dia','[]','Tomar 1 comprimido cedo.',null,'comprimidos'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Captopril 25 mg','1 comprimido','A cada 12 horas','[]','Tomar 1 comprimido a cada 12 horas.',null,'comprimidos'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Metformina 500 mg XR','1 comprimido','A cada 12 horas','[]','Tomar 1 comprimido a cada 12 horas.',null,'comprimidos'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c',
 'Insulina Humana Regular 100 UI/mL',
 'Conforme glicemia',
 'Conforme escala',
 '[]',
 'Escala da receita: <70 mg/dL não aplicar e oferecer suco doce; 71–179 não administrar; 180–250 = 3 UI; 251–300 = 6 UI; 301–350 = 8 UI; 351–400 = 10 UI; >401 = 12 UI e tomar bastante água. Seguir a orientação médica.',
 null,
 'UI'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Dapagliflozina 10 mg','1 comprimido','1x ao dia','[]','Tomar 1 comprimido pela manhã.',null,'comprimidos'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Losartana 50 mg','1 comprimido','1x ao dia','[]','Tomar 1 comprimido 1x ao dia.',null,'comprimidos'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Sinvastatina 40 mg','1 comprimido','1x ao dia','[]','Tomar 1 comprimido à noite.',null,'comprimidos'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Valproato de sódio 500 mg','1 comprimido','1x ao dia','[]','Tomar 1 comprimido à noite. Uso contínuo.',null,'comprimidos'),
('1d8d075b-85dd-4ee0-bd26-b9435969a58c','Retinol (Vit. A) + Colecalciferol (Vit. D)','5 gotas','1x ao dia','[]','Tomar 5 gotas por dia. Uso contínuo.',null,'gotas');

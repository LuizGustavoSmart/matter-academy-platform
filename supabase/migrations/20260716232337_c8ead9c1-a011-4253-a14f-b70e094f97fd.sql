CREATE POLICY "Authenticated read atividades" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'atividades');
CREATE POLICY "Authenticated upload atividades" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'atividades');
CREATE POLICY "Authenticated update atividades" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'atividades');
CREATE POLICY "Authenticated delete atividades" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'atividades');
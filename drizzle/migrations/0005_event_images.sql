ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS image_url text;
CREATE POLICY "event images public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'event-images');
CREATE POLICY "event images admin upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-images' AND (public.has_role(auth.uid(), 'superadmin') OR EXISTS (SELECT 1 FROM public.program_admins pa WHERE pa.user_id = auth.uid())));
CREATE POLICY "event images admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'event-images' AND owner = auth.uid());
CREATE POLICY "event images admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'event-images' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'superadmin')));
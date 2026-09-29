-- Execute uma vez no SQL Editor do Supabase conectado a este portal.
-- Não altera classificações existentes nem registros de atividades.
BEGIN;
ALTER TABLE public.portal_descriptions
  ADD COLUMN IF NOT EXISTS value_added text
  CHECK (value_added IS NULL OR value_added IN ('VA', 'NVA', 'NNVA'));

CREATE OR REPLACE FUNCTION public.set_description_value_added(description_id text, classification text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE updated_id text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.portal_profiles
    WHERE id = auth.uid() AND active = true AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores ativos podem alterar a classificação.';
  END IF;
  IF classification IS NOT NULL AND classification NOT IN ('VA', 'NVA', 'NNVA') THEN
    RAISE EXCEPTION 'Classificação inválida.';
  END IF;
  UPDATE public.portal_descriptions
    SET value_added = classification
    WHERE id::text = description_id
    RETURNING id::text INTO updated_id;
  IF updated_id IS NULL THEN
    RAISE EXCEPTION 'Descrição não encontrada. Atualize a página.';
  END IF;
  RETURN jsonb_build_object('id', updated_id, 'value_added', classification);
END;
$$;
REVOKE ALL ON FUNCTION public.set_description_value_added(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_description_value_added(text, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

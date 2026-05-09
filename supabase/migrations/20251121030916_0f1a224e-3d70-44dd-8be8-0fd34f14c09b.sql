-- Fix search_path security issue for get_active_api_key function
CREATE OR REPLACE FUNCTION get_active_api_key(p_service_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key TEXT;
BEGIN
  -- Get the first active API key for the service, ordered by priority
  SELECT api_key INTO v_api_key
  FROM api_keys
  WHERE service_name = p_service_name
    AND is_active = true
  ORDER BY priority ASC
  LIMIT 1;
  
  -- Update usage stats
  IF v_api_key IS NOT NULL THEN
    UPDATE api_keys
    SET 
      last_used_at = NOW(),
      usage_count = usage_count + 1
    WHERE service_name = p_service_name
      AND api_key = v_api_key;
  END IF;
  
  RETURN v_api_key;
END;
$$;
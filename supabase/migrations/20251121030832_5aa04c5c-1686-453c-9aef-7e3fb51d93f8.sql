-- Create table to store multiple API keys for different services
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL CHECK (service_name IN ('coinmarketcap', 'currencyfreaks', 'goldapi', 'taapi')),
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  daily_limit INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_name, priority)
);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can manage API keys
CREATE POLICY "Admins can manage API keys"
ON api_keys
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create function to get next available API key
CREATE OR REPLACE FUNCTION get_active_api_key(p_service_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger to update updated_at
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE api_keys IS 'Stores multiple API keys for different services with auto-rotation capability';
COMMENT ON FUNCTION get_active_api_key IS 'Returns the next available active API key for a service and updates usage stats';
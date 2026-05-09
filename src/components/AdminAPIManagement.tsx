import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Trash2, Save, Lock, Eye, EyeOff } from "lucide-react";

const DEFAULT_API_PASSWORD = "Kingbond@123";

interface APIKey {
  id: string;
  service_name: string;
  api_key: string;
  is_active: boolean;
  priority: number;
  usage_count: number;
  last_used_at: string | null;
}

const SERVICE_NAMES = {
  coinmarketcap: "CoinMarketCap",
  currencyfreaks: "CurrencyFreaks",
  goldapi: "GoldAPI.net",
  taapi: "TAAPI"
};

export const AdminAPIManagement = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [activeService, setActiveService] = useState<keyof typeof SERVICE_NAMES>("coinmarketcap");
  const [newKeys, setNewKeys] = useState<string[]>(Array(10).fill(""));
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [storedPassword, setStoredPassword] = useState<string | null>(null);

  useEffect(() => {
    fetchStoredPassword();
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      fetchAPIKeys();
    }
  }, [isUnlocked]);

  const fetchStoredPassword = async () => {
    const { data } = await supabase
      .from("payment_settings")
      .select("setting_value")
      .eq("setting_key", "api_management_password")
      .maybeSingle();
    
    if (data?.setting_value) {
      setStoredPassword(data.setting_value);
    }
  };

  const fetchAPIKeys = async () => {
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("service_name")
      .order("priority");
    
    if (error) {
      toast.error("Failed to fetch API keys");
      return;
    }
    
    setApiKeys(data || []);
  };

  const handleUnlock = () => {
    const correctPassword = storedPassword || DEFAULT_API_PASSWORD;
    if (password === correctPassword) {
      setIsUnlocked(true);
      setPassword("");
      toast.success("API Management unlocked");
    } else {
      toast.error("Incorrect password");
    }
  };

  const getServiceKeys = (service: string) => {
    return apiKeys.filter(k => k.service_name === service).sort((a, b) => a.priority - b.priority);
  };

  const handleSaveKeys = async () => {
    const keysToSave = newKeys.filter(k => k.trim() !== "");
    
    if (keysToSave.length === 0) {
      toast.error("Please enter at least one API key");
      return;
    }

    try {
      // Delete existing keys for this service
      const { error: deleteError } = await supabase
        .from("api_keys")
        .delete()
        .eq("service_name", activeService);

      if (deleteError) throw deleteError;

      // Insert new keys with priorities
      const insertData = keysToSave.map((key, index) => ({
        service_name: activeService,
        api_key: key.trim(),
        priority: index + 1,
        is_active: index === 0 // First key is active by default
      }));

      const { error: insertError } = await supabase
        .from("api_keys")
        .insert(insertData);

      if (insertError) throw insertError;

      toast.success(`${SERVICE_NAMES[activeService]} API keys saved successfully`);
      setNewKeys(Array(10).fill(""));
      fetchAPIKeys();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggleActive = async (keyId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("api_keys")
      .update({ is_active: !currentStatus })
      .eq("id", keyId);

    if (error) {
      toast.error("Failed to update API key status");
      return;
    }

    toast.success("API key status updated");
    fetchAPIKeys();
  };

  const handleDeleteKey = async (keyId: string) => {
    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", keyId);

    if (error) {
      toast.error("Failed to delete API key");
      return;
    }

    toast.success("API key deleted");
    fetchAPIKeys();
  };

  const renderServiceTab = (service: keyof typeof SERVICE_NAMES) => {
    const serviceKeys = getServiceKeys(service);

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Current {SERVICE_NAMES[service]} Keys</h3>
          {serviceKeys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Usage Count</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>#{key.priority}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {key.api_key.substring(0, 20)}...
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={key.is_active}
                        onCheckedChange={() => handleToggleActive(key.id, key.is_active)}
                      />
                    </TableCell>
                    <TableCell>{key.usage_count}</TableCell>
                    <TableCell className="text-xs">
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteKey(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No API keys configured</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Update {SERVICE_NAMES[service]} Keys</h3>
          <div className="space-y-4">
            {[...Array(10)].map((_, index) => (
              <div key={index}>
                <Label>API Key #{index + 1} (Priority {index + 1})</Label>
                <Input
                  type="text"
                  placeholder={`Enter ${SERVICE_NAMES[service]} API key ${index + 1}`}
                  value={newKeys[index] || ""}
                  onChange={(e) => {
                    const updated = [...newKeys];
                    updated[index] = e.target.value;
                    setNewKeys(updated);
                  }}
                />
              </div>
            ))}
            <Button onClick={handleSaveKeys} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save All Keys
            </Button>
            <p className="text-sm text-muted-foreground">
              Keys will auto-rotate when limits are reached. Priority 1 is used first, then Priority 2, and so on.
            </p>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">API Management</h2>
        <p className="text-muted-foreground">
          Manage multiple API keys for auto-rotation when limits are reached
        </p>
      </div>

      {!isUnlocked ? (
        <Card className="p-8 max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Password Protected</h3>
            <p className="text-muted-foreground text-sm">
              Enter the password to access API management
            </p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <Label htmlFor="api-password">Password</Label>
              <div className="relative mt-2">
                <Input
                  id="api-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  placeholder="Enter password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleUnlock} className="w-full">
              <Lock className="h-4 w-4 mr-2" />
              Unlock
            </Button>
          </div>
        </Card>
      ) : (
        <Tabs value={activeService} onValueChange={(v) => setActiveService(v as keyof typeof SERVICE_NAMES)}>
          <TabsList className="grid grid-cols-4 w-full">
            {Object.entries(SERVICE_NAMES).map(([key, name]) => (
              <TabsTrigger key={key} value={key}>
                {name}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {Object.keys(SERVICE_NAMES).map((service) => (
            <TabsContent key={service} value={service}>
              {renderServiceTab(service as keyof typeof SERVICE_NAMES)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

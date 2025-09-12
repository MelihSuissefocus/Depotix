import { useState, useEffect } from "react";
import { customerAPI } from "@/lib/api";

export interface CustomerOption {
  id: number;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  is_active?: boolean;
}

export function useCustomerOptions(search: string = "") {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCustomers = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await customerAPI.getCustomers({ search });
        setCustomers(response.results || response || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden der Kunden");
        setCustomers([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCustomers();
  }, [search]);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await customerAPI.getCustomers({ search });
      setCustomers(response.results || response || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Kunden");
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  return { customers, isLoading, error, refetch };
}

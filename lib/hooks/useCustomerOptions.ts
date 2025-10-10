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
    // Only search if there's a search term with at least 2 characters
    if (!search || search.trim().length < 2) {
      setCustomers([]);
      return;
    }

    const loadCustomers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await customerAPI.getCustomers({ search: search.trim() });
        setCustomers(response.results || response || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden der Kunden");
        setCustomers([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce: wait 300ms after user stops typing
    const timeoutId = setTimeout(() => {
      loadCustomers();
    }, 300);

    // Cleanup: cancel previous timeout if user keeps typing
    return () => clearTimeout(timeoutId);
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

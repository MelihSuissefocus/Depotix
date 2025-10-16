"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Dashboard() {
  const { user } = useAuth();
  const [einnahmen, setEinnahmen] = useState<number>(0);
  const [ausgaben, setAusgaben] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        setIsLoading(true);

        // Get auth token from localStorage
        const tokensStr = localStorage.getItem("auth_tokens");
        const tokens = tokensStr ? JSON.parse(tokensStr) : null;
        const token = tokens?.access;

        if (!token) {
          throw new Error('Keine Authentifizierung vorhanden');
        }

        // Fetch Invoices (Einnahmen)
        const invoicesResponse = await fetch('/api/invoices/', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        // Fetch Expenses (Ausgaben)
        const expensesResponse = await fetch('/api/expenses/', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!invoicesResponse.ok || !expensesResponse.ok) {
          throw new Error('Fehler beim Laden der Finanzdaten');
        }

        const invoicesData = await invoicesResponse.json();
        const expensesData = await expensesResponse.json();

        // Berechne Gesamtsumme aller Rechnungen (Einnahmen)
        const totalEinnahmen = Array.isArray(invoicesData)
          ? invoicesData.reduce((sum, invoice) => sum + Number(invoice.total_gross || 0), 0)
          : (invoicesData.results || []).reduce((sum: number, invoice: any) => sum + Number(invoice.total_gross || 0), 0);

        // Berechne Gesamtsumme aller Ausgaben
        const totalAusgaben = Array.isArray(expensesData)
          ? expensesData.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
          : (expensesData.results || []).reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0);

        setEinnahmen(totalEinnahmen);
        setAusgaben(totalAusgaben);
      } catch (err) {
        setError("Finanzdaten konnten nicht geladen werden");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinancialData();
  }, []);

  const saldo = einnahmen - ausgaben;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2">Dashboard wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-500">
          <AlertTriangle className="h-8 w-8 mx-auto" />
          <p className="mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-1">
            Bitte überprüfen Sie Ihre API-Verbindung
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold">
          Willkommen, {user?.first_name || user?.username}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Einnahmen Card */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium text-green-900">
              Einnahmen
            </CardTitle>
            <TrendingUp className="h-6 w-6 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">
              CHF {einnahmen.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-green-700 mt-2">
              Gesamteinnahmen aus allen Rechnungen
            </p>
          </CardContent>
        </Card>

        {/* Ausgaben Card */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium text-red-900">
              Ausgaben
            </CardTitle>
            <TrendingDown className="h-6 w-6 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">
              CHF {ausgaben.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-red-700 mt-2">
              Gesamtausgaben aus allen Belegen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Saldo Card */}
      <Card className={saldo >= 0 ? "border-blue-200 bg-blue-50" : "border-orange-200 bg-orange-50"}>
        <CardHeader>
          <CardTitle className={saldo >= 0 ? "text-blue-900" : "text-orange-900"}>
            Saldo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-4xl font-bold ${saldo >= 0 ? "text-blue-900" : "text-orange-900"}`}>
            CHF {saldo.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className={`text-sm mt-2 ${saldo >= 0 ? "text-blue-700" : "text-orange-700"}`}>
            {saldo >= 0 ? "Positiver Saldo" : "Negativer Saldo"} (Einnahmen - Ausgaben)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

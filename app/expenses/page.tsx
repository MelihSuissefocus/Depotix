"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { expensesAPI, supplierAPI } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";

// Kategorie-Optionen für Ausgaben
const EXPENSE_CATEGORIES = {
  PURCHASE: "Einkauf",
  TRANSPORT: "Transport",
  UTILITIES: "Nebenkosten",
  MAINTENANCE: "Wartung",
  OFFICE: "Büro",
  MARKETING: "Marketing",
  OTHER: "Sonstiges",
} as const;

// Debounce hook für Suche
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<number>(0);

  // Form data
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    amount: "",
    category: "" as keyof typeof EXPENSE_CATEGORIES | "",
    supplier: "none",
    receipt_number: "",
    notes: "",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Debounced search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Form validation
  const validateForm = () => {
    const errs: Record<string, string> = {};

    if (!formData.date.trim()) {
      errs.date = "Datum ist Pflicht";
    }
    if (!formData.description.trim()) {
      errs.description = "Beschreibung ist Pflicht";
    }
    if (!formData.amount.trim()) {
      errs.amount = "Betrag ist Pflicht";
    } else {
      const amount = Number.parseFloat(formData.amount);
      if (Number.isNaN(amount) || amount <= 0) {
        errs.amount = "Betrag muss > 0 sein";
      }
    }
    if (!formData.category) {
      errs.category = "Kategorie ist Pflicht";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const inputClass = (field: string) =>
    `${errors[field] ? "border-red-500 focus-visible:ring-red-500" : ""}`;

  // Fetch data function
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: any = {
        page: currentPage,
        ordering: "-date",
      };
      
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch;
      }
      if (categoryFilter !== "all") {
        params.category = categoryFilter;
      }
      if (dateFrom) {
        params.date_after = dateFrom;
      }
      if (dateTo) {
        params.date_before = dateTo;
      }

      const [expensesData, suppliersData] = await Promise.all([
        expensesAPI.list(params),
        supplierAPI.getSuppliers(),
      ]);

      // Handle paginated response
      if (expensesData && typeof expensesData === 'object' && 'results' in expensesData) {
        setExpenses(expensesData.results || []);
        setTotalPages(Math.ceil((expensesData.count || 0) / 20));
      } else {
        setExpenses(Array.isArray(expensesData) ? expensesData : []);
      }

      setSuppliers(Array.isArray(suppliersData) ? suppliersData : suppliersData.results || []);

      // Calculate monthly summary for current month
      await calculateMonthlySummary();
    } catch (err) {
      console.error("Failed to fetch expenses data:", err);
      setError("Ausgabendaten konnten nicht geladen werden");
      toast.error("Ausgabendaten konnten nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate monthly summary
  const calculateMonthlySummary = async () => {
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const monthlyData = await expensesAPI.list({
        date_after: firstDay,
        date_before: lastDay,
      });

      const expenses = Array.isArray(monthlyData) ? monthlyData : monthlyData.results || [];
      const total = expenses.reduce((sum: number, expense: Expense) => {
        return sum + parseFloat(expense.amount);
      }, 0);

      setMonthlySummary(total);
    } catch (err) {
      console.error("Failed to calculate monthly summary:", err);
    }
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    fetchData();
  }, [currentPage, debouncedSearch, categoryFilter, dateFrom, dateTo]);

  // Reset form
  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: "",
      amount: "",
      category: "",
      supplier: "none",
      receipt_number: "",
      notes: "",
    });
    setReceiptFile(null);
    setErrors({});
  };

  // Create expense
  const handleCreate = async () => {
    if (!validateForm()) {
      toast.error("Bitte alle Pflichtfelder korrekt ausfüllen");
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('date', formData.date);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('category', formData.category);

      if (formData.supplier && formData.supplier !== "none") {
        formDataToSend.append('supplier', formData.supplier);
      }

      if (formData.receipt_number) {
        formDataToSend.append('receipt_number', formData.receipt_number);
      }

      if (formData.notes) {
        formDataToSend.append('notes', formData.notes);
      }

      if (receiptFile) {
        formDataToSend.append('receipt_pdf', receiptFile);
      }

      // Use fetch directly for FormData
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/inventory/expenses/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem("auth_tokens") || '{}').access}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchData();
      setIsCreateDialogOpen(false);
      resetForm();
      toast.success("Ausgabe erfolgreich erstellt");
    } catch (err) {
      console.error("Failed to create expense:", err);
      toast.error("Ausgabe konnte nicht erstellt werden");
    }
  };

  // Update expense
  const handleUpdate = async () => {
    if (!selectedExpense || !validateForm()) {
      toast.error("Bitte alle Pflichtfelder korrekt ausfüllen");
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('date', formData.date);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('category', formData.category);

      if (formData.supplier && formData.supplier !== "none") {
        formDataToSend.append('supplier', formData.supplier);
      }

      if (formData.receipt_number) {
        formDataToSend.append('receipt_number', formData.receipt_number);
      }

      if (formData.notes) {
        formDataToSend.append('notes', formData.notes);
      }

      if (receiptFile) {
        formDataToSend.append('receipt_pdf', receiptFile);
      }

      // Use fetch directly for FormData
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/inventory/expenses/${selectedExpense.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem("auth_tokens") || '{}').access}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchData();
      setIsEditDialogOpen(false);
      setSelectedExpense(null);
      resetForm();
      toast.success("Ausgabe erfolgreich aktualisiert");
    } catch (err) {
      console.error("Failed to update expense:", err);
      toast.error("Ausgabe konnte nicht aktualisiert werden");
    }
  };

  // Delete expense
  const handleDelete = async () => {
    if (!selectedExpense) return;

    try {
      await expensesAPI.remove(selectedExpense.id!);
      await fetchData();
      setIsDeleteDialogOpen(false);
      setSelectedExpense(null);
      toast.success("Ausgabe erfolgreich gelöscht");
    } catch (err) {
      console.error("Failed to delete expense:", err);
      toast.error("Ausgabe konnte nicht gelöscht werden");
    }
  };

  // Open edit dialog
  const openEditDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setFormData({
      date: expense.date,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      supplier: expense.supplier ? expense.supplier.toString() : "none",
      receipt_number: expense.receipt_number || "",
      notes: expense.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  // Download receipt PDF
  const handleDownloadReceipt = async (expense: Expense) => {
    if (!expense.receipt_pdf) return;

    try {
      const response = await fetch(expense.receipt_pdf, {
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem("auth_tokens") || '{}').access}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rechnung_${expense.receipt_number || expense.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("PDF heruntergeladen");
    } catch (err) {
      console.error("Failed to download receipt:", err);
      toast.error("PDF konnte nicht heruntergeladen werden");
    }
  };

  // Format currency
  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('de-CH').format(new Date(dateString));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2">Ausgabendaten werden geladen...</p>
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
    <div className="space-y-4">
      {/* Header with KPI */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ausgaben</h1>
          <div className="mt-2 flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Summe aktueller Monat: <span className="font-semibold text-lg">{formatCurrency(monthlySummary)}</span>
            </div>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Ausgabe hinzufügen
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex items-center relative flex-1">
              <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Beschreibung oder Beleg-Nr. suchen..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date filters */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
              <span className="text-muted-foreground">bis</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead>Beleg-Nr.</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length > 0 ? (
                expenses.map((expense) => {
                  const supplier = suppliers.find(s => s.id === expense.supplier);
                  return (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={expense.description}>
                        {expense.description}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {EXPENSE_CATEGORIES[expense.category]}
                        </Badge>
                      </TableCell>
                      <TableCell>{supplier?.name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {expense.receipt_number || "-"}
                          {expense.receipt_pdf && (
                            <FileText className="h-4 w-4 text-blue-600" title="PDF vorhanden" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Aktionen</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {expense.receipt_pdf && (
                              <>
                                <DropdownMenuItem onClick={() => handleDownloadReceipt(expense)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  PDF herunterladen
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => openEditDialog(expense)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedExpense(expense);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Keine Ausgaben gefunden.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-600">
                Seite {currentPage} von {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Neue Ausgabe erstellen</DialogTitle>
            <DialogDescription>
              Geben Sie die Details für die neue Ausgabe ein.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Datum <span className="text-red-500">*</span></Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    setFormData({ ...formData, date: e.target.value });
                    if (errors.date) setErrors(prev => ({ ...prev, date: "" }));
                  }}
                  className={inputClass("date")}
                />
                {errors.date && <p className="text-xs text-red-600">{errors.date}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Betrag (CHF) <span className="text-red-500">*</span></Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData({ ...formData, amount: e.target.value });
                    if (errors.amount) setErrors(prev => ({ ...prev, amount: "" }));
                  }}
                  className={inputClass("amount")}
                />
                {errors.amount && <p className="text-xs text-red-600">{errors.amount}</p>}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung <span className="text-red-500">*</span></Label>
              <Input
                id="description"
                maxLength={500}
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (errors.description) setErrors(prev => ({ ...prev, description: "" }));
                }}
                className={inputClass("description")}
              />
              {errors.description && <p className="text-xs text-red-600">{errors.description}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategorie <span className="text-red-500">*</span></Label>
              <Select
                value={formData.category}
                onValueChange={(value) => {
                  setFormData({ ...formData, category: value as keyof typeof EXPENSE_CATEGORIES });
                  if (errors.category) setErrors(prev => ({ ...prev, category: "" }));
                }}
              >
                <SelectTrigger className={inputClass("category")}>
                  <SelectValue placeholder="Kategorie auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-red-600">{errors.category}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Lieferant (optional)</Label>
                <Select
                  value={formData.supplier}
                  onValueChange={(value) => setFormData({ ...formData, supplier: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Lieferant auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Lieferant</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receipt_number">Beleg-Nr. (optional)</Label>
                <Input
                  id="receipt_number"
                  value={formData.receipt_number}
                  onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notizen (optional)</Label>
              <Textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt_pdf">Rechnung PDF (optional)</Label>
              <Input
                id="receipt_pdf"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.type === 'application/pdf') {
                      setReceiptFile(file);
                    } else {
                      toast.error("Nur PDF-Dateien sind erlaubt");
                      e.target.value = '';
                    }
                  }
                }}
              />
              {receiptFile && (
                <p className="text-xs text-green-600">✓ {receiptFile.name} ausgewählt</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate}>Ausgabe erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { resetForm(); setSelectedExpense(null); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ausgabe bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Details der Ausgabe.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Datum <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    setFormData({ ...formData, date: e.target.value });
                    if (errors.date) setErrors(prev => ({ ...prev, date: "" }));
                  }}
                  className={inputClass("date")}
                />
                {errors.date && <p className="text-xs text-red-600">{errors.date}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Betrag (CHF) <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData({ ...formData, amount: e.target.value });
                    if (errors.amount) setErrors(prev => ({ ...prev, amount: "" }));
                  }}
                  className={inputClass("amount")}
                />
                {errors.amount && <p className="text-xs text-red-600">{errors.amount}</p>}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Beschreibung <span className="text-red-500">*</span></Label>
              <Input
                id="edit-description"
                maxLength={500}
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (errors.description) setErrors(prev => ({ ...prev, description: "" }));
                }}
                className={inputClass("description")}
              />
              {errors.description && <p className="text-xs text-red-600">{errors.description}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Kategorie <span className="text-red-500">*</span></Label>
              <Select
                value={formData.category}
                onValueChange={(value) => {
                  setFormData({ ...formData, category: value as keyof typeof EXPENSE_CATEGORIES });
                  if (errors.category) setErrors(prev => ({ ...prev, category: "" }));
                }}
              >
                <SelectTrigger className={inputClass("category")}>
                  <SelectValue placeholder="Kategorie auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-red-600">{errors.category}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-supplier">Lieferant (optional)</Label>
                <Select
                  value={formData.supplier}
                  onValueChange={(value) => setFormData({ ...formData, supplier: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Lieferant auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Lieferant</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-receipt_number">Beleg-Nr. (optional)</Label>
                <Input
                  id="edit-receipt_number"
                  value={formData.receipt_number}
                  onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notizen (optional)</Label>
              <Textarea
                id="edit-notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-receipt_pdf">Rechnung PDF (optional)</Label>
              <Input
                id="edit-receipt_pdf"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.type === 'application/pdf') {
                      setReceiptFile(file);
                    } else {
                      toast.error("Nur PDF-Dateien sind erlaubt");
                      e.target.value = '';
                    }
                  }
                }}
              />
              {receiptFile && (
                <p className="text-xs text-green-600">✓ {receiptFile.name} ausgewählt</p>
              )}
              {selectedExpense?.receipt_pdf && !receiptFile && (
                <p className="text-xs text-gray-500">Aktuell: PDF vorhanden</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdate}>Ausgabe aktualisieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Ausgabe löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie diese Ausgabe löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedExpense && (
              <div className="space-y-2 text-sm">
                <div><strong>Datum:</strong> {formatDate(selectedExpense.date)}</div>
                <div><strong>Beschreibung:</strong> {selectedExpense.description}</div>
                <div><strong>Betrag:</strong> {formatCurrency(selectedExpense.amount)}</div>
                <div><strong>Kategorie:</strong> {EXPENSE_CATEGORIES[selectedExpense.category]}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

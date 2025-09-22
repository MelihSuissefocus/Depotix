"use client";

import { useEffect, useState, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { customerAPI } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import toast from "react-hot-toast";

interface CustomerListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Customer[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Form states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Customer>({
    name: "",
    customer_number: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    shipping_address: "",
    tax_id: "",
    payment_terms: "",
    notes: "",
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load customers
  const loadCustomers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response: CustomerListResponse = await customerAPI.getCustomers({
        search: debouncedSearch,
        page: currentPage,
        ordering: "name",
      });

      if (response.results) {
        setCustomers(response.results);
        setTotalCount(response.count);
        setHasNextPage(!!response.next);
        setHasPrevPage(!!response.previous);
      } else {
        // Fallback for non-paginated response
        setCustomers(Array.isArray(response) ? response : []);
        setTotalCount(Array.isArray(response) ? response.length : 0);
        setHasNextPage(false);
        setHasPrevPage(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Kunden");
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [debouncedSearch, currentPage]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      customer_number: "",
      contact_name: "",
      email: "",
      phone: "",
      address: "",
      shipping_address: "",
      tax_id: "",
      payment_terms: "",
      notes: "",
      is_active: true,
    });
    setFormErrors({});
    setSelectedCustomer(null);
  };

  // Handle form field changes
  const handleFieldChange = (field: keyof Customer, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = "Firmenname ist erforderlich";
    }

    if (!formData.customer_number?.trim()) {
      errors.customer_number = "Kundennummer ist erforderlich";
    } else {
      const customerNum = formData.customer_number.trim();

      // Check if it's exactly 4 digits
      if (!/^\d{4}$/.test(customerNum)) {
        errors.customer_number = "Kundennummer muss genau 4 Ziffern haben";
      } else {
        // Check if it's >= 1000
        const num = parseInt(customerNum, 10);
        if (num < 1000) {
          errors.customer_number = "Kundennummer muss mindestens 1000 sein";
        }
      }
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = "Ungültige E-Mail-Adresse";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle create customer
  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await customerAPI.createCustomer(formData);
      toast.success("Kunde erfolgreich erstellt");
      setIsAddDialogOpen(false);
      resetForm();
      loadCustomers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Fehler beim Erstellen des Kunden";

      // Handle validation errors from backend
      if (errorMessage.includes("400")) {
        if (errorMessage.includes("customer_number")) {
          if (errorMessage.includes("bereits vergeben")) {
            setFormErrors(prev => ({ ...prev, customer_number: "Diese Kundennummer ist bereits vergeben" }));
          } else {
            setFormErrors(prev => ({ ...prev, customer_number: "Ungültige Kundennummer" }));
          }
        } else {
          toast.error("Überprüfen Sie Ihre Eingaben");
        }
      } else if (errorMessage.includes("409") || errorMessage.includes("422")) {
        toast.error("Ein Kunde mit diesen Daten existiert bereits");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit customer
  const handleEdit = async () => {
    if (!selectedCustomer || !validateForm()) return;

    setIsSubmitting(true);
    try {
      await customerAPI.updateCustomer(selectedCustomer.id!, formData);
      toast.success("Kunde erfolgreich aktualisiert");
      setIsEditDialogOpen(false);
      resetForm();
      loadCustomers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Fehler beim Aktualisieren des Kunden";

      // Handle validation errors from backend
      if (errorMessage.includes("400")) {
        if (errorMessage.includes("customer_number")) {
          if (errorMessage.includes("bereits vergeben")) {
            setFormErrors(prev => ({ ...prev, customer_number: "Diese Kundennummer ist bereits vergeben" }));
          } else {
            setFormErrors(prev => ({ ...prev, customer_number: "Ungültige Kundennummer" }));
          }
        } else {
          toast.error("Überprüfen Sie Ihre Eingaben");
        }
      } else if (errorMessage.includes("409") || errorMessage.includes("422")) {
        toast.error("Ein Kunde mit diesen Daten existiert bereits");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete customer
  const handleDelete = async () => {
    if (!selectedCustomer) return;

    setIsSubmitting(true);
    try {
      await customerAPI.deleteCustomer(selectedCustomer.id!);
      toast.success("Kunde erfolgreich gelöscht");
      setIsDeleteDialogOpen(false);
      resetForm();
      loadCustomers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Fehler beim Löschen des Kunden";
      
      if (errorMessage.includes("403")) {
        toast.error("Keine Berechtigung zum Löschen dieses Kunden");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name || "",
      customer_number: customer.customer_number || "",
      contact_name: customer.contact_name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      shipping_address: customer.shipping_address || "",
      tax_id: customer.tax_id || "",
      payment_terms: customer.payment_terms || "",
      notes: customer.notes || "",
      is_active: customer.is_active ?? true,
    });
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteDialogOpen(true);
  };

  // Pagination
  const handlePrevPage = () => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Fehler: {error}</span>
            </div>
            <Button onClick={loadCustomers} className="mt-4">
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Kunden</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Kunde hinzufügen
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Nach Name oder E-Mail suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kundennummer</TableHead>
                <TableHead>Firmenname</TableHead>
                <TableHead>Ansprechperson</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Lade Kunden...
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {debouncedSearch
                      ? "Keine Kunden gefunden für Ihre Suche"
                      : "Noch keine Kunden vorhanden"}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-mono text-sm">
                      {customer.customer_number || (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      {customer.contact_name || (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.email || (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.phone || (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.is_active ? "default" : "secondary"}>
                        {customer.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(customer)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {(hasNextPage || hasPrevPage) && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-gray-500">
                {totalCount > 0 && (
                  <>Seite {currentPage} von {Math.ceil(totalCount / 20)} • {totalCount} Kunden insgesamt</>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={!hasPrevPage}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Zurück
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!hasNextPage}
                >
                  Weiter
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuen Kunden hinzufügen</DialogTitle>
            <DialogDescription>
              Geben Sie die Informationen für den neuen Kunden ein.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="name">Firmenname *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="customer_number">Kundennummer *</Label>
              <Input
                id="customer_number"
                value={formData.customer_number || ""}
                onChange={(e) => handleFieldChange("customer_number", e.target.value)}
                placeholder="4-stellige Nummer (ab 1000)"
                maxLength={4}
                pattern="\d{4}"
                className={formErrors.customer_number ? "border-red-500" : ""}
              />
              {formErrors.customer_number && (
                <p className="text-sm text-red-500 mt-1">{formErrors.customer_number}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_name">Ansprechperson</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name || ""}
                  onChange={(e) => handleFieldChange("contact_name", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={formData.phone || ""}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                className={formErrors.email ? "border-red-500" : ""}
              />
              {formErrors.email && (
                <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="address">Rechnungsadresse</Label>
              <Textarea
                id="address"
                value={formData.address || ""}
                onChange={(e) => handleFieldChange("address", e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="shipping_address">Lieferadresse</Label>
              <Textarea
                id="shipping_address"
                value={formData.shipping_address || ""}
                onChange={(e) => handleFieldChange("shipping_address", e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tax_id">USt-/MWST-Nr.</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id || ""}
                  onChange={(e) => handleFieldChange("tax_id", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="payment_terms">Zahlungsbedingungen</Label>
                <Input
                  id="payment_terms"
                  value={formData.payment_terms || ""}
                  onChange={(e) => handleFieldChange("payment_terms", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleFieldChange("is_active", checked)}
              />
              <Label htmlFor="is_active">Kunde ist aktiv</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                resetForm();
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? "Erstelle..." : "Kunde erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kunde bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Informationen für "{selectedCustomer?.name}".
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="edit_name">Firmenname *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="edit_customer_number">Kundennummer *</Label>
              <Input
                id="edit_customer_number"
                value={formData.customer_number || ""}
                onChange={(e) => handleFieldChange("customer_number", e.target.value)}
                placeholder="4-stellige Nummer (ab 1000)"
                maxLength={4}
                pattern="\d{4}"
                className={formErrors.customer_number ? "border-red-500" : ""}
              />
              {formErrors.customer_number && (
                <p className="text-sm text-red-500 mt-1">{formErrors.customer_number}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_contact_name">Ansprechperson</Label>
                <Input
                  id="edit_contact_name"
                  value={formData.contact_name || ""}
                  onChange={(e) => handleFieldChange("contact_name", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit_phone">Telefon</Label>
                <Input
                  id="edit_phone"
                  value={formData.phone || ""}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_email">E-Mail</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                className={formErrors.email ? "border-red-500" : ""}
              />
              {formErrors.email && (
                <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="edit_address">Rechnungsadresse</Label>
              <Textarea
                id="edit_address"
                value={formData.address || ""}
                onChange={(e) => handleFieldChange("address", e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="edit_shipping_address">Lieferadresse</Label>
              <Textarea
                id="edit_shipping_address"
                value={formData.shipping_address || ""}
                onChange={(e) => handleFieldChange("shipping_address", e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_tax_id">USt-/MWST-Nr.</Label>
                <Input
                  id="edit_tax_id"
                  value={formData.tax_id || ""}
                  onChange={(e) => handleFieldChange("tax_id", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit_payment_terms">Zahlungsbedingungen</Label>
                <Input
                  id="edit_payment_terms"
                  value={formData.payment_terms || ""}
                  onChange={(e) => handleFieldChange("payment_terms", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_notes">Notizen</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes || ""}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleFieldChange("is_active", checked)}
              />
              <Label htmlFor="edit_is_active">Kunde ist aktiv</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting ? "Speichere..." : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kunde löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie den Kunden "{selectedCustomer?.name}" löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                resetForm();
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Lösche..." : "Kunde löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

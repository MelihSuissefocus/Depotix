"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  Edit,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import {
  inventoryAPI,
  categoryAPI,
  supplierAPI,
  logAPI,
  itemSupplierAPI,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "react-hot-toast";

export default function InventoryItemPage() {
  const router = useRouter();
  const params = useParams();

  const itemId = Number(params.id);

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [itemSuppliers, setItemSuppliers] = useState<InventoryItemSupplier[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InventoryItem>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [isAddSupplierDialogOpen, setIsAddSupplierDialogOpen] = useState(false);
  const [isEditSupplierDialogOpen, setIsEditSupplierDialogOpen] = useState(false);
  const [isDeleteSupplierDialogOpen, setIsDeleteSupplierDialogOpen] = useState(false);
  const [selectedItemSupplier, setSelectedItemSupplier] = useState<InventoryItemSupplier | null>(null);
  const [newItemSupplier, setNewItemSupplier] = useState<
    Partial<InventoryItemSupplier>
  >({
    supplier: 0,
    supplier_sku: "",
    supplier_price: "",
    lead_time_days: 0,
    notes: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // First fetch the item itself. If this fails we cannot edit, so abort.
        let itemData: any = null
        try {
          itemData = await inventoryAPI.getItem(itemId)
          setItem(itemData)
          setFormData(itemData)
        } catch (err) {
          console.error("Failed to fetch item:", err)
          setError("Failed to fetch item data")
          return
        }

        // Load auxiliary data (categories, suppliers, logs) but don't fail the whole page
        try {
          const [categoriesData, suppliersData, logsData] = await Promise.all([
            categoryAPI.getCategories(),
            supplierAPI.getSuppliers(),
            logAPI.getItemLogs(itemId),
          ])

          const suppliersArray = Array.isArray(suppliersData)
            ? suppliersData
            : suppliersData.results || []
          setSuppliers(suppliersArray)

          const itemLogs = Array.isArray(logsData) ? logsData : logsData.results || []
          setLogs(itemLogs)

          const categoriesArray = Array.isArray(categoriesData)
            ? categoriesData
            : categoriesData.results || []
          setCategories(categoriesArray)
        } catch (auxErr) {
          // Log but don't block editing the item
          console.error("Failed to load categories/suppliers/logs:", auxErr)
        }

        const itemSuppliersArray = Array.isArray(itemData.suppliers)
          ? itemData.suppliers
          : itemData.suppliers || []
        setItemSuppliers(itemSuppliersArray)
      } catch (err) {
        setError("Failed to fetch item data")
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [itemId]);

  const handleSave = async () => {
    if (!item) return;

    try {
      setIsSaving(true);
      if (item.id !== undefined) {
        await inventoryAPI.updateItem(item.id, {
          ...formData,
          name: formData.name || "",
          sku: formData.sku || "",
          description: formData.description || "",
          location: formData.location || "",
          palette_quantity: Number(formData.palette_quantity) || 0,
          verpackung_quantity: Number(formData.verpackung_quantity) || 0,
          price: formData.price?.toString() ?? "",
          price_per_palette: formData.price_per_palette?.toString() || null,
          price_per_verpackung: formData.price_per_verpackung?.toString() || null,
          category: formData.category ? Number(formData.category) : null,
          low_stock_threshold: Number(formData.low_stock_threshold),
          verpackungen_pro_palette: Number(formData.verpackungen_pro_palette) || 1,
          stueck_pro_verpackung: Number(formData.stueck_pro_verpackung) || 1,
        });
      } else {
        throw new Error("Item ID is undefined");
      }

      if (item.id !== undefined) {
        const updatedItem = await inventoryAPI.getItem(item.id);
        setItem(updatedItem);
        setFormData(updatedItem);
      } else {
        throw new Error("Item ID is undefined");
      }

      toast.success("Item updated successfully");

      router.push("/inventory");
    } catch (err) {
      console.error("Failed to update item:", err);
      toast.error("Failed to update item. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItemSupplier = async () => {
    if (!item) return;

    try {
      const data: InventoryItemSupplier = {
        id: 0,
        item: item.id || 0,
        supplier: Number(newItemSupplier.supplier),
        supplier_sku: newItemSupplier.supplier_sku || null,
        supplier_price: newItemSupplier.supplier_price || "0",
        lead_time_days: newItemSupplier.lead_time_days || null,
        notes: newItemSupplier.notes || null,
      };

      await itemSupplierAPI.createItemSupplier(data);

      const itemData = await inventoryAPI.getItem(itemId);
      const updatedItemSuppliers = itemData.suppliers;

      setItemSuppliers(updatedItemSuppliers);

      // Reset form and close dialog
      setNewItemSupplier({
        supplier: 0,
        supplier_sku: "",
        supplier_price: "",
        lead_time_days: 0,
        notes: "",
      });
      setIsAddSupplierDialogOpen(false);

      toast.success("Supplier added successfully");
    } catch (err) {
      console.error("Failed to add supplier to item:", err);
      toast.error("Failed to add supplier to item. Please try again.");
    }
  };

  const handleEditItemSupplier = async () => {
    if (!selectedItemSupplier?.id) return;

    try {
      const data: InventoryItemSupplier = {
        id: 0,
        item: item?.id || 0,
        supplier: Number(newItemSupplier.supplier),
        supplier_sku: newItemSupplier.supplier_sku || null,
        supplier_price: newItemSupplier.supplier_price || "0",
        lead_time_days: newItemSupplier.lead_time_days || null,
        notes: newItemSupplier.notes || null,
      };

      await itemSupplierAPI.updateItemSupplier(selectedItemSupplier.id, data);

      const itemData = await inventoryAPI.getItem(itemId);
      const updatedItemSuppliers = itemData.suppliers;

      setItemSuppliers(updatedItemSuppliers);

      setSelectedItemSupplier(null);
      setNewItemSupplier({
        supplier: 0,
        supplier_sku: "",
        supplier_price: "",
        lead_time_days: 0,
        notes: "",
      });
      setIsEditSupplierDialogOpen(false);

      toast.success("Supplier updated successfully");
    } catch (err) {
      console.error("Failed to update supplier:", err);
      toast.error("Failed to update supplier. Please try again.");
    }
  };

  const handleDeleteItemSupplier = async () => {
    if (!selectedItemSupplier?.id) return;

    try {
      await itemSupplierAPI.deleteItemSupplier(selectedItemSupplier.id);

      const itemData = await inventoryAPI.getItem(itemId);
      const updatedItemSuppliers = itemData.suppliers;

      setItemSuppliers(updatedItemSuppliers);

      // Reset selected item and close dialog
      setSelectedItemSupplier(null);
      setIsDeleteSupplierDialogOpen(false);

      toast.success("Supplier deleted successfully");
    } catch (err) {
      console.error("Failed to delete supplier:", err);
      toast.error("Failed to delete supplier. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2">Artikeldaten werden geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-500">
          <AlertTriangle className="h-8 w-8 mx-auto" />
          <p className="mt-2">{error || "Artikel nicht gefunden"}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/inventory")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Lager
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.push("/inventory")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFormData(item)}>
            Zurücksetzen
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Speichert..." : "Änderungen speichern"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="suppliers">Lieferanten</TabsTrigger>
          <TabsTrigger value="history">Verlauf</TabsTrigger>
        </TabsList>

        {/* Item Details Tab */}
        <TabsContent value="details" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Artikeldetails</CardTitle>
              <CardDescription>
                Sehen und bearbeiten Sie die Details dieses Lagerartikels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">                  <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              {/* Lagerbestände */}
              <div className="space-y-4">
                <h5 className="text-sm font-medium text-gray-700">Lagerbestände</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="palette_quantity">Paletten</Label>
                    <Input
                      id="palette_quantity"
                      type="number"
                      min="0"
                      value={formData.palette_quantity || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          palette_quantity: Number.parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verpackung_quantity">Verpackungen</Label>
                    <Input
                      id="verpackung_quantity"
                      type="number"
                      min="0"
                      value={formData.verpackung_quantity || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          verpackung_quantity: Number.parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Verkaufspreis/Verpackung (CHF)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_per_palette">Einkaufspreis/Palette (CHF)</Label>
                  <Input
                    id="price_per_palette"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_per_palette || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, price_per_palette: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_per_verpackung">Einkaufspreis/Verpackung (CHF)</Label>
                  <Input
                    id="price_per_verpackung"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_per_verpackung || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, price_per_verpackung: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie</Label>
                  <Select
                    value={formData.category ? formData.category.toString() : undefined}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: Number(value) })
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Kategorie auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id.toString()}
                        >
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Standort</Label>
                  <Input
                    id="location"
                    value={formData.location || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="low_stock_threshold">
                    Niedriger Lagerbestand Schwellenwert
                  </Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    min="0"
                    value={formData.low_stock_threshold || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        low_stock_threshold:
                          Number.parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              {/* Produktstruktur (Umrechnungsfaktoren) */}
              <div className="space-y-4">
                <h5 className="text-sm font-medium text-gray-700">Produktstruktur (Umrechnungsfaktoren)</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="verpackungen_pro_palette">Verpackungen pro Palette</Label>
                    <Input
                      id="verpackungen_pro_palette"
                      type="number"
                      min="1"
                      value={formData.verpackungen_pro_palette || 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          verpackungen_pro_palette: Number.parseInt(e.target.value) || 1,
                        })
                      }
                    />
                    <p className="text-xs text-gray-500">Wie viele Verpackungen hat eine Palette</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stueck_pro_verpackung">Stück pro Verpackung</Label>
                    <Input
                      id="stueck_pro_verpackung"
                      type="number"
                      min="1"
                      value={formData.stueck_pro_verpackung || 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stueck_pro_verpackung: Number.parseInt(e.target.value) || 1,
                        })
                      }
                    />
                    <p className="text-xs text-gray-500">Nur zur Info, wird beim Verkauf nicht aufgebrochen</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-sm text-gray-500">
                Zuletzt aktualisiert:{" "}
                {new Date(item.last_updated || "").toLocaleString()}
              </div>
              {item.is_low_stock && (
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-700 border-red-200"
                >
                  Niedrigbestand-Warnung
                </Badge>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Item Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Suppliers</CardTitle>
              <CardDescription>
                Manage suppliers for this inventory item.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setIsAddSupplierDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Supplier
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Supplier SKU</TableHead>
                    <TableHead>Supplier Price</TableHead>
                    <TableHead>Lead Time (Days)</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemSuppliers.length > 0 ? (
                    itemSuppliers.map((supplier) => {
                      return (
                        <TableRow key={supplier.id}>
                          <TableCell className="font-medium">
                            {supplier.supplier_name || "-"}
                          </TableCell>
                          <TableCell>{supplier.supplier_sku || "-"}</TableCell>
                          <TableCell>${supplier.supplier_price}</TableCell>
                          <TableCell>
                            {supplier.lead_time_days || "-"}
                          </TableCell>
                          <TableCell>{supplier.notes || "-"}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedItemSupplier(supplier);
                                    setNewItemSupplier({
                                      supplier: supplier.supplier,
                                      supplier_sku: supplier.supplier_sku || "",
                                      supplier_price: supplier.supplier_price,
                                      lead_time_days:
                                        supplier.lead_time_days || 0,
                                      notes: supplier.notes || "",
                                    });
                                    setIsEditSupplierDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setSelectedItemSupplier(supplier);
                                    setIsDeleteSupplierDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-gray-500"
                      >
                        No suppliers associated with this item yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Item History Tab */}
        <TabsContent value="history" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Item History</CardTitle>
              <CardDescription>
                View the history of changes for this inventory item.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Qty Change</TableHead>
                    <TableHead>New Qty</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              log.action === "ADD"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : log.action === "REMOVE"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.username || "-"}</TableCell>
                        <TableCell>
                          {log.action === "ADD"
                            ? "+"
                            : log.action === "REMOVE"
                            ? "-"
                            : "±"}
                          {log.quantity_change}
                        </TableCell>
                        <TableCell>{log.new_quantity}</TableCell>
                        <TableCell>{log.notes || "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-gray-500"
                      >
                        No history records found for this item.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Supplier Dialog */}
      <Dialog
        open={isAddSupplierDialogOpen}
        onOpenChange={setIsAddSupplierDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
            <DialogDescription>
              Add a supplier for this inventory item.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Select
                value={newItemSupplier.supplier_name || ""}
                onValueChange={(value) =>
                  setNewItemSupplier({
                    ...newItemSupplier,
                    supplier: Number(value),
                  })
                }
              >
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem
                      key={supplier.id}
                      value={supplier.id.toString()}
                    >
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_sku">Supplier SKU</Label>
                <Input
                  id="supplier_sku"
                  value={newItemSupplier.supplier_sku || ""}
                  onChange={(e) =>
                    setNewItemSupplier({
                      ...newItemSupplier,
                      supplier_sku: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_price">Price (CHF)</Label>
                <Input
                  id="supplier_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItemSupplier.supplier_price || ""}
                  onChange={(e) =>
                    setNewItemSupplier({
                      ...newItemSupplier,
                      supplier_price: e.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead_time_days">Lead Time (Days)</Label>
              <Input
                id="lead_time_days"
                type="number"
                min="0"
                value={newItemSupplier.lead_time_days || ""}
                onChange={(e) =>
                  setNewItemSupplier({
                    ...newItemSupplier,
                    lead_time_days: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={newItemSupplier.notes || ""}
                onChange={(e) =>
                  setNewItemSupplier({
                    ...newItemSupplier,
                    notes: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddSupplierDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddItemSupplier}>Add Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog
        open={isEditSupplierDialogOpen}
        onOpenChange={setIsEditSupplierDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>
              Edit supplier information for this inventory item.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-supplier">Supplier</Label>
              <Select
                value={newItemSupplier.supplier?.toString() || ""}
                onValueChange={(value) =>
                  setNewItemSupplier({
                    ...newItemSupplier,
                    supplier: Number(value),
                  })
                }
              >
                <SelectTrigger id="edit-supplier">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem
                      key={supplier.id}
                      value={supplier.id.toString()}
                    >
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-supplier_sku">Supplier SKU</Label>
                <Input
                  id="edit-supplier_sku"
                  value={newItemSupplier.supplier_sku || ""}
                  onChange={(e) =>
                    setNewItemSupplier({
                      ...newItemSupplier,
                      supplier_sku: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-supplier_price">Price (CHF)</Label>
                <Input
                  id="edit-supplier_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItemSupplier.supplier_price || ""}
                  onChange={(e) =>
                    setNewItemSupplier({
                      ...newItemSupplier,
                      supplier_price: e.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lead_time_days">Lead Time (Days)</Label>
              <Input
                id="edit-lead_time_days"
                type="number"
                min="0"
                value={newItemSupplier.lead_time_days || ""}
                onChange={(e) =>
                  setNewItemSupplier({
                    ...newItemSupplier,
                    lead_time_days: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={newItemSupplier.notes || ""}
                onChange={(e) =>
                  setNewItemSupplier({
                    ...newItemSupplier,
                    notes: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditSupplierDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEditItemSupplier}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Supplier Confirmation Dialog */}
      <Dialog
        open={isDeleteSupplierDialogOpen}
        onOpenChange={setIsDeleteSupplierDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this supplier from this item? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteSupplierDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteItemSupplier}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  ChevronDown,
  Edit,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { inventoryAPI, categoryAPI } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import { notify } from "@/lib/notify";

export default function InventoryPage() {
  const { t, formatCurrency } = useTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    quantity: 0,
    price: "",
    category: "",
    sku: "",
    location: "",
    low_stock_threshold: 10,
    // Neue Getränke-spezifische Felder
    brand: "",
    beverage_type: "",
    container_type: "",
    volume_ml: "",
    deposit_chf: "0.00",
    is_returnable: false,
    is_alcoholic: false,
    abv_percent: "",
    country_of_origin: "",
    ean_unit: "",
    ean_pack: "",
    vat_rate: "8.10",
  });
  // New: form error state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // New: helper for conditional input classes
  const inputClass = (field: string) =>
    `${errors[field] ? "border-red-500 focus-visible:ring-red-500" : ""}`;

  // New: validation
  const validateNewItem = () => {
    const errs: Record<string, string> = {};

    if (!newItem.name.trim()) {
      errs.name = t('inventory.validation.nameRequired');
    }

    if (!newItem.price.toString().trim()) {
      errs.price = t('inventory.validation.priceRequired');
    } else {
      const p = Number.parseFloat(newItem.price as string);
      if (Number.isNaN(p) || p <= 0) {
        errs.price = t('inventory.validation.pricePositive');
      }
    }

    if (!newItem.category) {
      errs.category = t('inventory.validation.categoryRequired');
    }

    if (!newItem.vat_rate.toString().trim()) {
      errs.vat_rate = t('inventory.validation.vatRateRequired');
    } else {
      const v = Number.parseFloat(newItem.vat_rate as string);
      if (Number.isNaN(v) || v < 0 || v > 25) {
        errs.vat_rate = t('inventory.validation.invalidVat');
      }
    }

    if (newItem.is_alcoholic) {
      if (!newItem.abv_percent.toString().trim()) {
        errs.abv_percent = t('inventory.validation.abvRequired');
      } else {
        const a = Number.parseFloat(newItem.abv_percent as string);
        if (Number.isNaN(a) || a < 0 || a > 100) {
          errs.abv_percent = t('inventory.validation.invalidAbv');
        }
      }
    }

    if (newItem.volume_ml.toString().trim()) {
      const vol = Number.parseFloat(newItem.volume_ml as string);
      if (Number.isNaN(vol) || vol <= 0) {
        errs.volume_ml = t('inventory.validation.volumePositive');
      }
    }

    if (newItem.deposit_chf.toString().trim()) {
      const dep = Number.parseFloat(newItem.deposit_chf as string);
      if (Number.isNaN(dep) || dep < 0) {
        errs.deposit_chf = t('inventory.validation.depositNonNegative');
      }
    }

    if (newItem.low_stock_threshold !== undefined) {
      const lst = Number(newItem.low_stock_threshold);
      if (Number.isNaN(lst) || lst < 0) {
        errs.low_stock_threshold = t('inventory.validation.thresholdNonNegative');
      }
    }

    if (newItem.quantity !== undefined) {
      const q = Number(newItem.quantity);
      if (Number.isNaN(q) || q < 0) {
        errs.quantity = t('inventory.validation.quantityNonNegative');
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [itemsData, categoriesData] = await Promise.all([
        inventoryAPI.getItems(),
        categoryAPI.getCategories(),
      ]);

      const itemsArray = Array.isArray(itemsData)
        ? itemsData
        : itemsData.results || [];
      setItems(itemsArray);

      const categoriesArray = Array.isArray(categoriesData)
        ? categoriesData
        : categoriesData.results || [];
      setCategories(categoriesArray);
    } catch (err) {
      notify.error(t('inventory.loadError'));
      console.error("Failed to fetch inventory data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = Array.isArray(items)
    ? items
        .filter((item) => {
          // search filter
          const matchesSearch =
            searchQuery === "" ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.sku &&
              item.sku.toLowerCase().includes(searchQuery.toLowerCase()));

          // category filter
          const matchesCategory =
            categoryFilter === "all" ||
            item.category?.toString() === categoryFilter;

          return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
          // sorting
          if (sortBy === "name") {
            return sortOrder === "asc"
              ? a.name.localeCompare(b.name)
              : b.name.localeCompare(a.name);
          } else if (sortBy === "quantity") {
            // available_qty is optional -> coalesce to 0
            const aQty = a.available_qty ?? 0;
            const bQty = b.available_qty ?? 0;
            return sortOrder === "asc" ? aQty - bQty : bQty - aQty;
          } else if (sortBy === "price") {
            return sortOrder === "asc"
              ? Number.parseFloat(a.price) - Number.parseFloat(b.price)
              : Number.parseFloat(b.price) - Number.parseFloat(a.price);
          }
          return 0;
        })
    : [];

  const handleAddItem = async () => {
    // New: client-side validation
    if (!validateNewItem()) {
      notify.validationError();
      return;
    }

    try {
      const itemData: InventoryItem = {
        // Required
        name: newItem.name,
        price: newItem.price.toString(),
        category: newItem.category ? Number(newItem.category) : null,
        quantity: Number(newItem.quantity),
        // Optional/others
        description: newItem.description || null,
        sku: newItem.sku || null,
        location: newItem.location || null,
        low_stock_threshold: Number(newItem.low_stock_threshold),
        brand: newItem.brand || null,
        beverage_type: newItem.beverage_type || null,
        container_type: newItem.container_type || null,
        volume_ml: newItem.volume_ml ? Number(newItem.volume_ml) : null,
        deposit_chf: newItem.deposit_chf?.toString(),
        is_returnable: Boolean(newItem.is_returnable),
        is_alcoholic: Boolean(newItem.is_alcoholic),
        abv_percent: newItem.abv_percent ? newItem.abv_percent.toString() : null,
        country_of_origin: newItem.country_of_origin || null,
        ean_unit: newItem.ean_unit || null,
        ean_pack: newItem.ean_pack || null,
        vat_rate: newItem.vat_rate?.toString(),
        // The following are left to backend defaults
        owner: undefined,
        id: undefined,
        available_qty: undefined,
        defective_qty: undefined,
        cost: undefined,
        category_name: undefined,
        owner_username: undefined,
        min_stock_level: undefined,
        unit_base: undefined,
        unit_package_factor: undefined,
        unit_pallet_factor: undefined,
        date_added: undefined,
        last_updated: undefined,
        is_active: undefined,
        is_low_stock: undefined,
        total_value: undefined,
      };

      await inventoryAPI.createItem(itemData);

      await fetchData();

      setIsAddDialogOpen(false);
      setNewItem({
        name: "",
        description: "",
        quantity: 0,
        price: "",
        category: "",
        sku: "",
        location: "",
        low_stock_threshold: 10,
        // Neue Getränke-spezifische Felder
        brand: "",
        beverage_type: "",
        container_type: "",
        volume_ml: "",
        deposit_chf: "0.00",
        is_returnable: false,
        is_alcoholic: false,
        abv_percent: "",
        country_of_origin: "",
        ean_unit: "",
        ean_pack: "",
        vat_rate: "8.10",
      });
      setErrors({});

      notify.success(t('inventory.addSuccess', { name: itemData.name }));
    } catch (err) {
      console.error("Failed to add item:", err);
      notify.error(t('inventory.saveError'));
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;

    try {
      if (selectedItem.id !== undefined) {
        await inventoryAPI.deleteItem(selectedItem.id);
      }

      await fetchData();

      setIsDeleteDialogOpen(false);
      setSelectedItem(null);

      notify.deleteSuccess(selectedItem.name);
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2">{t('inventory.loading')}</p>
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
            {t('inventory.connectionError')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center w-full sm:w-auto relative">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('inventory.searchPlaceholder')}
            className="pl-8 w-full sm:w-[300px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('inventory.addItem')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 gap-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Label htmlFor="category-filter" className="whitespace-nowrap">
                  {t('common.category')}:
                </Label>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger id="category-filter" className="w-[180px]">
                    <SelectValue placeholder={t('table.allCategories')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('table.allCategories')}</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.name} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="sort-by" className="whitespace-nowrap">
                  {t('table.sortBy')}:
                </Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sort-by" className="w-[180px]">
                    <SelectValue placeholder={t('table.sortBy')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">{t('table.nameColumn')}</SelectItem>
                    <SelectItem value="quantity">{t('table.quantityColumn')}</SelectItem>
                    <SelectItem value="price">{t('table.priceColumn')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      sortOrder === "desc" ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.nameColumn')}</TableHead>
                <TableHead>{t('table.skuColumn')}</TableHead>
                <TableHead>{t('table.ownerColumn')}</TableHead>
                <TableHead>{t('table.categoryColumn')}</TableHead>
                <TableHead className="text-right">{t('table.quantityColumn')}</TableHead>
                <TableHead className="text-right">{t('table.priceColumn')}</TableHead>
                <TableHead className="text-right">{t('table.actionsColumn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const category = categories.find(
                    (c) => c.id === item.category
                  );
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/inventory/${item.id}`}
                          className="hover:text-violet-300"
                        >
                          {item.name}
                        </Link>
                      </TableCell>
                      <TableCell>{item.sku || "-"}</TableCell>
                      <TableCell>{item.owner_username || "-"}</TableCell>
                      <TableCell>{category?.name || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.available_qty ?? 0}
                          {item.is_low_stock && (
                            <Badge
                              variant="outline"
                              className="bg-red-50 text-red-700 border-red-200"
                            >
                              {t('inventory.lowStock')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">{t('common.actions')}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/inventory/${item.id}`}>
                                <Edit className="h-4 w-4 mr-2" />
                                {t('common.edit')}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedItem(item);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('common.delete')}
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
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('inventory.noItemsFound')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) setErrors({}); }}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('inventory.addItemTitle')}</DialogTitle>
            <DialogDescription>
              {t('inventory.addItemDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Gruppe: Grunddaten */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">{t('inventory.basicInfo')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('common.name')}<span className="text-red-500"> *</span></Label>
                  <Input
                    id="name"
                    value={newItem.name}
                    onChange={(e) => {
                      setNewItem({ ...newItem, name: e.target.value });
                      if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    className={inputClass("name")}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-600">{errors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">{t('common.sku')}</Label>
                  <Input
                    id="sku"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('common.description')}</Label>
                <Textarea
                  id="description"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            {/* Gruppe: Produkt */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">{t('inventory.productInfo')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Marke</Label>
                  <Input
                    id="brand"
                    value={newItem.brand}
                    onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beverage_type">Getränkeart</Label>
                  <Select
                    value={newItem.beverage_type}
                    onValueChange={(value) => setNewItem({ ...newItem, beverage_type: value })}
                  >
                    <SelectTrigger id="beverage_type">
                      <SelectValue placeholder="Getränkeart wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="water">Wasser</SelectItem>
                      <SelectItem value="softdrink">Softdrink</SelectItem>
                      <SelectItem value="beer">Bier</SelectItem>
                      <SelectItem value="wine">Wein</SelectItem>
                      <SelectItem value="spirits">Spirituose</SelectItem>
                      <SelectItem value="energy">Energy Drink</SelectItem>
                      <SelectItem value="juice">Saft</SelectItem>
                      <SelectItem value="other">Sonstiges</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="container_type">Gebindeart</Label>
                  <Select
                    value={newItem.container_type}
                    onValueChange={(value) => setNewItem({ ...newItem, container_type: value })}
                  >
                    <SelectTrigger id="container_type">
                      <SelectValue placeholder="Gebindeart wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glass">Glasflasche</SelectItem>
                      <SelectItem value="pet">PET</SelectItem>
                      <SelectItem value="can">Dose</SelectItem>
                      <SelectItem value="crate">Kiste/Tray</SelectItem>
                      <SelectItem value="keg">Fass/Keg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="volume_ml">Füllmenge (ml)</Label>
                  <Input
                    id="volume_ml"
                    type="number"
                    min="0"
                    value={newItem.volume_ml}
                    onChange={(e) => {
                      setNewItem({ ...newItem, volume_ml: e.target.value });
                      if (errors.volume_ml) setErrors((prev) => ({ ...prev, volume_ml: "" }));
                    }}
                    placeholder="500"
                    className={inputClass("volume_ml")}
                  />
                  {errors.volume_ml && (
                    <p className="text-xs text-red-600">{errors.volume_ml}</p>
                  )}
                  <p className="text-xs text-gray-500">Füllmenge je Einheit in ml</p>
                </div>
              </div>
            </div>

            {/* Gruppe: Kennzeichnung */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Kennzeichnung</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ean_unit">EAN (Einzel)</Label>
                  <Input
                    id="ean_unit"
                    value={newItem.ean_unit}
                    onChange={(e) => setNewItem({ ...newItem, ean_unit: e.target.value })}
                    placeholder="7613031234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ean_pack">EAN (Pack)</Label>
                  <Input
                    id="ean_pack"
                    value={newItem.ean_pack}
                    onChange={(e) => setNewItem({ ...newItem, ean_pack: e.target.value })}
                    placeholder="7613031234574"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country_of_origin">Herkunftsland (ISO-2)</Label>
                <Input
                  id="country_of_origin"
                  value={newItem.country_of_origin}
                  onChange={(e) => setNewItem({ ...newItem, country_of_origin: e.target.value })}
                  placeholder="CH"
                  maxLength={2}
                />
                <p className="text-xs text-gray-500">ISO-2 Landescode, z. B. CH</p>
              </div>
            </div>

            {/* Gruppe: Lager & Preis */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Lager & Preis</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Menge</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={newItem.quantity}
                    onChange={(e) => {
                      setNewItem({
                        ...newItem,
                        quantity: Number.parseInt(e.target.value) || 0,
                      });
                      if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: "" }));
                    }}
                    className={inputClass("quantity")}
                  />
                  {errors.quantity && (
                    <p className="text-xs text-red-600">{errors.quantity}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Preis (CHF)<span className="text-red-500"> *</span></Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.price}
                    onChange={(e) => {
                      setNewItem({ ...newItem, price: e.target.value });
                      if (errors.price) setErrors((prev) => ({ ...prev, price: "" }));
                    }}
                    className={inputClass("price")}
                  />
                  {errors.price && (
                    <p className="text-xs text-red-600">{errors.price}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie<span className="text-red-500"> *</span></Label>
                  <Select
                    value={newItem.category}
                    onValueChange={(value) => {
                      setNewItem({ ...newItem, category: value });
                      if (errors.category) setErrors((prev) => ({ ...prev, category: "" }));
                    }}
                  >
                    <SelectTrigger id="category" className={inputClass("category")}>
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
                  {errors.category && (
                    <p className="text-xs text-red-600">{errors.category}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Standort</Label>
                  <Input
                    id="location"
                    value={newItem.location}
                    onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="low_stock_threshold">Niedriger Lagerbestand Schwellenwert</Label>
                <Input
                  id="low_stock_threshold"
                  type="number"
                  min="0"
                  value={newItem.low_stock_threshold}
                  onChange={(e) => {
                    setNewItem({
                      ...newItem,
                      low_stock_threshold: Number.parseInt(e.target.value) || 0,
                    });
                    if (errors.low_stock_threshold) setErrors((prev) => ({ ...prev, low_stock_threshold: "" }));
                  }}
                  className={inputClass("low_stock_threshold")}
                />
                {errors.low_stock_threshold && (
                  <p className="text-xs text-red-600">{errors.low_stock_threshold}</p>
                )}
              </div>
            </div>

            {/* Gruppe: Steuern & Pfand */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Steuern & Pfand</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vat_rate">MwSt. %<span className="text-red-500"> *</span></Label>
                  <Input
                    id="vat_rate"
                    type="number"
                    min="0"
                    max="25"
                    step="0.01"
                    value={newItem.vat_rate}
                    onChange={(e) => {
                      setNewItem({ ...newItem, vat_rate: e.target.value });
                      if (errors.vat_rate) setErrors((prev) => ({ ...prev, vat_rate: "" }));
                    }}
                    className={inputClass("vat_rate")}
                  />
                  {errors.vat_rate && (
                    <p className="text-xs text-red-600">{errors.vat_rate}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deposit_chf">Pfand (CHF)</Label>
                  <Input
                    id="deposit_chf"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.deposit_chf}
                    onChange={(e) => {
                      setNewItem({ ...newItem, deposit_chf: e.target.value });
                      if (errors.deposit_chf) setErrors((prev) => ({ ...prev, deposit_chf: "" }));
                    }}
                    className={inputClass("deposit_chf")}
                  />
                  {errors.deposit_chf && (
                    <p className="text-xs text-red-600">{errors.deposit_chf}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="is_returnable">Mehrweg?</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="is_returnable"
                      checked={newItem.is_returnable}
                      onCheckedChange={(checked) => setNewItem({ ...newItem, is_returnable: checked })}
                    />
                    <Label htmlFor="is_returnable" className="text-sm">
                      Mehrweg/Rücknahme
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Gruppe: Alkohol */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Alkohol</h4>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_alcoholic"
                    checked={newItem.is_alcoholic}
                    onCheckedChange={(checked) => {
                      setNewItem({ ...newItem, is_alcoholic: checked });
                      if (!checked && errors.abv_percent) setErrors((prev) => ({ ...prev, abv_percent: "" }));
                    }}
                  />
                  <Label htmlFor="is_alcoholic" className="text-sm">
                    Alkoholisch?
                  </Label>
                </div>
                {newItem.is_alcoholic && (
                  <div className="space-y-2">
                    <Label htmlFor="abv_percent">Alkoholgehalt % vol<span className="text-red-500"> *</span></Label>
                    <Input
                      id="abv_percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={newItem.abv_percent}
                      onChange={(e) => {
                        setNewItem({ ...newItem, abv_percent: e.target.value });
                        if (errors.abv_percent) setErrors((prev) => ({ ...prev, abv_percent: "" }));
                      }}
                      placeholder="5.0"
                      className={inputClass("abv_percent")}
                    />
                    {errors.abv_percent && (
                      <p className="text-xs text-red-600">{errors.abv_percent}</p>
                    )}
                    <p className="text-xs text-gray-500">Alkoholgehalt in Prozent</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddItem}>{t('inventory.addItem')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('common.confirm')} {t('common.delete')}</DialogTitle>
            <DialogDescription>
              {t('inventory.confirmDelete')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteItem}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

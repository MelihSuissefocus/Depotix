const API_BASE = 'https://depotix.ch/api'

// German error messages mapping
const errorMessages: Record<string, string> = {
  'Invalid credentials': 'Ungültige Anmeldedaten',
  'Permission denied': 'Keine Berechtigung',
  'Not found': 'Nicht gefunden',
  'Bad request': 'Ungültige Anfrage',
  'Session expired': 'Sitzung abgelaufen',
  'INSUFFICIENT_STOCK': 'Nicht genügend Lagerbestand',
  'INVALID_STATUS_TRANSITION': 'Ungültiger Statuswechsel',
  'MISSING_COMPANY_PROFILE': 'Firmenprofil fehlt',
  'INVALID_IBAN': 'Ungültige IBAN',
}

function getGermanErrorMessage(error: string, code?: string): string {
  if (code && errorMessages[code]) {
    return errorMessages[code]
  }
  for (const [key, value] of Object.entries(errorMessages)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }
  return error
}

// Helper function for making API requests
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`

  // Get auth token from localStorage
  const tokensStr = typeof window !== "undefined" ? localStorage.getItem("auth_tokens") : null
  const tokens = tokensStr ? JSON.parse(tokensStr) : null

  const headers = {
    "Content-Type": "application/json",
    ...(tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    // Handle 401 Unauthorized by redirecting to login
    if (response.status === 401 && typeof window !== "undefined") {
      // Try to refresh the token if we have a refresh token
      if (tokens?.refresh) {
        try {
          const refreshResponse = await fetch(`${API_BASE}/token/refresh/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refresh: tokens.refresh }),
          })

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json()
            // Update the tokens in localStorage
            localStorage.setItem(
              "auth_tokens",
              JSON.stringify({
                access: refreshData.access,
                refresh: tokens.refresh,
              }),
            )

            // Retry the original request with the new token
            const retryHeaders = {
              "Content-Type": "application/json",
              Authorization: `Bearer ${refreshData.access}`,
              ...options.headers,
            }

            const retryResponse = await fetch(url, {
              ...options,
              headers: retryHeaders,
            })

            if (retryResponse.ok) {
              return retryResponse.json()
            }
          }
        } catch (error) {
          console.error("Token refresh failed:", error)
        }
      }

      // If refresh failed or we don't have a refresh token, redirect to login
      localStorage.removeItem("auth_tokens")
      window.location.href = "/login"
      throw new Error("Session expired. Please login again.")
    }

    // Improved error handling: try to parse JSON, fallback to text, include status
    let errorBody: any = null
    try {
      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        errorBody = await response.json().catch(() => null)
      } else {
        errorBody = (await response.text().catch(() => null)) || null
      }
    } catch (e) {
      errorBody = null
    }

    // Build a helpful error message for debugging
    const bodyMessage =
      errorBody && typeof errorBody === "object"
        ? errorBody.message || errorBody.detail || JSON.stringify(errorBody)
        : errorBody || response.statusText || ""

    // Get error code for better German translation
    const errorCode = errorBody && typeof errorBody === "object" ? errorBody.code : null
    const germanMessage = getGermanErrorMessage(bodyMessage, errorCode)

    const message = germanMessage
      ? `${germanMessage} (Status ${response.status})`
      : `Ein Fehler ist aufgetreten (Status ${response.status})`

    console.error("API request failed:", { 
      url, 
      method: options.method || 'GET',
      status: response.status, 
      statusText: response.statusText,
      body: errorBody,
      headers: Object.fromEntries(response.headers.entries())
    })
    throw new Error(message)
  }

  // Robustly parse successful responses: handle 204, JSON, and non-JSON bodies
  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    try {
      return await response.json()
    } catch (e) {
      console.warn("Failed to parse JSON response; returning null", e)
      return null
    }
  } else {
    try {
      const text = await response.text()
      return text
    } catch (e) {
      return null
    }
  }
}

// API functions for inventory items
export const inventoryAPI = {
  getItems: (params = {}) => {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value))
    })
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ""
    return fetchAPI(`/inventory/items/${queryString}`)
  },
  getItem: (id: number) => fetchAPI(`/inventory/items/${id}/`),
  createItem: (data: InventoryItem) =>
    fetchAPI("/inventory/items/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateItem: (id: number, data: InventoryItem) =>
    fetchAPI(`/inventory/items/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteItem: (id: number) =>
    fetchAPI(`/inventory/items/${id}/`, {
      method: "DELETE",
    }),
  adjustQuantity: (id: number, data: { quantity_change: number; notes?: string }) =>
    fetchAPI(`/inventory/items/${id}/adjust_quantity/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getItemLevel: (id: number) => fetchAPI(`/inventory/items/${id}/level/`),
  getAllLevels: () => fetchAPI(`/inventory/items/level/`),
}

// API functions for categories
export const categoryAPI = {
  getCategories: (search?: string) => {
    const queryString = search ? `?search=${encodeURIComponent(search)}` : ""
    return fetchAPI(`/inventory/categories/${queryString}`)
  },
  getCategory: (id: number) => fetchAPI(`/inventory/categories/${id}/`),
  createCategory: (data: Category) =>
    fetchAPI("/inventory/categories/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCategory: (id: number, data: Category) =>
    fetchAPI(`/inventory/categories/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: number) =>
    fetchAPI(`/inventory/categories/${id}/`, {
      method: "DELETE",
    }),
}

// API functions for suppliers
export const supplierAPI = {
  getSuppliers: (params: { search?: string; item_id?: number } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.item_id) queryParams.append("item_id", String(params.item_id));
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return fetchAPI(`/inventory/suppliers/${queryString}`);
  },
  getSupplier: (id: number) => fetchAPI(`/inventory/suppliers/${id}/`),
  createSupplier: (data: CreateSupplierData) =>
    fetchAPI("/inventory/suppliers/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSupplier: (id: number, data: CreateSupplierData) =>
    fetchAPI(`/inventory/suppliers/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSupplier: (id: number) =>
    fetchAPI(`/inventory/suppliers/${id}/`, {
      method: "DELETE",
    }),
}

// API functions for item suppliers
export const itemSupplierAPI = {
  getItemSuppliers: () => fetchAPI("/inventory/item-suppliers/"),
  getItemSupplier: (id: number) => fetchAPI(`/inventory/item-suppliers/${id}/`),
  createItemSupplier: (data: InventoryItemSupplier) =>
    fetchAPI("/inventory/item-suppliers/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateItemSupplier: (id: number, data: InventoryItemSupplier) =>
    fetchAPI(`/inventory/item-suppliers/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteItemSupplier: (id: number) =>
    fetchAPI(`/inventory/item-suppliers/${id}/`, {
      method: "DELETE",
    }),
}

// API functions for inventory logs
export const logAPI = {
  getLogs: (params = {}) => {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value))
    })
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ""
    return fetchAPI(`/inventory/logs/${queryString}`)
  },
  getLog: (id: number) => fetchAPI(`/inventory/logs/${id}/`),
  getItemLogs: (itemId: number) => fetchAPI(`/inventory/logs/${itemId}/item/`),
  getRecentChanges: (days?: number) => {
    const queryString = days ? `?days=${days}` : ""
    return fetchAPI(`/inventory/logs/recent_changes/${queryString}`)
  },
  getChangesSummary: (groupBy: "day" | "item" | "user") => {
    return fetchAPI(`/inventory/logs/recent_changes/?group_by=${groupBy}`)
  },
}

// API functions for customers
export const customerAPI = {
  getCustomers: (params: { search?: string; page?: number; ordering?: string } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.page) queryParams.append("page", String(params.page));
    if (params.ordering) queryParams.append("ordering", params.ordering);
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return fetchAPI(`/inventory/customers/${queryString}`);
  },
  getCustomer: (id: number) => fetchAPI(`/inventory/customers/${id}/`),
  createCustomer: (data: Customer) =>
    fetchAPI("/inventory/customers/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCustomer: (id: number, data: Customer) =>
    fetchAPI(`/inventory/customers/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCustomer: (id: number) =>
    fetchAPI(`/inventory/customers/${id}/`, {
      method: "DELETE",
    }),
}

// API functions for stock movements
export const stockMovementAPI = {
  createMovement: (data: {
    type: "IN" | "OUT" | "RETURN"
    item: number
    qty_base?: number
    qty_pallets?: number
    qty_packages?: number
    qty_singles?: number
    supplier?: number
    customer?: number
    note?: string
  }) =>
    fetchAPI("/inventory/stock-movements/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  
  // Convenience wrapper for RETURN movements
  createReturn: (data: {
    item: number
    qty_base?: number
    qty_pallets?: number
    qty_packages?: number
    qty_singles?: number
    customer: number
    note?: string
  }) =>
    fetchAPI("/inventory/stock-movements/return/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}

// API functions for expenses
export const expensesAPI = {
  list: (params: {
    page?: number;
    search?: string;
    category?: string;
    date_after?: string;
    date_before?: string;
    ordering?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return fetchAPI(`/inventory/expenses/${queryString}`);
  },
  create: (data: Expense) =>
    fetchAPI("/inventory/expenses/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<Expense>) =>
    fetchAPI(`/inventory/expenses/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    fetchAPI(`/inventory/expenses/${id}/`, {
      method: "DELETE",
    }),
};

// API functions for company profile
export const companyProfileAPI = {
  get: (): Promise<CompanyProfile> => fetchAPI("/inventory/company-profile/"),
  patch: (payload: Partial<CompanyProfile>): Promise<CompanyProfile> =>
    fetchAPI("/inventory/company-profile/", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
}

// API functions for sales orders
export const ordersAPI = {
  list: (params: {
    page?: number;
    search?: string;
    status?: string;
    customer?: number;
  } = {}): Promise<{results: SalesOrder[], count: number, next: string | null, previous: string | null}> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return fetchAPI(`/inventory/orders/${queryString}`);
  },
  confirm: (id: number): Promise<SalesOrder> =>
    fetchAPI(`/inventory/orders/${id}/confirm/`, {
      method: "POST",
    }),
  deliver: (id: number): Promise<SalesOrder> =>
    fetchAPI(`/inventory/orders/${id}/deliver/`, {
      method: "POST",
    }),
  invoice: (id: number): Promise<Invoice> =>
    fetchAPI(`/inventory/orders/${id}/invoice/`, {
      method: "POST",
    }),
}

// Helper function for PDF downloads
async function downloadPDF(endpoint: string): Promise<void> {
  const url = `${API_BASE}${endpoint}`
  
  // Get auth token
  const tokensStr = typeof window !== "undefined" ? localStorage.getItem("auth_tokens") : null
  const tokens = tokensStr ? JSON.parse(tokensStr) : null
  
  const headers: HeadersInit = {
    ...(tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
  }
  
  const response = await fetch(url, { headers })
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    const germanMessage = getGermanErrorMessage(errorText)
    throw new Error(`${germanMessage} (Status ${response.status})`)
  }
  
  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition")
  let filename = "document.pdf"
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, "")
    }
  }
  
  // Create blob and download
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  
  // Create temporary download link
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up object URL
  URL.revokeObjectURL(objectUrl)
}

// API functions for invoices
export const invoicesAPI = {
  list: (params: {
    page?: number;
    search?: string;
    order?: number;
    issue_date?: string;
  } = {}): Promise<{results: Invoice[], count: number, next: string | null, previous: string | null}> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return fetchAPI(`/inventory/invoices/${queryString}`);
  },
  get: (id: number): Promise<Invoice> => fetchAPI(`/inventory/invoices/${id}/`),
  pdf: (id: number): Promise<void> => downloadPDF(`/inventory/invoices/${id}/pdf/`),
}

// Export useful hooks
export { useCustomerOptions } from "./hooks/useCustomerOptions"


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

// Helper function for making API requests
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`

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
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
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
              return retryResponse.status === 204 ? null : retryResponse.json()
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

    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || error.detail || "An error occurred while fetching data")
  }

  return response.status === 204 ? null : response.json()
}

// Generic list fetcher with pagination and filters
export function createListAPI<T>(baseEndpoint: string) {
  return {
    list: (params: Record<string, any> = {}): Promise<APIListResponse<T>> => {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value))
        }
      })
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ""
      return fetchAPI(`${baseEndpoint}/${queryString}`)
    },
    get: (id: number): Promise<T> => fetchAPI(`${baseEndpoint}/${id}/`),
    create: (data: Partial<T>): Promise<T> => 
      fetchAPI(`${baseEndpoint}/`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<T>): Promise<T> => 
      fetchAPI(`${baseEndpoint}/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number): Promise<void> => 
      fetchAPI(`${baseEndpoint}/${id}/`, { method: "DELETE" }),
  }
}

// API instances for all entities
export const inventoryAPI = {
  ...createListAPI<InventoryItem>('/api/v1/items'),
  lowStock: (params: Record<string, any> = {}): Promise<APIListResponse<InventoryItem>> => {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value))
      }
    })
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ""
    return fetchAPI(`/api/v1/items/low_stock/${queryString}`)
  },
  // Legacy support for existing code
  getItems: (params = {}) => {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value))
    })
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ""
    return fetchAPI(`/api/v1/items/${queryString}`)
  },
  getItem: (id: number) => fetchAPI(`/api/v1/items/${id}/`),
  createItem: (data: InventoryItem) => fetchAPI("/api/v1/items/", { method: "POST", body: JSON.stringify(data) }),
  updateItem: (id: number, data: InventoryItem) => fetchAPI(`/api/v1/items/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
  deleteItem: (id: number) => fetchAPI(`/api/v1/items/${id}/`, { method: "DELETE" }),
}

export const categoryAPI = {
  ...createListAPI<Category>('/api/v1/categories'),
  // Legacy support for existing code
  getCategories: (search?: string) => {
    const queryString = search ? `?search=${encodeURIComponent(search)}` : ""
    return fetchAPI(`/api/v1/categories/${queryString}`)
  },
  getCategory: (id: number) => fetchAPI(`/api/v1/categories/${id}/`),
  createCategory: (data: Category) => fetchAPI("/api/v1/categories/", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: number, data: Category) => fetchAPI(`/api/v1/categories/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id: number) => fetchAPI(`/api/v1/categories/${id}/`, { method: "DELETE" }),
}

export const supplierAPI = {
  ...createListAPI<Supplier>('/api/v1/suppliers'),
  // Legacy support for existing code
  getSuppliers: (params: { search?: string; item_id?: number } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.item_id) queryParams.append("item_id", String(params.item_id));
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return fetchAPI(`/api/v1/suppliers/${queryString}`);
  },
  getSupplier: (id: number) => fetchAPI(`/api/v1/suppliers/${id}/`),
  createSupplier: (data: Supplier) => fetchAPI("/api/v1/suppliers/", { method: "POST", body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: Supplier) => fetchAPI(`/api/v1/suppliers/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSupplier: (id: number) => fetchAPI(`/api/v1/suppliers/${id}/`, { method: "DELETE" }),
}

// Phase 2 New APIs
export const customerAPI = createListAPI<Customer>('/api/v1/customers')
export const expenseAPI = createListAPI<Expense>('/api/v1/expenses')
export const stockMovementAPI = createListAPI<StockMovement>('/api/v1/stock-movements')
export const orderAPI = createListAPI<SalesOrder>('/api/v1/orders')
export const orderItemAPI = createListAPI<SalesOrderItem>('/api/v1/order-items')
export const invoiceAPI = createListAPI<Invoice>('/api/v1/invoices')

// Stock Actions API
export const stockActionAPI = {
  stockIn: (data: StockActionData) => fetchAPI('/api/v1/stock/in/', { method: 'POST', body: JSON.stringify(data) }),
  stockOut: (data: StockActionData) => fetchAPI('/api/v1/stock/out/', { method: 'POST', body: JSON.stringify(data) }),
  stockReturn: (data: StockActionData) => fetchAPI('/api/v1/stock/return/', { method: 'POST', body: JSON.stringify(data) }),
  stockDefect: (data: StockActionData) => fetchAPI('/api/v1/stock/defect/', { method: 'POST', body: JSON.stringify(data) }),
  stockAdjust: (data: StockActionData) => fetchAPI('/api/v1/stock/adjust/', { method: 'POST', body: JSON.stringify(data) }),
}

// Order Workflow API
export const orderWorkflowAPI = {
  confirm: (orderId: number) => fetchAPI(`/api/v1/orders/${orderId}/confirm/`, { method: 'POST' }),
  deliver: (orderId: number) => fetchAPI(`/api/v1/orders/${orderId}/deliver/`, { method: 'POST' }),
  invoice: (orderId: number) => fetchAPI(`/api/v1/orders/${orderId}/invoice/`, { method: 'POST' }),
}

// Invoice PDF Download
export const invoicePDFAPI = {
  downloadPDF: async (invoiceId: number): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/invoices/${invoiceId}/pdf/`, {
      headers: {
        Authorization: `Bearer ${JSON.parse(localStorage.getItem("auth_tokens") || "{}")?.access}`,
      },
    })
    if (!response.ok) throw new Error('Failed to download PDF')
    return response.blob()
  }
}

// Legacy APIs (keeping for backward compatibility)
export const itemSupplierAPI = {
  getItemSuppliers: () => fetchAPI("/api/v1/item-suppliers/"),
  getItemSupplier: (id: number) => fetchAPI(`/api/v1/item-suppliers/${id}/`),
  createItemSupplier: (data: InventoryItemSupplier) => fetchAPI("/api/v1/item-suppliers/", { method: "POST", body: JSON.stringify(data) }),
  updateItemSupplier: (id: number, data: InventoryItemSupplier) => fetchAPI(`/api/v1/item-suppliers/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
  deleteItemSupplier: (id: number) => fetchAPI(`/api/v1/item-suppliers/${id}/`, { method: "DELETE" }),
}

export const logAPI = {
  getLogs: (params = {}) => {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value))
    })
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ""
    return fetchAPI(`/api/v1/logs/${queryString}`)
  },
  getLog: (id: number) => fetchAPI(`/api/v1/logs/${id}/`),
}

// PDF download helper function
async function downloadPDF(endpoint: string, filename: string) {
  const url = `${API_BASE_URL}${endpoint}`
  
  // Get auth token from localStorage
  const tokensStr = typeof window !== "undefined" ? localStorage.getItem("auth_tokens") : null
  const tokens = tokensStr ? JSON.parse(tokensStr) : null
  
  const headers: Record<string, string> = {}
  if (tokens?.access) {
    headers.Authorization = `Bearer ${tokens.access}`
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  })
  
  if (!response.ok) {
    throw new Error(`PDF download failed: ${response.statusText}`)
  }
  
  // Convert response to blob
  const blob = await response.blob()
  
  // Create download link
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)
}

export const pdfAPI = {
  downloadInvoicePDF: (invoiceId: number) => {
    return downloadPDF(`/api/v1/invoices/${invoiceId}/pdf/`, `Rechnung_${invoiceId}.pdf`)
  },
  downloadDeliveryNotePDF: (orderId: number) => {
    return downloadPDF(`/api/v1/orders/${orderId}/delivery-note-pdf/`, `Lieferschein_${orderId}.pdf`)
  },
}


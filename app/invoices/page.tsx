'use client'

import { useState, useEffect } from 'react'
import { Search, Download, Eye, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { invoiceAPI, pdfAPI, customerAPI } from '@/lib/api'
import { useCRUD } from '@/lib/hooks'
import { formatCHF, formatDate } from '@/lib/hooks'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

export default function InvoicesPage() {
  const { data: invoices, loading, fetchList } = useCRUD(invoiceAPI)
  const { data: customers } = useCRUD(customerAPI)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [downloadingPDF, setDownloadingPDF] = useState<number | null>(null)

  useEffect(() => {
    const params: any = {}
    if (searchTerm) params.search = searchTerm
    fetchList(params)
  }, [fetchList, searchTerm])

  useEffect(() => {
    if (customers.length === 0) customerAPI.list()
  }, [])

  const handleDownloadPDF = async (invoice: Invoice) => {
    setDownloadingPDF(invoice.id!)
    try {
      await pdfAPI.downloadInvoicePDF(invoice.id!)
      toast.success('Invoice PDF downloaded successfully')
    } catch (error) {
      console.error('Failed to download PDF:', error)
      toast.error('Failed to download PDF')
    } finally {
      setDownloadingPDF(null)
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    const customer = customers.find(c => c.id === invoice.customer)
    const matchesSearch = invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.order_number?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const totalInvoices = filteredInvoices.length
  const totalValue = filteredInvoices.reduce((sum, invoice) => sum + parseFloat(invoice.gross_amount || '0'), 0)
  const thisMonthValue = filteredInvoices
    .filter(invoice => new Date(invoice.invoice_date).getMonth() === new Date().getMonth())
    .reduce((sum, invoice) => sum + parseFloat(invoice.gross_amount || '0'), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">View and manage customer invoices</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCHF(totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCHF(thisMonthValue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
          <CardDescription>
            {filteredInvoices.length} invoices found
          </CardDescription>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading invoices...</p>
              </div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No invoices found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const customer = customers.find(c => c.id === invoice.customer)
                  
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number || `#${invoice.id}`}
                      </TableCell>
                      <TableCell>
                        <Link 
                          href={`/orders/${invoice.order}`} 
                          className="text-blue-600 hover:underline"
                        >
                          {invoice.order_number || `#${invoice.order}`}
                        </Link>
                      </TableCell>
                      <TableCell>{customer?.name || 'Unknown'}</TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell>
                        {invoice.due_date ? formatDate(invoice.due_date) : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCHF(invoice.gross_amount || '0')}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPDF(invoice)}
                            disabled={downloadingPDF === invoice.id}
                          >
                            {downloadingPDF === invoice.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            <span className="ml-2 hidden sm:inline">PDF</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

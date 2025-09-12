"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/lib/auth"
import { toast } from 'react-hot-toast';
import { companyProfileAPI } from "@/lib/api"

export default function SettingsPage() {
  const { user, isLoading: authLoading, updateProfile, changePassword } = useAuth()

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Company profile state
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: "",
    street: "",
    postal_code: "",
    city: "",
    country: "CH",
    email: "",
    phone: "",
    iban: "",
    bank_name: "",
    mwst_number: "",
    currency: "CHF",
  })

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [lowStockAlerts, setLowStockAlerts] = useState(true)
  const [activitySummary, setActivitySummary] = useState(true)
  const [defaultLowStockThreshold, setDefaultLowStockThreshold] = useState(10)
  const [defaultCurrency, setDefaultCurrency] = useState("USD")
  const [defaultDateFormat, setDefaultDateFormat] = useState("MM/DD/YYYY")

  // User form state
  const [userForm, setUserForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    username: user?.username || "",
  })

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })

  // Load company profile on component mount
  const loadCompanyProfile = async () => {
    try {
      setIsLoadingProfile(true)
      const profile = await companyProfileAPI.get()
      setCompanyProfile(profile)
      setProfileForm({
        name: profile.name || "",
        street: profile.street || "",
        postal_code: profile.postal_code || "",
        city: profile.city || "",
        country: profile.country || "CH",
        email: profile.email || "",
        phone: profile.phone || "",
        iban: profile.iban || "",
        bank_name: profile.bank_name || "",
        mwst_number: profile.mwst_number || "",
        currency: profile.currency || "CHF",
      })
    } catch (err) {
      // Profile doesn't exist yet - this is normal for new users
      console.log("No company profile found, starting fresh")
    } finally {
      setIsLoadingProfile(false)
    }
  }

  // Load profile on component mount
  useEffect(() => {
    loadCompanyProfile()
  }, [])

  const validateProfileForm = () => {
    const errors: string[] = []
    if (!profileForm.name.trim()) {
      errors.push("Firma ist erforderlich")
    }
    if (!profileForm.iban.trim()) {
      errors.push("IBAN ist erforderlich")
    }
    return errors
  }

  const handleSaveCompanyProfile = async () => {
    try {
      setIsSaving(true)
      
      // Client-side validation
      const validationErrors = validateProfileForm()
      if (validationErrors.length > 0) {
        toast.error(validationErrors.join(", "))
        return
      }

      await companyProfileAPI.patch(profileForm)
      toast.success("Firmenprofil gespeichert")
      
      // Reload to get the updated profile
      await loadCompanyProfile()
    } catch (err) {
      console.error("Failed to save company profile:", err)
      toast.error("Fehler beim Speichern des Firmenprofils")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateProfile = async () => {
    try {
      setIsSaving(true)

      await updateProfile(userForm)
      toast.success("Profile updated successfully")
    } catch (err) {
      console.error("Failed to update profile:", err)
      toast.error("Failed to update profile. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccess(null)

      // Validate passwords match
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        toast.error("New passwords do not match")
        setIsSaving(false)
        return
      }

      // Send password update request
      await changePassword(passwordForm.current_password, passwordForm.new_password)

      // Clear password form
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      })

      toast.success("Password changed successfully")
    } catch (err) {
      console.error("Failed to change password:", err)
      toast.error("Failed to change password. Please check your current password and try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveGeneralSettings = () => {
    //TODO: This would typically save to an API
    toast.success("General settings saved successfully")

    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccess(null)
    }, 3000)
  }

  const handleSaveNotificationSettings = () => {
    //TODO: This would typically save to an API
    toast.success("Notification settings saved successfully")

    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccess(null)
    }, 3000)
  }

  const getUserInitials = () => {
    if (!user) return "U"
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    return user.username.substring(0, 2).toUpperCase()
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="profile">Firmenprofil</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Update your account details and preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src="/placeholder.svg?height=64&width=64" alt={user?.username || "User"} />
                  <AvatarFallback>{getUserInitials()}</AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">
                    Change Avatar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    value={userForm.first_name}
                    onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    value={userForm.last_name}
                    onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Username</Label>
                <Input
                  id="company"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                />
              </div>

              <div className="text-sm text-gray-500 mt-2">
                <p>Member since: N/A</p>
                <p>Last login: N/A</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleUpdateProfile} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSaving ? "Updating..." : "Update Profile"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your password and security settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleChangePassword}
                disabled={
                  isSaving ||
                  !passwordForm.current_password ||
                  !passwordForm.new_password ||
                  !passwordForm.confirm_password
                }
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSaving ? "Changing..." : "Change Password"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4 pt-4">
          {/* Warning banner for missing IBAN */}
          {companyProfile && !companyProfile.iban && (
            <Alert className="bg-amber-50 text-amber-700 border-amber-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Bitte IBAN hinterlegen, um QR-Rechnungen zu generieren.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Firmenprofil</CardTitle>
              <CardDescription>Erfassen Sie Ihre Firmendaten für die Rechnungsstellung</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingProfile ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                    <p className="mt-2">Lade Firmenprofil...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Firma - Required */}
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Firma *</Label>
                    <Input
                      id="company-name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Firmenname eingeben"
                      className={!profileForm.name.trim() ? "border-red-300" : ""}
                    />
                  </div>

                  {/* Address fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="street">Straße</Label>
                      <Input
                        id="street"
                        value={profileForm.street}
                        onChange={(e) => setProfileForm({ ...profileForm, street: e.target.value })}
                        placeholder="Straße und Hausnummer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal-code">PLZ</Label>
                      <Input
                        id="postal-code"
                        value={profileForm.postal_code}
                        onChange={(e) => setProfileForm({ ...profileForm, postal_code: e.target.value })}
                        placeholder="PLZ"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Ort</Label>
                      <Input
                        id="city"
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                        placeholder="Ort"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Land</Label>
                      <Input
                        id="country"
                        value={profileForm.country}
                        onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                        placeholder="Land"
                      />
                    </div>
                  </div>

                  {/* Contact information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-email">E-Mail</Label>
                      <Input
                        id="company-email"
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        placeholder="info@firma.ch"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Telefon</Label>
                      <Input
                        id="company-phone"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="+41 XX XXX XX XX"
                      />
                    </div>
                  </div>

                  {/* Banking information */}
                  <div className="space-y-2">
                    <Label htmlFor="iban">IBAN *</Label>
                    <Input
                      id="iban"
                      value={profileForm.iban}
                      onChange={(e) => setProfileForm({ ...profileForm, iban: e.target.value.toUpperCase() })}
                      placeholder="CH00 0000 0000 0000 0000 0"
                      className={!profileForm.iban.trim() ? "border-red-300" : ""}
                    />
                    <p className="text-sm text-gray-500">CH/LI-IBAN für QR-Rechnungen erforderlich</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Bankname</Label>
                    <Input
                      id="bank-name"
                      value={profileForm.bank_name}
                      onChange={(e) => setProfileForm({ ...profileForm, bank_name: e.target.value })}
                      placeholder="Name der Bank"
                    />
                  </div>

                  {/* Tax and currency */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mwst-number">MWST-Nr.</Label>
                      <Input
                        id="mwst-number"
                        value={profileForm.mwst_number}
                        onChange={(e) => setProfileForm({ ...profileForm, mwst_number: e.target.value })}
                        placeholder="CHE-XXX.XXX.XXX MWST"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Währung</Label>
                      <Input
                        id="currency"
                        value={profileForm.currency}
                        disabled
                        className="bg-gray-50"
                      />
                      <p className="text-sm text-gray-500">Standardwährung (nicht änderbar)</p>
                    </div>
                  </div>

                  {/* Logo placeholder */}
                  <div className="space-y-2">
                    <Label>Logo (optional)</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">Logo-Upload folgt in einer späteren Version</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                onClick={handleSaveCompanyProfile} 
                disabled={isSaving || isLoadingProfile}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSaving ? "Speichere..." : "Speichern"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setProfileForm({
                  name: companyProfile?.name || "",
                  street: companyProfile?.street || "",
                  postal_code: companyProfile?.postal_code || "",
                  city: companyProfile?.city || "",
                  country: companyProfile?.country || "CH",
                  email: companyProfile?.email || "",
                  phone: companyProfile?.phone || "",
                  iban: companyProfile?.iban || "",
                  bank_name: companyProfile?.bank_name || "",
                  mwst_number: companyProfile?.mwst_number || "",
                  currency: companyProfile?.currency || "CHF",
                })}
                disabled={isLoadingProfile}
              >
                Abbrechen
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure general settings for your inventory system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default-low-stock">Default Low Stock Threshold</Label>
                <Input
                  id="default-low-stock"
                  type="number"
                  min="0"
                  value={defaultLowStockThreshold}
                  onChange={(e) => setDefaultLowStockThreshold(Number.parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-gray-500">Default threshold for new inventory items</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-currency">Default Currency</Label>
                <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                  <SelectTrigger id="default-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="NGN">NGN (₦)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                    <SelectItem value="CAD">CAD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-format">Date Format</Label>
                <Select value={defaultDateFormat} onValueChange={setDefaultDateFormat}>
                  <SelectTrigger id="date-format">
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveGeneralSettings}>Save Changes</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Manage your inventory data and backups.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Export Data</Label>
                <div className="flex gap-2">
                  <Button variant="outline">Export Inventory</Button>
                  <Button variant="outline">Export Suppliers</Button>
                  <Button variant="outline">Export All Data</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Import Data</Label>
                <div className="flex gap-2">
                  <Button variant="outline">Import Inventory</Button>
                  <Button variant="outline">Import Suppliers</Button>
                </div>
                <p className="text-sm text-gray-500">Import data from CSV files</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        

        <TabsContent value="notifications" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure how and when you receive notifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-gray-500">Receive notifications via email</p>
                </div>
                <Switch id="email-notifications" checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="low-stock-alerts">Low Stock Alerts</Label>
                  <p className="text-sm text-gray-500">Get notified when items are running low</p>
                </div>
                <Switch id="low-stock-alerts" checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="activity-summary">Activity Summary</Label>
                  <p className="text-sm text-gray-500">Receive weekly summary of inventory activities</p>
                </div>
                <Switch id="activity-summary" checked={activitySummary} onCheckedChange={setActivitySummary} />
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="notification-email">Notification Email</Label>
                <Input id="notification-email" type="email" defaultValue={user?.email || ""} />
                <p className="text-sm text-gray-500">Email address for receiving notifications</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveNotificationSettings}>Save Notification Settings</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alert Thresholds</CardTitle>
              <CardDescription>Configure when alerts should be triggered.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-threshold">Custom Low Stock Threshold Override</Label>
                <Input id="custom-threshold" type="number" min="0" defaultValue="5" />
                <p className="text-sm text-gray-500">Override the default low stock threshold for alerts</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alert-frequency">Alert Frequency</Label>
                <Select defaultValue="daily">
                  <SelectTrigger id="alert-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="daily">Daily Digest</SelectItem>
                    <SelectItem value="weekly">Weekly Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button>Update Alert Settings</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

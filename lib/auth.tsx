"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const API_BASE_URL = 'https://depotix.ch/api'


const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [tokens, setTokens] = useState<AuthTokens | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Clean all auth data
  const cleanAuthData = () => {
    localStorage.removeItem("auth_tokens")
    localStorage.removeItem("auth_user")
    setTokens(null)
    setUser(null)
    setIsLoading(false)
  }

  // Initialize auth state from localStorage on component mount
  useEffect(() => {
    // Absolute failsafe: force loading to false after 15 seconds
    const maxLoadingTimeout = setTimeout(() => {
      console.warn("Auth initialization taking too long, forcing loading to false")
      setIsLoading(false)
    }, 15000)

    const storedTokens = localStorage.getItem("auth_tokens")

    if (storedTokens) {
      try {
        const parsedTokens = JSON.parse(storedTokens) as AuthTokens

        // Check if tokens seem valid (basic structure check)
        if (!parsedTokens.access || !parsedTokens.refresh) {
          console.warn("Invalid token structure, clearing storage")
          cleanAuthData()
          clearTimeout(maxLoadingTimeout)
          return
        }

        setTokens(parsedTokens)

        // Fetch user profile with the token
        fetchUserProfile(parsedTokens.access).finally(() => {
          clearTimeout(maxLoadingTimeout)
        })
      } catch (error) {
        console.error("Invalid tokens in localStorage, clearing:", error)
        cleanAuthData()
        clearTimeout(maxLoadingTimeout)
      }
    } else {
      setIsLoading(false)
      clearTimeout(maxLoadingTimeout)
    }

    return () => clearTimeout(maxLoadingTimeout)
  }, [])

  // Fetch user profile
  const fetchUserProfile = async (token: string) => {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(`${API_BASE_URL}/inventory/users/me/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        // If token is invalid, clear all auth data
        console.error(`Failed to fetch user profile: ${response.status} ${response.statusText}`)
        cleanAuthData()
        return
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
      cleanAuthData()
      return
    } finally {
      setIsLoading(false)
    }
  }

   // Helper function for API requests
   const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${API_BASE_URL}${endpoint}`
    const headers = {
      "Content-Type": "application/json",
      ...(tokens ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}))

        // Handle session termination (concurrent login detected)
        if (errorData.code === 'session_terminated') {
          localStorage.removeItem("auth_tokens")
          localStorage.removeItem("auth_user")
          setTokens(null)
          setUser(null)
          router.push("/login")
          throw new Error("Your session was terminated because another user logged in with your credentials.")
        }

        // Handle regular session expiration
        localStorage.removeItem("auth_tokens")
        localStorage.removeItem("auth_user")
        setTokens(null)
        setUser(null)
        router.push("/login")
        throw new Error("Session expired. Please login again.")
      }

      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || "Request failed")
    }

    return response.json()
  }

  // Login function
  const login = async (username: string, password: string) => {
    setIsLoading(true)

    try {
      // Get JWT token
      const tokenResponse = await fetch(`${API_BASE_URL}/token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json()
        throw new Error(errorData.detail || "Login failed")
      }

      const tokenData = await tokenResponse.json()

      // Save tokens 
      localStorage.setItem(
        "auth_tokens",
        JSON.stringify({
          access: tokenData.access,
          refresh: tokenData.refresh,
        }),
      )

      setTokens({
        access: tokenData.access,
        refresh: tokenData.refresh,
      })


      // Fetch user profile
      await fetchUserProfile(tokenData.access)

      // Redirect to dashboard
      router.push("/")
    } catch (error) {
      console.error("Login error:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Register function
  const register = async (userData: RegisterData) => {
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/inventory/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...userData,
          password_confirm: userData.password
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = Object.values(errorData).flat().join(", ")
        throw new Error(errorMessage || "Registration failed")
      }

      await login(userData.username, userData.password)
    } catch (error) {
      console.error("Registration error:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Update profile function
  const updateProfile = async (userData: Partial<User>) => {
    setIsLoading(true)

    try {
      const updatedUser = await fetchWithAuth("/inventory/users/me/", {
        method: "PATCH",
        body: JSON.stringify(userData),
      })

      // Update local storage and state with new user data
      const updatedUserData = { ...user, ...updatedUser }
      localStorage.setItem("auth_user", JSON.stringify(updatedUserData))
      setUser(updatedUserData)

      return updatedUser
    } catch (error) {
      console.error("Update profile error:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Change password function
  const changePassword = async (currentPassword: string, newPassword: string) => {
    setIsLoading(true)

    try {
      // Use the users/me endpoint with PATCH method for password change
      await fetchWithAuth("/inventory/users/me/", {
        method: "PATCH",
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
        }),
      })
    } catch (error) {
      console.error("Change password error:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Logout function
  const logout = async () => {
    if (tokens?.access) {
      try {
        // Call logout endpoint
        await fetch(`${API_BASE_URL}/inventory/users/logout/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
          },
        })
      } catch (error) {
        console.error("Logout error:", error)
      }
    }

    // Clear local storage and state regardless of API response
    localStorage.removeItem("auth_tokens")
    setTokens(null)
    setUser(null)
    router.push("/login")
  }

  return (
    <AuthContext.Provider value={{ user, tokens, isLoading, login, register, logout, updateProfile, changePassword }}>{children}</AuthContext.Provider>
  )
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

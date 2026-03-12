'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@0ne/ui'
import { Plus, Loader2 } from 'lucide-react'

interface PlaidLinkButtonProps {
  onSuccess: () => void
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExchanging, setIsExchanging] = useState(false)
  const shouldOpenRef = useRef(false)

  const fetchLinkToken = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/personal/banking/link-token', {
        method: 'POST',
      })
      const data = await response.json()
      if (data.link_token) {
        shouldOpenRef.current = true
        setLinkToken(data.link_token)
      } else {
        console.error('Failed to get link token:', data.error)
      }
    } catch (error) {
      console.error('Error fetching link token:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      setIsExchanging(true)
      try {
        const response = await fetch('/api/personal/banking/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken }),
        })
        const data = await response.json()
        if (data.success) {
          onSuccess()
        } else {
          console.error('Exchange token failed:', data.error)
        }
      } catch (error) {
        console.error('Error exchanging token:', error)
      } finally {
        setIsExchanging(false)
        setLinkToken(null)
      }
    },
    onExit: () => {
      setLinkToken(null)
    },
  })

  // Auto-open Plaid Link when token arrives and hook is ready
  useEffect(() => {
    if (linkToken && ready && shouldOpenRef.current) {
      shouldOpenRef.current = false
      open()
    }
  }, [linkToken, ready, open])

  const handleClick = async () => {
    if (linkToken && ready) {
      open()
    } else {
      await fetchLinkToken()
    }
  }

  return (
    <Button onClick={handleClick} disabled={isLoading || isExchanging}>
      {isLoading || isExchanging ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      {isExchanging ? 'Connecting...' : 'Connect Account'}
    </Button>
  )
}

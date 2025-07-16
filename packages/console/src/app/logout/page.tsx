'use client'
import { useW3 } from "@storacha/ui-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { usePlausible } from 'next-plausible'

export default function LogoutPage () {
  const [, { logout }] = useW3()
  const plausible = usePlausible()

  const router = useRouter()
  useEffect(function () {
    if (logout) {
      async function logOutAndRedirect () {
        await logout()
        plausible('Logout')
        router.push('/')
      }
      logOutAndRedirect()
    }
  }, [])
  return <></>
}
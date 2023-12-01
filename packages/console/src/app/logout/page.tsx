'use client'
import { useW3 } from "@w3ui/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LogoutPage () {
  const [, { logout }] = useW3()

  const router = useRouter()
  useEffect(function () {
    if (logout) {
      async function logOutAndRedirect () {
        await logout()
        router.push('/')
      }
      logOutAndRedirect()
    }
  }, [])
  return <></>
}
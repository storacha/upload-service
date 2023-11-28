'use client'
import { useKeyring } from "@w3ui/react-keyring"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LogoutPage () {
  const [, { unloadAgent }] = useKeyring()
  const router = useRouter()
  useEffect(function () {
    if (unloadAgent) {
      async function logOutAndRedirect () {
        await unloadAgent()
        router.push('/')
      }
      logOutAndRedirect()
    }
  }, [])
  return <></>
}
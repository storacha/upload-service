'use client'
//import { useW3 } from "@w3ui/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LogoutPage () {
  //const [, { unloadAgent }] = useW3()

  function unloadAgent(){
    // TODO need to figure out how this will work with the new library
  }
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
'use client';
import { use, type JSX } from "react";

import { ShareSpace } from '@/share'

export default function SharePage(props): JSX.Element {
  const params = use(props.params);
  return (
    <ShareSpace spaceDID={decodeURIComponent(params.did)}/>
  )
}

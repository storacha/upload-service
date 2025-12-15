'use client';
import { use, type JSX } from "react";

import { SpaceShare } from '@storacha/ui-react'

export default function SharePage(props): JSX.Element {
  const params = use(props.params);
  return (
    <SpaceShare spaceDID={decodeURIComponent(params.did)}/>
  )
}

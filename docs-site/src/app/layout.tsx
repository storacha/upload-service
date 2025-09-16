import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Console Toolkit Documentation',
  description: 'Documentation for the Console Toolkit - A comprehensive toolkit for building web console applications',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-epilogue bg-gray-900 text-gray-100">
        {children}
      </body>
    </html>
  )
}

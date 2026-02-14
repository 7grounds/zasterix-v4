import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Origo V4 | Command Center',
  description: 'Zentrales KI-Betriebssystem',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={`${inter.className} bg-slate-50 antialiased`}>
        {/* Hier gibt es keinen Header mehr, da dein Dashboard-Layout alles steuert */}
        {children}
      </body>
    </html>
  )
}

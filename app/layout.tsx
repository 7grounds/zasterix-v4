import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Origo V4 | Command Center',
  description: 'AI-Driven Operation System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={inter.className}>
        {/* Kein Header mehr hier – das Dashboard bringt alles mit */}
        {children}
      </body>
    </html>
  )
}

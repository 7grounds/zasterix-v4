import './globals.css'

export const metadata = {
  title: 'Zasterix v4 | Manager Chat',
  description: 'AI-Driven Wealth Engineering',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className="bg-slate-50 antialiased font-sans">
        {/* Hier gibt es keinen Header mehr, da dein Dashboard-Layout alles steuert */}
        {children}
      </body>
    </html>
  )
}

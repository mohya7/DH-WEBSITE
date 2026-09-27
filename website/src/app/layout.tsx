/*
 * Root layout. The ported stylesheets, fonts, header, and footer arrive in
 * Sections 3 and 5.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

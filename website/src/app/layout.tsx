/*
 * Shared root. The page supplies its design set and original body classes;
 * strip-runtime transfers the latter to this body in the static export.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

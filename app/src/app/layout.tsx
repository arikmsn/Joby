import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Joby / ShiftMatch",
  description: "Shift marketplace for temporary workers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}

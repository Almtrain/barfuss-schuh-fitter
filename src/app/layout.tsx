import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barfuss Schuh Fitter",
  description: "Mobile Passformberatung fuer Barfussschuhe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

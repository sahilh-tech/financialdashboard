import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Macro Liquidity Dashboard",
  description: "Macro liquidity regime dashboard."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-uiTextPrimary antialiased">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Body type is Inter, as on the Opencommerce site. Display and labels use the Neue Haas
// stack in globals.css, which falls back to Helvetica Neue.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agentcard shopping agent",
  icons: { icon: "/agentcard-trueblue-symbol.svg" },
  description: "Find products, book tables, and arrange deliveries with the Opencommerce shopping agent. An interactive demo by Agentcard.",
};

export const viewport: Viewport = { colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

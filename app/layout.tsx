import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020617",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aonpayapp.com"),
  title: "AON Pay | Calculadora de Envíos y Remesas",
  description: "Consulta y calcula las tasas de cambio referenciales en tiempo real con AON Pay.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "AON Pay | Calculadora de Envíos y Remesas",
    description: "Consulta y calcula las tasas de cambio referenciales en tiempo real con AON Pay.",
    url: "https://www.aonpayapp.com",
    siteName: "AON Pay",
    images: [
      {
        url: "/logo.png", // Apunta a public/logo.png
        width: 1200,
        height: 630,
        alt: "AON Pay Logo",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AON Pay | Calculadora de Envíos y Remesas",
    description: "Consulta y calcula las tasas de cambio referenciales en tiempo real con AON Pay.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}
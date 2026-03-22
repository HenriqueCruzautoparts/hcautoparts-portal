import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InstallPrompt } from "@/components/InstallPrompt";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://autoparts-portal.vercel.app"),
  title: "AutoParts AI - Busca Inteligente",
  description: "Portal de pesquisa inteligente de autopeças. Encontre a peça certa em segundos com ajuda da nossa IA.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/icon-512x512.png",
  },
  openGraph: {
    title: "AutoParts AI",
    description: "Portal de pesquisa inteligente de autopeças",
    url: "https://autoparts-portal.vercel.app",
    siteName: "AutoParts AI",
    images: [
      {
        url: "/icon-512x512.png", // Ícone principal
        width: 512,
        height: 512,
        alt: "AutoParts AI Logo"
      }
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AutoParts AI",
    description: "Portal de pesquisa inteligente de autopeças",
    images: ["/icon-512x512.png"],
  }
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}

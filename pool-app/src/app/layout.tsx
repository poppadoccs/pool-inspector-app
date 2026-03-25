import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pool Field Forms",
  description: "Digital job forms for pool installation crews",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pool Forms",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
      </head>
      <body className="min-h-full bg-white text-zinc-950">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: { fontSize: "16px", padding: "16px" },
          }}
        />
      </body>
    </html>
  );
}

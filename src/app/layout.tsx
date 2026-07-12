import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dv-crm.online";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "DigitalVetri | AI Sales Intelligence",
    template: "%s | DigitalVetri AI Sales Intelligence",
  },
  description:
    "AI-powered B2B prospect research, qualification and pipeline management for DigitalVetri.",
  applicationName: "DigitalVetri Sales Intelligence",
  // Private internal CRM — keep it out of search engines.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "DigitalVetri Sales Intelligence",
    title: "DigitalVetri | AI Sales Intelligence",
    description:
      "AI-powered B2B prospect research, qualification and pipeline management.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "DigitalVetri | AI Sales Intelligence",
    description:
      "AI-powered B2B prospect research, qualification and pipeline management.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} font-sans`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            forcedTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

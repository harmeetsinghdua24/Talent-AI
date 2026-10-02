import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/Toast";

const manrope = localFont({
  src: "./fonts/Manrope-Variable.ttf",
  variable: "--font-display",
  weight: "200 800",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/Inter-Variable.ttf",
  variable: "--font-body",
  weight: "300 800",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://talent-ai-eight.vercel.app"),

  title: {
    default: "Talent-AI | AI-Powered Recruitment & Talent Intelligence",
    template: "%s | Talent-AI",
  },

  description:
    "Talent-AI is an AI-powered recruitment and talent intelligence platform for smarter hiring, resume analysis, candidate matching, screening, and recruitment analytics.",

  keywords: [
    "Talent-AI",
    "AI recruitment platform",
    "AI-powered recruitment",
    "talent intelligence",
    "resume screening",
    "candidate matching",
    "AI hiring",
    "recruitment platform",
    "automated resume analysis",
  ],

  authors: [{ name: "Talent-AI" }],
  creator: "Talent-AI",
  applicationName: "Talent-AI",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },

  verification: {
    google: "HZMf_C2Q6vsU0TMCjShaNZK9uTozRdrIwX5GQvPWdi4",
  },

  openGraph: {
    type: "website",
    url: "https://talent-ai-eight.vercel.app",
    title: "Talent-AI | AI-Powered Recruitment & Talent Intelligence",
    description:
      "AI-powered resume analysis, candidate matching, screening, and recruitment intelligence.",
    siteName: "Talent-AI",
  },

  twitter: {
    card: "summary_large_image",
    title: "Talent-AI | AI-Powered Recruitment & Talent Intelligence",
    description:
      "AI-powered recruitment, resume screening, candidate matching, and talent intelligence.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} light`} style={{ colorScheme: "light" }}>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

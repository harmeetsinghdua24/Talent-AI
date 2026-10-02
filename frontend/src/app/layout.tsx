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
  title: "Talentum — AI-Powered Talent Intelligence",
  description:
    "Hire smarter with AI-powered resume analysis, semantic candidate matching, and explainable ranking.",
  verification: {
    google: "HZMf_C2Q6vsU0TMCjShaNZK9uTozRdrIwX5GQvPWdi4",
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

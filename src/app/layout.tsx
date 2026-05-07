import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/hooks/useAppState";
import { Toast } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "WhisperBox — End-to-End Encrypted Messaging",
  description:"Secure messaging with client-side E2EE. Server never sees your messages.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full overflow-hidden bg-[#0f0f0f] text-white antialiased">
        <AppProvider>
          <Toast />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

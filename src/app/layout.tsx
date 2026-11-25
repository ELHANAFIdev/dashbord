import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Supervision UMMC — Unités Médicales Mobiles Connectées",
  description: "Plateforme de supervision opérationnelle des 104 unités médicales mobiles connectées UMMC (Maroc).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-[#0b1120] text-slate-100 antialiased selection:bg-teal-500 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

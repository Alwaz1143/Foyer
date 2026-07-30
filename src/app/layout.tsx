import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "@/styles/styles.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CategoriesProvider } from "@/contexts/CategoriesContext";
import ErrorBoundary from "@/components/ErrorBoundary";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Home",
  description: "Personal browser homepage with search widgets and customizable website shortcuts",
  icons: "https://img.icons8.com/?size=100&id=eIM3rBvyFbHA&format=png&color=000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#667eea" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <CategoriesProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </CategoriesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

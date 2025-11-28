import "../styles/globals.css";
import type { Metadata } from "next";
import ThemeProvider from "../components/layout/ThemeProvider";
import AuthGuard from "../components/AuthGuard";
import { OrdersStatsProvider } from "./dashboard/orders-badge-context"; // 👈 add this

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Responsive dashboard",
   icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b0b0c] text-white overflow-hidden">
        <ThemeProvider>
          {/* 👇 Now EVERY protected page + Sidebar are inside OrdersStatsProvider */}
          <OrdersStatsProvider>
            <AuthGuard>{children}</AuthGuard>
          </OrdersStatsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

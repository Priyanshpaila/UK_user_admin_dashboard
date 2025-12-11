import "../styles/globals.css";
import type { Metadata } from "next";
import ThemeProvider from "../components/layout/ThemeProvider";
import AuthGuard from "../components/AuthGuard";
import { OrdersStatsProvider } from "./dashboard/orders-badge-context";

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
      <body className="bg-[#0b0b0c] text-white">
        <ThemeProvider>
          <OrdersStatsProvider>
            <AuthGuard>{children}</AuthGuard>
          </OrdersStatsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

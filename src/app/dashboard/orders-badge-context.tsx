"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getOrdersApi } from "../../api"; // 🔁 adjust path to your api.ts

type OrderStatus = "pending" | "approved" | "rejected" | "completed" | string;

type OrdersStats = {
  pending: number;
  approved: number;
};

type OrdersStatsContextShape = {
  stats: OrdersStats;
  refresh: () => Promise<void>;
  applyStatusChange: (prevStatus: OrderStatus, nextStatus: OrderStatus) => void;
};

const OrdersStatsContext = createContext<OrdersStatsContextShape | null>(null);

export function OrdersStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<OrdersStats>({
    pending: 0,
    approved: 0,
  });

  const refresh = useCallback(async () => {
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        getOrdersApi({ status: "pending", page: 1, limit: 1 }),
        getOrdersApi({ status: "approved", page: 1, limit: 1 }),
      ]);

      setStats({
        pending:
          pendingRes.meta?.total ??
          (Array.isArray(pendingRes.data) ? pendingRes.data.length : 0),
        approved:
          approvedRes.meta?.total ??
          (Array.isArray(approvedRes.data) ? approvedRes.data.length : 0),
      });
    } catch (err) {
      console.error("Failed to refresh order stats", err);
    }
  }, []);

  useEffect(() => {
    // initial load + polling every 30s
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const applyStatusChange = useCallback(
    (prevStatus: OrderStatus, nextStatus: OrderStatus) => {
      setStats((current) => {
        let { pending, approved } = current;

        // remove from old bucket
        if (prevStatus === "pending") pending = Math.max(0, pending - 1);
        if (prevStatus === "approved") approved = Math.max(0, approved - 1);

        // add to new bucket
        if (nextStatus === "pending") pending += 1;
        if (nextStatus === "approved") approved += 1;

        return { pending, approved };
      });
    },
    []
  );

  return (
    <OrdersStatsContext.Provider value={{ stats, refresh, applyStatusChange }}>
      {children}
    </OrdersStatsContext.Provider>
  );
}

export function useOrdersStats() {
  const ctx = useContext(OrdersStatsContext);
  if (!ctx) {
    throw new Error("useOrdersStats must be used within OrdersStatsProvider");
  }
  return ctx;
}

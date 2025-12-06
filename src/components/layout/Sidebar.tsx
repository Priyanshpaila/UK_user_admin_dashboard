"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  CalendarDays,
  Clock,
  Check,
  Bell,
  Settings,
  Users,
  FileText,
  ClipboardList,
  File,
  Archive,
  LucideIcon,
  LogOut,
  Atom,
  Pill,
  PackageX,
  PackageCheck,
  User,
  LayoutTemplate, // 👈 NEW icon for landing page builder
} from "lucide-react";
import { useOrdersStats } from "../../app/dashboard/orders-badge-context";

type MenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type MenuGroup = {
  group: string;
  items: MenuItem[];
};

type SidebarEntry = MenuItem | MenuGroup;

const menu: SidebarEntry[] = [
  { key: "/dashboard", label: "Dashboard", icon: Home },
  {
    key: "/dashboard/pending-approval",
    label: "Pending Approval",
    icon: Clock,
  },
  {
    key: "/dashboard/approved-orders",
    label: "Approved Orders",
    icon: Check,
  },
  {
    group: "Notifications",
    items: [
      { key: "/dashboard/appointments", label: "Appointments", icon: Bell },
    ],
  },
  {
    group: "Operations",
    items: [
      { key: "/dashboard/services", label: "Services", icon: Settings },
      // { key: "/dashboard/medicine", label: "Medicines", icon: Pill },
    ],
  },
  {
    group: "Tenant",
    items: [{ key: "/dashboard/tenant", label: "Tenant", icon: Atom }],
  },
  {
    group: "People",
    items: [{ key: "/dashboard/patients", label: "Patients", icon: Users }],
  },
  {
    group: "Front",
    items: [
      { key: "/dashboard/pages", label: "Pages", icon: FileText },
      {
        key: "/dashboard/landing",          // 👈 NEW route for landing page creation
        label: "Landing Page Builder",      // text in sidebar
        icon: LayoutTemplate,               // uses new icon
      },
    ],
  },
  {
    group: "Logs",
    items: [
      { key: "/dashboard/clinic-logs", label: "Clinic Logs", icon: Archive },
    ],
  },
  {
    group: "Scheduling",
    items: [
      { key: "/dashboard/schedules", label: "Schedules", icon: CalendarDays },
    ],
  },
  {
    group: "Orders",
    items: [
      {
        key: "/dashboard/orders/completed",
        label: "Completed",
        icon: PackageCheck,
      },
      {
        key: "/dashboard/orders/rejected",
        label: "Rejected",
        icon: PackageX,
      },
      {
        key: "/dashboard/orders/unpaid",
        label: "Unpaid",
        icon: ClipboardList,
      },
    ],
  },
  {
    group: "Forms",
    items: [{ key: "/dashboard/forms", label: "Forms", icon: File }],
  },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const path = usePathname() || "/dashboard";
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  const { stats } = useOrdersStats();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;

      const parsed = JSON.parse(raw);
      setIsAdmin(!!parsed.is_admin);
    } catch (err) {
      console.error("Failed to read user from localStorage", err);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("session_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  // 🔐 Hide Tenant group if user is not admin
  const filteredMenu = menu.filter((m) => {
    if ("group" in m && m.group === "Tenant" && !isAdmin) {
      return false;
    }
    return true;
  });

  const profileActive = path.startsWith("/dashboard/profile");

  return (
    <aside className="w-64 bg-[#0b0b0c] border-r border-neutral-800 min-h-screen flex flex-col">
      {/* Scrollable menu */}
      <div className="flex-1 px-2 overflow-y-auto custom-scrollbar">
        {filteredMenu.map((m, idx) => {
          if ("group" in m) {
            return (
              <div key={idx} className="mt-4">
                <div className="px-3 text-xs text-neutral-400 uppercase tracking-wider">
                  {m.group}
                </div>

                <div className="mt-2 space-y-1">
                  {m.items.map((it) => {
                    const Icon = it.icon;
                    const active = path === it.key;
                    return (
                      <Link
                        onClick={onClose}
                        key={it.key}
                        href={it.key}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md ${
                          active
                            ? "bg-neutral-800 text-white"
                            : "text-neutral-300 hover:bg-neutral-800/40"
                        }`}
                      >
                        <Icon size={16} />
                        <span className="truncate">{it.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          // top-level items (Dashboard, Pending, Approved)
          const isPending = m.key === "/dashboard/pending-approval";
          const isApproved = m.key === "/dashboard/approved-orders";

          const badge =
            isPending ? stats.pending : isApproved ? stats.approved : m.badge;

          const active = path === m.key;

          return (
            <div key={idx} className="mt-2">
              <Link
                onClick={onClose}
                href={m.key}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
                  active
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm"
                    : "text-neutral-300 hover:bg-neutral-800/40 hover:text-white"
                }`}
              >
                <div
                  className={`p-2 rounded-md transition-colors ${
                    active
                      ? "bg-blue-600/30"
                      : "bg-neutral-800 group-hover:bg-neutral-700"
                  }`}
                >
                  <m.icon
                    size={16}
                    className={
                      active
                        ? "text-blue-400"
                        : "text-neutral-400 group-hover:text-white"
                    }
                  />
                </div>

                <span className="truncate font-medium tracking-wide">
                  {m.label}
                </span>

                {badge !== undefined && badge !== null && (
                  <span
                    className={`ml-auto text-xs font-semibold rounded-md px-2 py-0.5 ${
                      active
                        ? "bg-blue-500 text-white"
                        : "bg-yellow-400 text-black"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Bottom fixed area: Profile + Logout */}
      <div className="p-5 border-t border-neutral-800 space-y-2">
        <Link
          href="/dashboard/profile"
          onClick={onClose}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition font-medium text-sm ${
            profileActive
              ? "bg-neutral-800 text-white"
              : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          }`}
        >
          <User size={16} />
          <span>Profile</span>
        </Link>

        <button
          onClick={() => {
            logout();
            onClose?.();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 transition text-red-400 hover:text-red-300 font-medium text-sm"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

"use client";
import React from "react";
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
} from "lucide-react";

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
    badge: 97,
  },
  {
    key: "/dashboard/approved-orders",
    label: "Approved Orders",
    icon: Check,
    badge: 53,
  },
  {
    group: "Notifications",
    items: [{ key: "/dashboard/appointments", label: "Appointments", icon: Bell }],
  },
  {
    group: "Operations",
    items: [{ key: "/dashboard/services", label: "Services", icon: Settings }],
  },
  {
    group: "People",
    items: [{ key: "/dashboard/patients", label: "Patients", icon: Users }],
  },
  {
    group: "Front",
    items: [{ key: "/dashboard/pages", label: "Pages", icon: FileText }],
  },
  {
    group: "Logs",
    items: [{ key: "/dashboard/clinic-logs", label: "Clinic Logs", icon: Archive }],
  },
  {
    group: "Scheduling",
    items: [{ key: "/dashboard/schedules", label: "Schedules", icon: CalendarDays }],
  },
  {
    group: "Orders",
    items: [
      { key: "/dashboard/orders/completed", label: "Completed", icon: Check },
      { key: "/dashboard/orders/rejected", label: "Rejected", icon: Clock },
      { key: "/dashboard/orders/unpaid", label: "Unpaid", icon: ClipboardList },
    ],
  },
  {
    group: "Forms",
    items: [
      { key: "/dashboard/forms/create", label: "Create Form", icon: File },
      { key: "/dashboard/forms/edit", label: "Edit Form", icon: File },
    ],
  },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const path = usePathname() || "/dashboard";
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem("session_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-[#0b0b0c] border-r border-neutral-800 min-h-screen flex flex-col">

      {/* Scrollable menu */}
      <div className="flex-1 px-2 overflow-y-auto custom-scrollbar">
        {menu.map((m, idx) =>
          "group" in m ? (
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
          ) : (
            <div key={idx} className="mt-2">
              <Link
                onClick={onClose}
                href={m.key}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
                  path === m.key
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm"
                    : "text-neutral-300 hover:bg-neutral-800/40 hover:text-white"
                }`}
              >
                <div
                  className={`p-2 rounded-md transition-colors ${
                    path === m.key ? "bg-blue-600/30" : "bg-neutral-800 group-hover:bg-neutral-700"
                  }`}
                >
                  <m.icon
                    size={16}
                    className={
                      path === m.key
                        ? "text-blue-400"
                        : "text-neutral-400 group-hover:text-white"
                    }
                  />
                </div>

                <span className="truncate font-medium tracking-wide">
                  {m.label}
                </span>

                {m.badge && (
                  <span
                    className={`ml-auto text-xs font-semibold rounded-md px-2 py-0.5 ${
                      path === m.key
                        ? "bg-blue-500 text-white"
                        : "bg-yellow-400 text-black"
                    }`}
                  >
                    {m.badge}
                  </span>
                )}
              </Link>
            </div>
          )
        )}
      </div>

      {/* Logout */}
      <div className="p-5 border-t border-neutral-800">
        <button
          onClick={() => {
            logout();
            onClose?.();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 transition text-red-400 hover:text-red-300 font-medium"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

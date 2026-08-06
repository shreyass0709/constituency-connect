import {
  ClipboardList,
  Inbox,
  LayoutDashboard,
  MessageSquarePlus,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Section } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// Sidebar/bottom-nav contents per role-scoped section. Each phase appends its routes
// here — a link only exists once the page it points at does.
export const NAV_BY_SECTION: Record<Section, NavItem[]> = {
  "/dashboard": [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/raise", label: "Raise", icon: MessageSquarePlus },
    { href: "/dashboard/complaints", label: "My concerns", icon: ClipboardList },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ],
  "/office": [
    { href: "/office", label: "Dashboard", icon: LayoutDashboard },
    { href: "/office/triage", label: "Triage", icon: Inbox },
    { href: "/office/complaints", label: "Complaints", icon: ClipboardList },
  ],
  "/department": [{ href: "/department", label: "Queue", icon: Inbox }],
  "/field": [{ href: "/field", label: "My tasks", icon: ClipboardList }],
};

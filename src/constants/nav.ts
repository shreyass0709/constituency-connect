import { ClipboardList, Inbox, LayoutDashboard, type LucideIcon } from "lucide-react";
import type { Section } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// Sidebar/bottom-nav contents per role-scoped section. Each phase appends its routes
// here — a link only exists once the page it points at does.
export const NAV_BY_SECTION: Record<Section, NavItem[]> = {
  "/dashboard": [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  "/office": [{ href: "/office", label: "Dashboard", icon: LayoutDashboard }],
  "/department": [{ href: "/department", label: "Queue", icon: Inbox }],
  "/field": [{ href: "/field", label: "My tasks", icon: ClipboardList }],
};

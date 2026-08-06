import {
  ChartColumn,
  ClipboardList,
  FileText,
  HandHeart,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  MessageSquarePlus,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Section } from "@/lib/auth/permissions";

/** `labelKey` indexes the `nav` namespace in src/i18n — never a literal string. */
export type NavItem = { href: string; labelKey: string; icon: LucideIcon };

// Sidebar/bottom-nav contents per role-scoped section. Each phase appends its routes
// here — a link only exists once the page it points at does.
export const NAV_BY_SECTION: Record<Section, NavItem[]> = {
  "/dashboard": [
    { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
    { href: "/dashboard/raise", labelKey: "raise", icon: MessageSquarePlus },
    { href: "/dashboard/complaints", labelKey: "concerns", icon: ClipboardList },
    { href: "/dashboard/engage", labelKey: "engage", icon: HandHeart },
    { href: "/dashboard/chat", labelKey: "messages", icon: MessageSquare },
    { href: "/dashboard/settings", labelKey: "settings", icon: Settings },
  ],
  "/office": [
    { href: "/office", labelKey: "dashboard", icon: LayoutDashboard },
    { href: "/office/triage", labelKey: "triage", icon: Inbox },
    { href: "/office/complaints", labelKey: "complaints", icon: ClipboardList },
    { href: "/office/engagement", labelKey: "engagement", icon: HandHeart },
    { href: "/office/chat", labelKey: "messages", icon: MessageSquare },
    { href: "/office/analytics", labelKey: "analytics", icon: ChartColumn },
    { href: "/office/reports", labelKey: "reports", icon: FileText },
    { href: "/office/content", labelKey: "content", icon: FileText },
  ],
  "/department": [{ href: "/department", labelKey: "queue", icon: Inbox }],
  "/field": [{ href: "/field", labelKey: "myTasks", icon: ClipboardList }],
};

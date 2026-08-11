"use client";

import { type LucideIcon, PanelLeftClose } from "lucide-react";
import PanelLeftOpen from "lucide-react/icons/panel-left-open";

import { useTranslation } from "@/components/locale-provider";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { NavLink } from "../nav-link";

export interface NavMainItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  end?: boolean;
  badgeCount?: number;
}

interface NavMainGroup {
  label?: string;
  tourId?: string;
  items: NavMainItem[];
}

const NAV_ITEM_TOUR_MAP: Record<string, string> = {
  dashboard: "dashboard-nav",
  templates: "templates-nav",
  workflows: "workflows-nav",
  executions: "executions-nav",
  playground: "playground-nav",
  emails: "emails-nav",
  queues: "queues-nav",
  databases: "databases-nav",
  integrations: "integrations-nav",
  secrets: "secrets-nav",
  "api-keys": "api-keys-nav",
  members: "members-nav",
  billing: "billing-nav",
};

function NavMainItemRow({ item }: { item: NavMainItem }) {
  const dataTour = NAV_ITEM_TOUR_MAP[item.id];

  return (
    <SidebarMenuItem data-tour={dataTour}>
      <SidebarMenuButton
        asChild
        tooltip={item.title}
        className="hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
      >
        <NavLink
          to={item.url}
          end={item.end}
          className="overflow-hidden whitespace-nowrap"
          activeClassName="[&>span]:text-foreground! bg-neutral-300/50 dark:bg-neutral-600/50 hover:bg-neutral-300/50 dark:hover:bg-neutral-600/50 focus:bg-neutral-300/50 dark:focus:bg-neutral-600/50 active:bg-neutral-300/50 dark:active:bg-neutral-600/50"
        >
          {item.icon && <item.icon />}
          <span className="text-sm text-neutral-600 dark:text-neutral-400 group-data-[collapsible=icon]:hidden">
            {item.title}
          </span>
          {item.badgeCount && item.badgeCount > 0 ? (
            <span className="ml-auto rounded-full bg-blue-600 text-white! text-[10px] leading-none px-1.5 py-0.5 group-data-[collapsible=icon]:hidden">
              {item.badgeCount > 99 ? "99+" : item.badgeCount}
            </span>
          ) : null}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export interface NavMainProps {
  title: string;
  groups: NavMainGroup[];
  footerItems?: NavMainItem[];
}

export function NavMain({ groups, footerItems }: NavMainProps) {
  const { toggleSidebar, open } = useSidebar();
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col justify-between pt-4 pb-0">
      <div className="flex flex-col gap-2 px-4">
        {groups.map((group, index) => (
          <SidebarGroup
            key={group.label || index}
            className="bg-transparent p-0"
            data-tour={
              group.tourId ? `${group.tourId}-nav-group` : undefined
            }
          >
            {group.label && (
              <SidebarGroupLabel className="text-xs text-neutral-500 dark:text-neutral-400 px-2">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu className="bg-transparent">
              {group.items.map((item) => (
                <NavMainItemRow key={item.id} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </div>
      <SidebarGroup className="bg-transparent p-0">
        <SidebarMenu className="bg-transparent px-4">
          {footerItems &&
            footerItems.map((item) => (
              <NavMainItemRow key={item.id} item={item} />
            ))}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t("common.toggleSidebar")}
              onClick={toggleSidebar}
              className="hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors mt-1 mb-5 overflow-hidden whitespace-nowrap"
            >
              {open ? <PanelLeftClose /> : <PanelLeftOpen />}
              <span className="uppercase text-semibold text-xs group-data-[collapsible=icon]:hidden">
                {t("common.collapse")}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </div>
  );
}

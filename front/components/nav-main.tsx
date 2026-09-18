"use client"

import Link from "next/link"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"

export function NavMain({
  items,
  label = "Platform",
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    badge?: string
    items?: {
      title: string
      url: string
      badge?: string
    }[]
  }[]
  label?: string
}) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = Boolean(item.items && item.items.length > 0);

          if (!hasChildren) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={<Link href={item.url} />}
                  tooltip={item.title}
                  isActive={item.isActive}
                >
                  {item.icon}
                  <span>{item.title}</span>
                  {item.badge && (
                    <span
                      className={`ml-auto rounded-full text-[10px] font-bold px-2 py-0.5 tracking-wide ${
                        item.badge.toLowerCase() === "new"
                          ? "bg-amber-500/20 border border-amber-500/30 text-amber-500"
                          : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible
              key={item.title}
              defaultOpen={item.isActive}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={<SidebarMenuButton tooltip={item.title} />}
              >
                {item.icon}
                <span>{item.title}</span>
                {item.badge && (
                  <span
                    className={`ml-auto mr-1 rounded-full text-[10px] font-bold px-2 py-0.5 tracking-wide ${
                      item.badge.toLowerCase() === "new"
                        ? "bg-amber-500/20 border border-amber-500/30 text-amber-500"
                        : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton render={<Link href={subItem.url} />}>
                        <span>{subItem.title}</span>
                        {subItem.badge && (
                          <span className="ml-auto text-[10px] font-bold text-primary">
                            {subItem.badge}
                          </span>
                        )}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

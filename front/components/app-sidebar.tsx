"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  GalleryVerticalEndIcon,
  TerminalSquareIcon,
  BotIcon,
  BookOpenIcon,
  Settings2Icon,
  PieChartIcon,
  MapIcon,
  PanelLeftIcon,
  GraduationCapIcon,
  ClipboardCheckIcon,
  VideoIcon,
  ZapIcon,
  Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/useAuthStore"

const data = {
  navMain: [
    {
      title: "Playground",
      url: "#",
      icon: (
        <TerminalSquareIcon
        />
      ),
      isActive: true,
      items: [
        {
          title: "History",
          url: "#",
        },
        {
          title: "Starred",
          url: "#",
        },
        {
          title: "Settings",
          url: "#",
        },
      ],
    },
    {
      title: "Models",
      url: "#",
      icon: (
        <BotIcon
        />
      ),
      items: [
        {
          title: "Genesis",
          url: "#",
        },
        {
          title: "Explorer",
          url: "#",
        },
        {
          title: "Quantum",
          url: "#",
        },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: (
        <BookOpenIcon
        />
      ),
      items: [
        {
          title: "Introduction",
          url: "#",
        },
        {
          title: "Get Started",
          url: "#",
        },
        {
          title: "Tutorials",
          url: "#",
        },
        {
          title: "Changelog",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: (
        <Settings2Icon
        />
      ),
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Limits",
          url: "#",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Sales & Marketing",
      url: "#",
      icon: (
        <PieChartIcon
        />
      ),
    },
    {
      name: "Travel",
      url: "#",
      icon: (
        <MapIcon
        />
      ),
    },
  ],
}

function SidebarHeaderLogo() {
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div
          className={cn(
            "flex w-full items-center justify-between text-sidebar-foreground",
            "group-data-[collapsible=icon]:justify-center"
          )}
        >
          <div
            className={cn(
              "relative group/logo flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg",
              "bg-sidebar-primary text-sidebar-primary-foreground cursor-pointer transition-all hover:bg-sidebar-primary/90",
              "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:hover:bg-sidebar-accent"
            )}
            onClick={() => {
              if (isCollapsed) {
                toggleSidebar()
              }
            }}
            title={isCollapsed ? "Open sidebar" : undefined}
          >
            <GalleryVerticalEndIcon
              className={cn(
                "size-4 transition-all",
                "group-data-[collapsible=icon]:group-hover/logo:opacity-0 group-data-[collapsible=icon]:group-hover/logo:scale-75"
              )}
            />

            <PanelLeftIcon
              className={cn(
                "absolute size-4 opacity-0 scale-75 transition-all",
                "group-data-[collapsible=icon]:group-hover/logo:opacity-100 group-data-[collapsible=icon]:group-hover/logo:scale-100"
              )}
            />
          </div>

          <div
            className={cn(
              "flex flex-col gap-0.5 leading-none ml-2 flex-1",
              "group-data-[collapsible=icon]:hidden"
            )}
          >
            <span className="font-bold">Schoolmini</span>
            <span className="text-xs text-sidebar-foreground/70 font-sub">
              Enterprise
            </span>
          </div>

          <SidebarTrigger className="ml-auto group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuthStore()

  const showDashboard = user?.role === "TEACHER" || user?.role === "PRINCIPAL"

  const teacherNavItems = [
    {
      title: "Dashboard",
      url: "/teacher",
      icon: <GraduationCapIcon className="size-4" />,
      isActive: true,
    },
    {
      title: "Onboarding Details",
      url: "/teacher?view=onboarding-details",
      icon: <ClipboardCheckIcon className="size-4" />,
      items: [
        { title: "Basic Information", url: "/teacher?section=basic" },
        { title: "Personal Details", url: "/teacher?section=completion" },
        { title: "Document Upload", url: "/teacher/documents" },
        { title: "Availability", url: "/teacher?section=availability" },
      ],
    },
    {
      title: "Demo Class",
      url: "/teacher?section=demo",
      icon: <VideoIcon className="size-4" />,
      badge: (user?.demoClassCompleted || Boolean(user?.demoVideoUrl && user.demoVideoUrl.trim().length > 0) || Boolean(user?.teacherProfile?.demoVideoUrl && user.teacherProfile.demoVideoUrl.trim().length > 0)) ? undefined : "New",
    },
    {
      title: "Skill Assessment",
      url: "/teacher?section=skills",
      icon: <ZapIcon className="size-4" />,
      badge: user?.skillAssessmentCompleted ? undefined : "New",
    },
  ]

  const principalNavItems = [
    {
      title: "Dashboard",
      url: "/principal",
      icon: <Building2 className="size-4" />,
      isActive: true,
    },
    {
      title: "Onboarding Details",
      url: "/principal?view=onboarding-details",
      icon: <ClipboardCheckIcon className="size-4" />,
      items: [
        { title: "Basic Information", url: "/principal?section=basic" },
        { title: "Leadership & Qualifications", url: "/principal?section=completion" },
        { title: "Verified Documents", url: "/principal?section=documents" },
      ],
    },
  ]

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarHeaderLogo />
      </SidebarHeader>
      <SidebarContent>
        {showDashboard && (
          <NavMain
            items={user?.role === "TEACHER" ? teacherNavItems : principalNavItems}
            label=""
          />
        )}
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

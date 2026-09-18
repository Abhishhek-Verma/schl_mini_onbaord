"use client"

import Link from "next/link"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuthStore } from "@/store/useAuthStore"
import { ChevronsUpDownIcon, SparklesIcon, BadgeCheckIcon, CreditCardIcon, BellIcon, LogOutIcon, ShieldIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchApi } from "@/lib/api"
import { useRouter } from "next/navigation"

interface NavUserProps {
  user?: {
    name?: string
    displayName?: string
    username?: string
    email?: string
    avatar?: string | null
    role?: string
  }
}

export function NavUser({ user: userProp }: NavUserProps = {}) {
  const { isMobile } = useSidebar()
  const { user: storeUser, isHydrated, logout } = useAuthStore()
  const router = useRouter()

  const user = userProp || storeUser

  if (!isHydrated || !user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 p-2 rounded-md">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <Skeleton className="h-3.5 w-24 rounded-xs" />
              <Skeleton className="h-2.5 w-32 rounded-xs" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const displayName =
    ('displayName' in user && user.displayName) ||
    ('name' in user && user.name) ||
    ('username' in user && user.username) ||
    "User"
  const email = user.email || ""
  const avatar = user.avatar || undefined
  const role = ('role' in user && user.role) || undefined
  const initials = displayName.slice(0, 2).toUpperCase()


  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', {
        method: 'POST',
      });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      logout();
      router.push('/login');
    }
  };
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={avatar} alt={displayName} referrerPolicy="no-referrer" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs">{email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={avatar} alt={displayName} referrerPolicy="no-referrer" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <SparklesIcon />
                Upgrade to Mini-Max
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {role === 'SUPER_ADMIN' && (
                <DropdownMenuItem render={<Link href="/admin" />}>
                  <ShieldIcon className="text-pink-500" />
                  Admin Portal
                </DropdownMenuItem>
              )}
              <DropdownMenuItem render={<Link href="/profile" />}>
                <BadgeCheckIcon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

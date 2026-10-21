import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Home, FileText, PlusCircle, Map, BarChart3, Users, User, Settings, Building2, FolderOpen, HardHat, ClipboardList, Shield, Bell } from 'lucide-react';
export const navConfig = {
    citizen: [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Announcements', href: '/dashboard#announcements', icon: ClipboardList },
        { name: 'File Complaint', href: '/complaints/new', icon: PlusCircle },
        { name: 'My Complaints', href: '/complaints', icon: FileText },
        { name: 'Nearby', href: '/nearby', icon: Map },
        { name: 'Public Projects', href: '/projects', icon: HardHat },
    ],
    contractor: [
        { name: 'Dashboard', href: '/contractor', icon: HardHat },
        { name: 'My Jobs', href: '/contractor/jobs', icon: ClipboardList },
        { name: 'My Work Map', href: '/contractor/map', icon: Map },
        { name: 'Notifications', href: '/contractor/notifications', icon: Bell },
        { name: 'Profile', href: '/profile', icon: User },
    ],
    officer: [
        { name: 'Dept Dashboard', href: '/department', icon: Building2 },
        { name: 'Profile', href: '/profile', icon: User },
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Assigned Complaints', href: '/complaints', icon: ClipboardList },
        { name: 'Ward Map', href: '/map', icon: Map },
        { name: 'Reports', href: '/reports', icon: BarChart3 },
    ],
    department_head: [
        { name: 'Dept Dashboard', href: '/department', icon: Building2 },
        { name: 'Profile', href: '/profile', icon: User },
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Complaints', href: '/complaints', icon: FileText },
        { name: 'Department Map', href: '/map', icon: Map },
        { name: 'Officers', href: '/officers', icon: Users },
        { name: 'Analytics', href: '/analytics', icon: BarChart3 },
        { name: 'Reports', href: '/reports', icon: ClipboardList },
    ],
    admin: [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Profile', href: '/profile', icon: User },
        { name: 'User Management', href: '/users', icon: Users },
        { name: 'Complaints', href: '/complaints', icon: FileText },
        { name: 'Departments', href: '/departments', icon: Building2 },
        { name: 'Analytics', href: '/analytics', icon: BarChart3 },
        { name: 'City Map', href: '/map', icon: Map },
        { name: 'Documents', href: '/documents', icon: FolderOpen },
        { name: 'Projects', href: '/projects', icon: HardHat },
        { name: 'Settings', href: '/settings', icon: Settings },
    ],
};
function getNavItemsForRole(role) {
    switch (role) {
        case 'contractor':
            return navConfig.contractor;
        case 'officer':
            return navConfig.officer;
        case 'department_head':
            return navConfig.department_head;
        case 'admin':
            return navConfig.admin;
        default:
            return navConfig.citizen;
    }
}
export function NavBar() {
    const location = useLocation();
    const { user } = useAuth();
    const navItems = getNavItemsForRole(user?.role);
    return (<nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto whitespace-nowrap pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {navItems.map((item) => {
            const hasHash = item.href.includes('#');
            const [itemPath, itemHash] = item.href.split('#');
            const isActive = hasHash
                ? location.pathname === itemPath && location.hash === `#${itemHash}`
                : location.pathname === item.href;
            return (<Link key={item.name} to={item.href} className={cn('flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-center transition-colors shrink-0', isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
            <item.icon className="h-4 w-4 shrink-0"/>
            <span className="hidden xl:inline">{item.name}</span>
          </Link>);
        })}
    </nav>);
}
export function NavBarWithLogo() {
    return (<div className="flex items-center gap-4 md:gap-6 min-w-0 flex-1">
      <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-5 w-5 text-primary-foreground"/>
        </div>
        <span className="font-bold text-foreground hidden sm:inline">CitiCare</span>
      </Link>
      <div className="h-6 w-px bg-border hidden md:block"/>
      <NavBar />
    </div>);
}
export function getNavItems(role) {
    return getNavItemsForRole(role);
}

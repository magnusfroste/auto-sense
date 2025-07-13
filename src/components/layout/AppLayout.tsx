import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { 
  Navigation, 
  LogOut, 
  Route as RouteIcon, 
  MapPin, 
  FileText, 
  Settings,
  Menu
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Navigation },
  { name: 'Pågående resa', href: '/trip/active', icon: RouteIcon },
  { name: 'Mina resor', href: '/trips', icon: MapPin },
  { name: 'Rapporter', href: '/reports', icon: FileText },
  { name: 'Inställningar', href: '/settings', icon: Settings },
];

const NavItems = ({ isMobile = false, onItemClick = () => {} }) => {
  const location = useLocation();
  
  return (
    <>
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={onItemClick}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            } ${isMobile ? 'justify-start' : 'justify-center lg:justify-start'}`}
          >
            <item.icon className={`h-5 w-5 ${isMobile ? 'mr-3' : 'lg:mr-3'}`} />
            <span className={isMobile ? 'block' : 'hidden lg:block'}>
              {item.name}
            </span>
          </NavLink>
        );
      })}
    </>
  );
};

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="flex items-center mb-6">
                  <div className="flex items-center">
                    <RouteIcon className="h-8 w-8 text-primary mr-2" />
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                      RouteSense
                    </span>
                  </div>
                </div>
                <nav className="space-y-2">
                  <NavItems 
                    isMobile={true} 
                    onItemClick={() => setMobileMenuOpen(false)} 
                  />
                </nav>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                    <div className="text-sm">
                      <p className="font-medium">{user?.user_metadata?.full_name || 'Användare'}</p>
                      <p className="text-muted-foreground">{user?.email}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex items-center">
            <RouteIcon className="h-6 w-6 text-primary mr-2" />
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              RouteSense
            </span>
          </div>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
          <div className="flex flex-col flex-grow bg-card border-r">
            {/* Logo */}
            <div className="flex items-center h-16 px-4 border-b">
              <RouteIcon className="h-8 w-8 text-primary mr-2" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                RouteSense
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-2">
              <NavItems />
            </nav>

            {/* User info */}
            <div className="p-4 border-t">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div className="text-sm">
                  <p className="font-medium">{user?.user_metadata?.full_name || 'Användare'}</p>
                  <p className="text-muted-foreground truncate">{user?.email}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-64 flex flex-col flex-1">
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
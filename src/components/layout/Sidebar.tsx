import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  LogOut, 
  ChevronRight,
  ChevronLeft,
  Users,
  Menu,
  X,
  ShoppingBag,
  Activity,
  UserCircle,
  AlertTriangle,
  Building,
  FileText
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(window.innerWidth >= 768);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const navItems = [
    { 
      path: '/dashboard', 
      name: 'Dashboard', 
      icon: <LayoutDashboard className="h-5 w-5" />,
      roles: ['admin', 'manager', 'staff']
    },
    { 
      path: '/products', 
      name: 'Products', 
      icon: <Package className="h-5 w-5" />, 
      roles: ['admin', 'manager', 'staff']
    },
    { 
      path: '/orders', 
      name: 'Orders', 
      icon: <ShoppingBag className="h-5 w-5" />, 
      roles: ['admin', 'manager', 'staff']
    },
    {
      path: '/activities',
      name: 'Activity Log',
      icon: <Activity className="h-5 w-5" />,
      roles: ['admin', 'manager', 'staff']
    },
    {
      path: '/alerts',
      name: 'Low Stock',
      icon: <AlertTriangle className="h-5 w-5" />,
      roles: ['admin', 'manager', 'staff']
    },
    {
      path: '/crm',
      name: 'CRM',
      icon: <Building className="h-5 w-5" />,
      roles: ['admin', 'manager', 'staff']
    },
    {
      path: '/reporting',
      name: 'Reporting',
      icon: <FileText className="h-5 w-5" />,
      roles: ['admin', 'manager']
    },
    { 
      path: '/settings', 
      name: 'Settings', 
      icon: <Settings className="h-5 w-5" />,
      roles: ['admin', 'manager']
    },
    {
      path: '/users',
      name: 'Users',
      icon: <Users className="h-5 w-5" />,
      roles: ['admin']
    },
    {
      path: '/profile',
      name: 'Your Profile',
      icon: <UserCircle className="h-5 w-5" />,
      roles: ['admin', 'manager', 'staff']
    }
  ];

  const toggleMobileSidebar = () => {
    setMobileOpen(!mobileOpen);
  };

  // Common sidebar content
  const sidebarContent = (
    <>
      <div className="flex items-center justify-between p-4 border-b border-gray-900">
        {!collapsed && (
          <div className="font-bold text-xl">Inventory Pro</div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md hover:bg-gray-700 transition-colors hidden md:block"
        >
          {collapsed ? 
            <ChevronRight className="h-5 w-5" /> : 
            <ChevronLeft className="h-5 w-5" />
          }
        </button>
        <button 
          onClick={toggleMobileSidebar}
          className="p-1 rounded-md bg-gradient-to-r hover:from-bg-indigo-700 hover:to-bg-gray-900 transition-colors md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex-1 py-4">
        <ul className="space-y-2 px-2">
          {navItems.map((item) => (
            // Only show nav items the user has permission to see
            currentUser && item.roles.includes(currentUser.role) && (
              <li key={item.path}>
                <div 
                  className="relative"
                  onMouseEnter={() => setHoveredItem(item.name)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <NavLink
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center p-2 bg-gradient-to-r rounded-md ${
                        isActive ? 'from-pink-500 to-indigo-700 text-white' : 'text-white hover:from-pink-500 hover:to-transparent'
                      } transition-colors`
                    }
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="ml-3">{item.name}</span>}
                  </NavLink>
                  {collapsed && hoveredItem === item.name && (
                    <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 z-10 whitespace-nowrap">
                      {item.name}
                    </div>
                  )}
                </div>
              </li>
            )
          ))}
        </ul>
      </div>
      
      <div className="p-4 border-t border-gray-900">
        {!collapsed && currentUser && (
          <div className="mb-4 px-2">
            <div className="font-medium">{currentUser.displayName}</div>
            <div className="text-xs text-indigo-300 capitalize">{currentUser.role}</div>
          </div>
        )}
        <div
          className="relative"
          onMouseEnter={() => setHoveredItem("Logout")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={handleLogout}
            className="flex items-center p-2 w-full rounded-md text-indigo-100 hover:bg-indigo-700 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="ml-3">Logout</span>}
          </button>
          {collapsed && hoveredItem === "Logout" && (
            <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 z-10">
              Logout
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden absolute top-3 left-1 z-20">
        <button
          onClick={toggleMobileSidebar}
          className="p-2 rounded-md bg-gray-200 text-black"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <div 
        className={`h-screen bg-gray-200 text-white flex-col transition-all duration-300 hidden md:flex ${
          collapsed ? 'md:w-16' : 'md:w-64'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleMobileSidebar}
        ></div>
      )}

      {/* Mobile sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 text-white flex flex-col md:hidden transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
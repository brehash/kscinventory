import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Bell, Search, Truck, Package, Download } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import SearchModal from '../ui/SearchModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Header: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Use the hotkeys hook to detect keyboard shortcuts
  useHotkeys(['ctrl+k', 'meta+k'], (event) => {
    event.preventDefault();
    setSearchModalOpen(true);
  });

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event for later use
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Show the install button
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If the app is already installed, hide the install button
    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setInstallPrompt(null);
      console.log('PWA was installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', () => {});
    };
  }, []);

  // Handle install button click
  const handleInstallClick = async () => {
    if (!installPrompt) return;
    
    // Show the install prompt
    await installPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, so clear it
    setInstallPrompt(null);
    
    if (outcome === 'accepted') {
      setIsInstallable(false);
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
  };

  return (
    <header className="bg-white h-16 px-3 sm:px-6 flex items-center justify-between border-b border-gray-200">
      {/* Left section - remains empty on mobile to account for the sidebar toggle button */}
      <div className="w-8 md:hidden"></div>
      
      {/* Center section - search bar */}
      <div className="flex-1 max-w-xl mx-auto md:mx-0">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search or scan barcode... (⌘K)"
            className="block w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            onClick={() => setSearchModalOpen(true)}
            readOnly
          />
        </div>
      </div>

      {/* Right section - install app button and notifications */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {isInstallable && (
          <button 
            onClick={handleInstallClick}
            className="flex items-center text-xs px-2 py-1 sm:text-sm sm:px-3 sm:py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            aria-label="Install app"
          >
            <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}

        {/* <div className="relative">
          <button className="text-gray-500 hover:text-gray-700 focus:outline-none">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center text-white text-xs">
              3
            </span>
          </button>
        </div> */}

        {/* <div className="flex items-center">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium mr-2">
            {currentUser?.displayName?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-gray-700">
              {currentUser?.displayName || 'User'}
            </div>
            <div className="text-xs text-gray-500 capitalize">
              {currentUser?.role || 'Staff'}
            </div>
          </div>
        </div> */}
      </div>

      {/* Global Search Modal */}
      <SearchModal 
        isOpen={searchModalOpen} 
        onClose={() => setSearchModalOpen(false)} 
      />
    </header>
  );
};

export default Header;
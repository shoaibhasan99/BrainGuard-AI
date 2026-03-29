import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Menu, 
  X, 
  Home, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Calendar,
  MessageCircle,
  CreditCard
} from 'lucide-react';

interface DoctorSidebarProps {
  currentModule?: string | null;
  onNavigateHome: () => void;
  onNavigateToModule: (moduleId: string) => void;
  user?: any;
  onLogout?: () => void;
}

const DoctorSidebar: React.FC<DoctorSidebarProps> = ({ 
  currentModule, 
  onNavigateHome, 
  onNavigateToModule, 
  onLogout 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Doctor-specific modules
  const doctorModules = [
    { id: 'chat', name: 'Patient Chats', icon: MessageCircle, description: 'Chat with patients' },
    { id: 'appointments', name: 'Appointments', icon: Calendar, description: 'Manage appointments' },
    { id: 'payments', name: 'Payments', icon: CreditCard, description: 'Handle payments' }
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleModuleClick = (moduleId: string) => {
    onNavigateToModule(moduleId);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700 transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={toggleMobileSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{
          width: isCollapsed ? 80 : 280,
        }}
        className={`
          fixed left-0 top-0 h-full bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 
          border-r border-gray-700/50 z-50 transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : 'lg:translate-x-0 -translate-x-full lg:block'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-700/50">
            <div className="flex items-center justify-between">
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-white">BrainGuard</h1>
                      <p className="text-xs text-gray-400">Doctor Portal</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <button
                onClick={toggleSidebar}
                className="hidden lg:flex p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {/* Home Button */}
              <button
                onClick={onNavigateHome}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300
                  ${currentModule === null 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-400/30 text-cyan-400' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }
                `}
              >
                <Home className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="font-medium"
                    >
                      Dashboard
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* Doctor Modules */}
              <div className="space-y-1">
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2"
                    >
                      Medical Tools
                    </motion.div>
                  )}
                </AnimatePresence>

                {doctorModules.map((module) => {
                  const Icon = module.icon;
                  const isActive = currentModule === module.id;
                  
                  return (
                    <button
                      key={module.id}
                      onClick={() => handleModuleClick(module.id)}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group
                        ${isActive 
                          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-400/30 text-cyan-400' 
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex-1 text-left"
                          >
                            <div className="font-medium">{module.name}</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-300">
                              {module.description}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700/50">
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 p-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="font-medium"
                    >
                      Logout
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default DoctorSidebar;

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Menu, 
  X, 
  Home, 
  Brain, 
  AlertTriangle, 
  Activity, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageCircle,
  Calendar,
  CreditCard,
  Pill
} from 'lucide-react';

interface SidebarProps {
  currentModule?: string | null;
  onNavigateHome: () => void;
  onNavigateToModule: (moduleId: string) => void;
  user?: any;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentModule, 
  onNavigateHome, 
  onNavigateToModule, 
  onLogout 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const diseases = [
    { id: 'brain-tumor', name: 'Brain Tumor', icon: Brain },
    { id: 'alzheimer', name: "Alzheimer's", icon: AlertTriangle },
    { id: 'multiple-sclerosis', name: 'Multiple Sclerosis', icon: Activity },
    { id: 'report-generation', name: 'Report Generation', icon: FileText },
    { id: 'medication', name: 'Medication', icon: Pill },
    { id: 'chat', name: 'Chat with Doctors', icon: MessageCircle },
    { id: 'appointment', name: 'Book Appointment', icon: Calendar },
    { id: 'payment', name: 'Payment', icon: CreditCard }
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const SidebarContent = () => (
    <>
      {/* Enhanced Logo Section */}
      <div className="flex items-center justify-between mb-8">
        <motion.div 
          className="flex items-center gap-3"
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="relative"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <motion.div 
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400/20 to-blue-500/20 blur-sm"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div 
              className="absolute inset-0 rounded-xl border border-cyan-400/30"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <motion.h1 
                  className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent"
                  animate={{ backgroundPosition: ["0%", "100%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  BrainGuard AI
                </motion.h1>
                <p className="text-xs text-gray-300 font-medium">Advanced Medical AI</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        {/* Enhanced Collapse Button */}
        <motion.button
          onClick={toggleSidebar}
          className="p-2 text-gray-400 hover:text-cyan-400 transition-colors rounded-lg hover:bg-gray-700/50"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className="space-y-2 mb-8">
        {/* Dashboard */}
        <motion.button
          whileHover={{ scale: 1.02, x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNavigateHome}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden ${
            !currentModule 
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-400/30 shadow-lg' 
              : 'text-gray-300 hover:text-cyan-400 hover:bg-gradient-to-r hover:from-gray-700/50 hover:to-gray-600/50'
          }`}
        >
          {!currentModule && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          <Home className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="font-medium"
              >
                Dashboard
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
        
        {/* Disease Modules */}
        <div className="space-y-1">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="px-4 py-2"
              >
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  AI Detection Modules
                </h3>
              </motion.div>
            )}
          </AnimatePresence>
          
          {diseases.map((disease) => {
            const DiseaseIcon = disease.icon;
            return (
              <motion.button
                key={disease.id}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigateToModule(disease.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden ${
                  currentModule === disease.id
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-400/30 shadow-lg'
                    : 'text-gray-300 hover:text-cyan-400 hover:bg-gradient-to-r hover:from-gray-700/50 hover:to-gray-600/50'
                }`}
              >
                {currentModule === disease.id && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                <DiseaseIcon className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="font-medium"
                    >
                      {disease.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* Logout Button */}
      {onLogout && (
        <div className="mt-auto">
          <div className="border-t border-gray-700/50 pt-6">
            <motion.button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-gradient-to-r hover:from-red-500/20 hover:to-pink-500/20 rounded-xl transition-all duration-300 relative overflow-hidden"
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    Logout
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
    <motion.aside
      initial={{ width: 280 }}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="hidden lg:flex flex-col bg-gradient-to-b from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-r border-gray-600/30 h-screen fixed left-0 top-0 z-30 shadow-2xl"
    >
        <div className="p-6 flex-1 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          <SidebarContent />
        </div>
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={toggleMobileSidebar}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isMobileOpen ? 0 : -280 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="lg:hidden fixed left-0 top-0 z-50 w-[280px] h-screen bg-gradient-to-b from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-r border-gray-600/30 shadow-2xl"
      >
        <div className="p-6 h-full flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Shield className="w-8 h-8 text-cyan-400" />
                <motion.div 
                  className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  BrainGuard AI
                </h1>
                <p className="text-xs text-gray-400">Medical AI Platform</p>
              </div>
            </div>
            <button
              onClick={toggleMobileSidebar}
              className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-2 mb-8">
            <button
              onClick={() => {
                onNavigateHome();
                setIsMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                !currentModule 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30' 
                  : 'text-gray-300 hover:text-cyan-400 hover:bg-gray-700/50'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="font-medium">Dashboard</span>
            </button>
            
            <div className="space-y-1">
              <div className="px-4 py-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  AI Detection Modules
                </h3>
              </div>
              
              {diseases.map((disease) => {
                const DiseaseIcon = disease.icon;
                return (
                  <button
                    key={disease.id}
                    onClick={() => {
                      onNavigateToModule(disease.id);
                      setIsMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      currentModule === disease.id
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30'
                        : 'text-gray-300 hover:text-cyan-400 hover:bg-gray-700/50'
                    }`}
                  >
                    <DiseaseIcon className="w-5 h-5" />
                    <span className="font-medium">{disease.name}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {onLogout && (
            <div className="mt-auto">
              <div className="border-t border-gray-700/50 pt-6">
                <button 
                  onClick={() => {
                    onLogout();
                    setIsMobileOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded-xl transition-all duration-300"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Enhanced Mobile Menu Button */}
      <motion.button
        onClick={toggleMobileSidebar}
        className="lg:hidden fixed top-4 left-4 z-40 p-3 bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-gray-600/30 rounded-xl text-gray-400 hover:text-cyan-400 transition-colors shadow-lg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Menu className="w-6 h-6" />
      </motion.button>
    </>
  );
};

export default Sidebar;

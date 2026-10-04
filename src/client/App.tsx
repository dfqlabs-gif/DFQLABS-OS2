import React, { useState } from "react";
import { CommandPalette } from "./components/CommandPalette.js";
import { Header } from "./components/Header.js";
import { Sidebar } from "./components/Sidebar.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { ToastProvider } from "./context/ToastContext.js";
import { AddProspectPage } from "./pages/AddProspectPage.js";
import { AdminDashboardPage } from "./pages/AdminDashboardPage.js";
import { AdminIntelligencePage } from "./pages/AdminIntelligencePage.js";
import { AdminTeamPage } from "./pages/AdminTeamPage.js";
import { ConversationsPage } from "./pages/ConversationsPage.js";
import { FocusPage } from "./pages/FocusPage.js";
import { PerformancePage } from "./pages/PerformancePage.js";
import { ProspectsPage } from "./pages/ProspectsPage.js";
import { LoginPage } from "./pages/LoginPage.js";

function AppContent() {
  const { activeRole } = useAuth();
  const [currentPath, setCurrentPath] = useState(activeRole === "FOUNDER" ? "/admin/dashboard" : "/focus");
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  React.useEffect(() => {
    setCurrentPath(activeRole === "FOUNDER" ? "/admin/dashboard" : "/focus");
  }, [activeRole]);

  const renderView = () => {
    const founderOnly = ["/admin/dashboard", "/admin/team", "/admin/intelligence"];
    if (activeRole !== "FOUNDER" && founderOnly.includes(currentPath)) {
      return <FocusPage onNavigate={setCurrentPath} />;
    }
    switch (currentPath) {
      case "/focus":
        return <FocusPage onNavigate={setCurrentPath} />;
      case "/prospects":
        return <ProspectsPage onNavigate={setCurrentPath} />;
      case "/prospects/new":
        return <AddProspectPage onNavigate={setCurrentPath} />;
      case "/conversations":
        return <ConversationsPage />;
      case "/performance":
        return <PerformancePage />;
      case "/admin/dashboard":
        return <AdminDashboardPage />;
      case "/admin/team":
        return <AdminTeamPage />;
      case "/admin/intelligence":
        return <AdminIntelligencePage />;
      default:
        return <FocusPage onNavigate={setCurrentPath} />;
    }
  };

  const getPageTitle = () => {
    switch (currentPath) {
      case "/focus":
        return "Today's Focus Execution Engine";
      case "/prospects":
        return "My Prospects Directory";
      case "/prospects/new":
        return "Capture New Prospect Dossier";
      case "/conversations":
        return "Conversations & DM Execution";
      case "/performance":
        return "My Performance & Targets";
      case "/admin/dashboard":
        return "Founder Mission Control";
      case "/admin/team":
        return "Team & Seat Management";
      case "/admin/intelligence":
        return "Learning Intelligence & Prompts";
      default:
        return "DFQLABS OS 2.0";
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentPath={currentPath} onNavigate={setCurrentPath} />
      <div className="main-content">
        <Header title={getPageTitle()} onOpenCommand={() => setIsCommandOpen(true)} />
        <main className="page-body">{renderView()}</main>
      </div>

      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={setCurrentPath}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Complaints from "./pages/Complaints";
import NewComplaint from "./pages/NewComplaint";
import ComplaintDetail from "./pages/ComplaintDetail";
import NearbyComplaints from "./pages/NearbyComplaints";
import Projects from "./pages/Projects";
import Documents from "./pages/Documents";
import Users from "./pages/Users";
import Officers from "./pages/Officers";
import Departments from "./pages/Departments";
import Analytics from "./pages/Analytics";
import CityMap from "./pages/CityMap";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import ContractorDashboard from "./pages/contractor/ContractorDashboard";
import ContractorJobs from "./pages/contractor/ContractorJobs";
import ContractorMap from "./pages/contractor/ContractorMap";
import ContractorNotifications from "./pages/contractor/ContractorNotifications";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/contractor" element={<ContractorDashboard />} />
              <Route path="/contractor/dashboard" element={<ContractorDashboard />} />
              <Route path="/contractor/jobs" element={<ContractorJobs />} />
              <Route path="/contractor/map" element={<ContractorMap />} />
              <Route path="/contractor/notifications" element={<ContractorNotifications />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/track" element={<Complaints />} />
              <Route path="/complaints/new" element={<NewComplaint />} />
              <Route path="/complaints/:id" element={<ComplaintDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/users" element={<Users />} />
              <Route path="/officers" element={<Officers />} />
              <Route path="/department" element={<Dashboard />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/map" element={<CityMap />} />
              <Route path="/nearby" element={<NearbyComplaints />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useComplaints, useContractorStats, useUpdateContractor } from '@/hooks/useComplaints';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  HardHat,
  ClipboardList,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight,
  TrendingUp,
  Phone,
  ShieldCheck,
  Calendar,
  AlertTriangle
} from 'lucide-react';

export default function ContractorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: stats, isLoading: statsLoading } = useContractorStats();
  const { data: complaints = [], isLoading: complaintsLoading } = useComplaints();
  const updateContractor = useUpdateContractor();

  const [availability, setAvailability] = useState(user?.availability || 'available');
  const [updatingAvailability, setUpdatingAvailability] = useState(false);

  const handleAvailabilityChange = async (val) => {
    setAvailability(val);
    setUpdatingAvailability(true);
    try {
      await updateContractor.mutateAsync({ id: user.id, availability: val });
      toast({
        title: 'Availability updated',
        description: `Your status is now set to ${val}.`,
      });
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err.message || 'Could not update availability.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingAvailability(false);
    }
  };

  // Urgent jobs: assigned or in_progress with high or urgent priority, or upcoming deadlines
  const urgentJobs = complaints
    .filter(
      (c) =>
        c.status !== 'resolved' &&
        c.status !== 'closed' &&
        (c.priority === 'urgent' || c.priority === 'high' || c.contractor_status === 'assigned')
    )
    .slice(0, 5);

  const availabilityBadge = {
    available: { label: 'Available for Work', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    busy: { label: 'Busy (Working on Jobs)', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    unavailable: { label: 'Unavailable / Off-duty', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  }[availability] || { label: availability, color: 'bg-muted text-muted-foreground' };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/20 text-primary-foreground border-primary/40 px-3 py-1 flex items-center gap-1.5">
                <HardHat className="h-3.5 w-3.5" />
                Contractor Field Portal
              </Badge>
              <span className="text-xs text-slate-300">CitiCare Civic Execution</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome, {user?.name || 'Contractor'}
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              {user?.contractor_company ? `${user.contractor_company} • ` : ''}
              Track your assigned municipal repair works, submit ground estimates, and report job completions directly to department heads.
            </p>
          </div>

          {/* Quick Availability Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 shrink-0 min-w-[260px]">
            <div className="text-xs font-medium text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>My Availability</span>
              <span className={`inline-block w-2 h-2 rounded-full ${availability === 'available' ? 'bg-emerald-400' : availability === 'busy' ? 'bg-amber-400' : 'bg-rose-400'}`} />
            </div>
            <Select value={availability} onValueChange={handleAvailabilityChange} disabled={updatingAvailability}>
              <SelectTrigger className="w-full bg-slate-900/80 border-slate-700 text-white">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">🟢 Available for Work</SelectItem>
                <SelectItem value="busy">🟡 Busy (On Active Jobs)</SelectItem>
                <SelectItem value="unavailable">🔴 Unavailable / Off-duty</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400 mt-2">
              Department heads check your availability before assigning new works.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Assigned</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1">
                {statsLoading ? '...' : stats?.total_assigned ?? complaints.length}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">All assigned jobs</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Needs Acceptance</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1 text-amber-500">
                {statsLoading ? '...' : stats?.needs_acceptance ?? complaints.filter((c) => c.contractor_status === 'assigned').length}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Awaiting your accept</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">In Progress</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1 text-blue-500">
                {statsLoading ? '...' : stats?.in_progress ?? complaints.filter((c) => ['accepted', 'in_progress'].includes(c.contractor_status)).length}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Ground work active</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Under Verification</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1 text-purple-500">
                {statsLoading ? '...' : stats?.completed_verification ?? complaints.filter((c) => c.contractor_status === 'completed').length}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Submitted to Head</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Urgent Actions & Recent Jobs */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Action Required / Priority Jobs
                </CardTitle>
                <CardDescription>
                  Jobs requiring your immediate acceptance, progress updates, or deadline attention.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contractor/jobs" className="flex items-center gap-1">
                  View All Jobs <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {complaintsLoading ? (
                <div className="py-12 text-center text-muted-foreground">Loading assigned jobs...</div>
              ) : urgentJobs.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                  <p className="font-medium text-foreground">You are all caught up!</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    No urgent pending acceptances or high priority complaints right now.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {urgentJobs.map((job) => {
                    const isNewAssignment = job.contractor_status === 'assigned';
                    const hasMissingCoords = !job.latitude || !job.longitude;
                    return (
                      <div
                        key={job.id}
                        className="p-4 rounded-xl border border-border bg-card/60 hover:bg-accent/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm">#{job.complaint_number}</span>
                            <Badge
                              variant="outline"
                              className={
                                job.priority === 'urgent'
                                  ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                  : job.priority === 'high'
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                              }
                            >
                              {job.priority?.toUpperCase()}
                            </Badge>
                            {isNewAssignment && (
                              <Badge className="bg-amber-500 text-white text-[11px] font-semibold animate-pulse">
                                Needs Acceptance
                              </Badge>
                            )}
                            {hasMissingCoords && (
                              <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/20 text-[11px] flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Location unconfirmed
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium text-foreground truncate">{job.title}</h4>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {job.address && (
                              <span className="flex items-center gap-1 truncate max-w-[220px]">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {job.address}
                              </span>
                            )}
                            {job.contractor_deadline && (
                              <span className="flex items-center gap-1 text-amber-600 font-medium">
                                <Calendar className="h-3 w-3 shrink-0" />
                                Deadline: {new Date(job.contractor_deadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" asChild>
                            <Link to={`/contractor/jobs?jobId=${job.id}`}>
                              {isNewAssignment ? 'Accept & Execute' : 'Open Details'}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Profile & Quick Links */}
        <div className="space-y-6">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Contractor Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Contractor Name</span>
                <span className="font-medium">{user?.name}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Agency / Company</span>
                <span className="font-medium">{user?.contractor_company || 'Independent Contractor'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Department</span>
                <Badge variant="secondary">Assigned Dept</Badge>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Current Status</span>
                <Badge variant="outline" className={availabilityBadge.color}>
                  {availabilityBadge.label}
                </Badge>
              </div>
              <div className="pt-2">
                <Button variant="outline" className="w-full" size="sm" asChild>
                  <Link to="/profile">Edit Profile & Contact Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Nav Tools */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Field Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="secondary" className="w-full justify-start gap-2" asChild>
                <Link to="/contractor/map">
                  <MapPin className="h-4 w-4 text-primary" />
                  Interactive Work Map & Directions
                </Link>
              </Button>
              <Button variant="secondary" className="w-full justify-start gap-2" asChild>
                <Link to="/contractor/jobs">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  My Jobs & Work Execution
                </Link>
              </Button>
              <Button variant="secondary" className="w-full justify-start gap-2" asChild>
                <Link to="/contractor/notifications">
                  <Clock className="h-4 w-4 text-primary" />
                  Department Assignment Notifications
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

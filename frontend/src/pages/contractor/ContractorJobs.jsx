import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useComplaints, useUpdateComplaint, useUploadComplaintImages } from '@/hooks/useComplaints';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  HardHat,
  ClipboardList,
  MapPin,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  DollarSign,
  Camera,
  Users,
  Search,
  Check,
  Send,
  Loader2,
  FileText
} from 'lucide-react';

export default function ContractorJobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedJobIdFromQuery = searchParams.get('jobId');

  const { user } = useAuth();
  const { toast } = useToast();
  const { data: complaints = [], isLoading } = useComplaints();
  const updateComplaint = useUpdateComplaint();
  const uploadImages = useUploadComplaintImages();

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Execution Modal state
  const [selectedJob, setSelectedJob] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Execution Form Fields
  const [costAmount, setCostAmount] = useState('');
  const [costMaterials, setCostMaterials] = useState('');
  const [costLabor, setCostLabor] = useState('');
  const [laborCount, setLaborCount] = useState('');
  const [contractorRemarks, setContractorRemarks] = useState('');
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles, setAfterFiles] = useState([]);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Automatically open modal if requested via URL query ?jobId=...
  useMemo(() => {
    if (selectedJobIdFromQuery && complaints.length > 0 && !selectedJob) {
      const match = complaints.find((c) => c.id === selectedJobIdFromQuery);
      if (match) {
        openJobModal(match);
      }
    }
  }, [selectedJobIdFromQuery, complaints]);

  function openJobModal(job) {
    setSelectedJob(job);
    setCostAmount(job.cost_estimated_amount ? String(job.cost_estimated_amount) : '');
    setCostMaterials(job.cost_materials || '');
    setCostLabor(job.cost_labor || '');
    setLaborCount(job.labor_count ? String(job.labor_count) : '');
    setContractorRemarks(job.contractor_remarks || '');
    setCompletionRemarks(job.completion_remarks || '');
    setBeforeFiles([]);
    setAfterFiles([]);
    setDialogOpen(true);
  }

  function closeJobModal() {
    setDialogOpen(false);
    setSelectedJob(null);
    if (searchParams.get('jobId')) {
      searchParams.delete('jobId');
      setSearchParams(searchParams);
    }
  }

  const handleSelectFiles = (filesList, setter) => {
    const files = Array.from(filesList || []);
    const valid = [];
    const maxSize = 10 * 1024 * 1024;
    for (const f of files) {
      if (f.size > maxSize) {
        toast({
          title: 'Photo too large',
          description: `"${f.name}" exceeds the 10MB limit (${(f.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller photo.`,
          variant: 'destructive',
        });
        continue;
      }
      valid.push(f);
    }
    setter(valid);
  };

  // Filter complaints
  const filteredJobs = useMemo(() => {
    return complaints.filter((job) => {
      // Tab filter
      if (activeTab === 'assigned' && job.contractor_status !== 'assigned') return false;
      if (activeTab === 'in_progress' && !['accepted', 'in_progress'].includes(job.contractor_status)) return false;
      if (activeTab === 'completed' && job.contractor_status !== 'completed') return false;
      if (activeTab === 'verified' && job.contractor_status !== 'verified') return false;

      // Priority filter
      if (priorityFilter !== 'all' && job.priority !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = job.complaint_number?.toLowerCase().includes(q);
        const matchesTitle = job.title?.toLowerCase().includes(q);
        const matchesAddress = job.address?.toLowerCase().includes(q);
        if (!matchesNumber && !matchesTitle && !matchesAddress) return false;
      }

      return true;
    });
  }, [complaints, activeTab, priorityFilter, searchQuery]);

  // Action: Accept Assignment
  const handleAcceptJob = async () => {
    if (!selectedJob) return;
    setSubmittingAction(true);
    try {
      await updateComplaint.mutateAsync({
        id: selectedJob.id,
        contractor_status: 'accepted',
      });
      toast({
        title: 'Assignment Accepted',
        description: 'You have accepted this job. Ground work has been marked in progress.',
      });
      closeJobModal();
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err.message || 'Could not accept job.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Action: Submit Cost Estimate
  const handleSubmitEstimate = async () => {
    if (!selectedJob) return;
    const amount = Number(costAmount);
    if (!amount || amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid estimate amount in ₹.',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingAction(true);
    try {
      await updateComplaint.mutateAsync({
        id: selectedJob.id,
        cost_estimated_amount: amount,
        cost_materials: costMaterials || undefined,
        cost_labor: costLabor || undefined,
      });
      toast({
        title: 'Estimate Submitted',
        description: 'Cost estimate sent for Department Head review and Admin approval.',
      });
      closeJobModal();
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: err.message || 'Could not submit estimate.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Action: Save Progress & Labor
  const handleSaveProgress = async () => {
    if (!selectedJob) return;
    setSubmittingAction(true);
    try {
      await updateComplaint.mutateAsync({
        id: selectedJob.id,
        labor_count: laborCount ? Number(laborCount) : undefined,
        contractor_remarks: contractorRemarks || undefined,
      });

      if (beforeFiles.length > 0) {
        await uploadImages.mutateAsync({
          complaintId: selectedJob.id,
          images: beforeFiles,
          type: 'before',
        });
      }

      toast({
        title: 'Progress Saved',
        description: 'Ground progress details and before photos uploaded.',
      });
      closeJobModal();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err.message || 'Could not save progress.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Action: Submit Completed Work for Head Verification
  const handleSubmitCompletion = async () => {
    if (!selectedJob) return;
    if (!completionRemarks.trim()) {
      toast({
        title: 'Remarks required',
        description: 'Please provide completion remarks detailing the work performed.',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingAction(true);
    try {
      await updateComplaint.mutateAsync({
        id: selectedJob.id,
        contractor_status: 'completed',
        completion_remarks: completionRemarks.trim(),
        labor_count: laborCount ? Number(laborCount) : undefined,
      });

      if (afterFiles.length > 0) {
        await uploadImages.mutateAsync({
          complaintId: selectedJob.id,
          images: afterFiles,
          type: 'after',
        });
      }

      toast({
        title: 'Work Submitted for Verification',
        description: 'The Department Head has been notified to inspect and verify the completed work.',
      });
      closeJobModal();
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: err.message || 'Could not submit completion.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'assigned':
        return <Badge className="bg-amber-500 text-white font-medium">Needs Acceptance</Badge>;
      case 'accepted':
      case 'in_progress':
        return <Badge className="bg-blue-500 text-white font-medium">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-purple-600 text-white font-medium">Under Verification</Badge>;
      case 'verified':
        return <Badge className="bg-emerald-600 text-white font-medium">Verified & Solved</Badge>;
      default:
        return <Badge variant="secondary">Unassigned</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            My Field Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complaints assigned to your agency. Accept jobs, submit cost estimates, and report work completions.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search complaint # or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm font-medium"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent Priority</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full md:w-auto h-auto p-1 bg-muted/60">
          <TabsTrigger value="all" className="text-xs md:text-sm py-2">
            All Assigned ({complaints.length})
          </TabsTrigger>
          <TabsTrigger value="assigned" className="text-xs md:text-sm py-2">
            Needs Acceptance ({complaints.filter((c) => c.contractor_status === 'assigned').length})
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="text-xs md:text-sm py-2">
            In Progress ({complaints.filter((c) => ['accepted', 'in_progress'].includes(c.contractor_status)).length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs md:text-sm py-2">
            Under Verification ({complaints.filter((c) => c.contractor_status === 'completed').length})
          </TabsTrigger>
          <TabsTrigger value="verified" className="text-xs md:text-sm py-2">
            Verified ({complaints.filter((c) => c.contractor_status === 'verified').length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {isLoading ? (
            <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span>Loading assigned field jobs...</span>
            </div>
          ) : filteredJobs.length === 0 ? (
            <Card className="border-dashed p-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-foreground">No jobs matching this filter</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                No complaints currently match the selected tab and search criteria.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredJobs.map((job) => {
                const hasMissingCoords = !job.latitude || !job.longitude;
                const isNeedsAcceptance = job.contractor_status === 'assigned';
                const isCompletedAwaiting = job.contractor_status === 'completed';

                return (
                  <Card
                    key={job.id}
                    className={`shadow-card border flex flex-col justify-between transition-all hover:shadow-lg ${
                      isNeedsAcceptance ? 'border-amber-500/50 bg-amber-500/5' : 'border-border'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-primary">#{job.complaint_number}</span>
                        {getStatusBadge(job.contractor_status)}
                      </div>
                      <CardTitle className="text-base font-semibold line-clamp-2 mt-1">
                        {job.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-xs">
                        {job.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs flex-1">
                      {/* Department & Priority badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-xs">
                          {job.departments?.name || 'Department'}
                        </Badge>
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
                          {job.priority?.toUpperCase()} PRIORITY
                        </Badge>
                      </div>

                      {/* Head Work Instructions if present */}
                      {job.contractor_instructions && (
                        <div className="p-2.5 rounded-lg bg-accent/60 border border-accent text-accent-foreground text-xs space-y-1">
                          <span className="font-semibold block text-[11px] uppercase tracking-wider text-muted-foreground">
                            Head Instructions:
                          </span>
                          <p className="line-clamp-2 italic">"{job.contractor_instructions}"</p>
                        </div>
                      )}

                      {/* Deadline Countdown */}
                      {job.contractor_deadline && (
                        <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>Deadline: {new Date(job.contractor_deadline).toLocaleDateString()}</span>
                        </div>
                      )}

                      {/* Location & Address */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-start gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                          <span className="line-clamp-1">{job.address || 'Address unlisted'}</span>
                        </div>

                        {/* Unconfirmed Location Warning */}
                        {hasMissingCoords ? (
                          <div className="flex items-center gap-1.5 text-amber-600 font-medium bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 text-[11px]">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>Location needs confirmation (Missing GPS)</span>
                          </div>
                        ) : (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                          >
                            <ExternalLink className="h-3 w-3" /> Get Directions (Google Maps)
                          </a>
                        )}
                      </div>

                      {/* Cost status badge */}
                      {job.cost_status && job.cost_status !== 'pending' && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Estimate:</span>
                          <span className="font-semibold">₹{job.cost_estimated_amount ?? '--'}</span>
                          <Badge
                            variant="outline"
                            className={
                              job.cost_status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                                : job.cost_status === 'rejected'
                                ? 'bg-red-500/10 text-red-600 border-red-500/20 text-[10px]'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]'
                            }
                          >
                            {job.cost_status === 'approved'
                              ? 'Admin Approved'
                              : job.cost_status === 'rejected'
                              ? 'Rejected'
                              : 'Pending Approval'}
                          </Badge>
                        </div>
                      )}
                    </CardContent>

                    <div className="p-4 pt-0 border-t border-border/50 mt-3 flex items-center gap-2">
                      <Button
                        className="w-full"
                        size="sm"
                        variant={isNeedsAcceptance ? 'hero' : 'default'}
                        onClick={() => openJobModal(job)}
                      >
                        {isNeedsAcceptance ? 'Accept & Begin Work' : isCompletedAwaiting ? 'View Submission' : 'Execute & Update'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Tabs>

      {/* Execution Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary border-primary/30">
                    #{selectedJob.complaint_number}
                  </Badge>
                  {getStatusBadge(selectedJob.contractor_status)}
                </div>
                <DialogTitle className="text-xl font-bold mt-1">
                  {selectedJob.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedJob.address ? `Site Address: ${selectedJob.address}` : 'Field Execution Portal'}
                </DialogDescription>
              </DialogHeader>

              {/* Progress Stepper Indicator */}
              <div className="p-3 bg-muted/60 rounded-xl my-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${selectedJob.contractor_status !== 'assigned' ? 'bg-emerald-600 text-white' : 'bg-primary text-white'}`}>
                    1
                  </span>
                  <span>Accept</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${selectedJob.cost_status === 'submitted' || selectedJob.cost_status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    2
                  </span>
                  <span>Estimate</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${['accepted', 'in_progress', 'completed', 'verified'].includes(selectedJob.contractor_status) ? 'bg-emerald-600 text-white' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    3
                  </span>
                  <span>Execute</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${selectedJob.contractor_status === 'completed' || selectedJob.contractor_status === 'verified' ? 'bg-emerald-600 text-white' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    4
                  </span>
                  <span>Verify</span>
                </div>
              </div>

              {/* Head Instructions Callout */}
              {selectedJob.contractor_instructions && (
                <div className="p-3 bg-accent/40 border border-accent rounded-lg text-xs space-y-1">
                  <span className="font-bold text-accent-foreground flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Department Head Work Instructions:
                  </span>
                  <p className="text-muted-foreground">{selectedJob.contractor_instructions}</p>
                  {selectedJob.contractor_deadline && (
                    <p className="text-[11px] text-amber-600 font-semibold pt-1">
                      Required Deadline: {new Date(selectedJob.contractor_deadline).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* STAGE 1: ACCEPTANCE */}
              {selectedJob.contractor_status === 'assigned' && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
                    <Clock className="h-4 w-4" />
                    Step 1: Accept Assignment
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Please confirm that your agency accepts this municipal maintenance task and will execute within the allocated timeframe.
                  </p>
                  <Button
                    onClick={handleAcceptJob}
                    disabled={submittingAction}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {submittingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Accept Job & Begin Work
                  </Button>
                </div>
              )}

              {/* STAGE 2: ESTIMATES & BUDGET APPROVAL */}
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Budget & Cost Estimate
                  </h4>
                  {selectedJob.cost_status && (
                    <Badge variant="outline" className="text-xs">
                      Status: {selectedJob.cost_status.toUpperCase()}
                    </Badge>
                  )}
                </div>

                {selectedJob.cost_status === 'approved' ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
                    <span className="font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Budget Approved by Municipal Administrator
                    </span>
                    <p>Amount approved: ₹{selectedJob.cost_estimated_amount}</p>
                  </div>
                ) : (
                  <div className="space-y-3 bg-muted/30 p-3 rounded-xl border border-border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="costAmount" className="text-xs">Estimated Cost (₹) *</Label>
                        <Input
                          id="costAmount"
                          type="number"
                          placeholder="e.g. 15000"
                          value={costAmount}
                          onChange={(e) => setCostAmount(e.target.value)}
                          className="h-9 mt-1"
                          disabled={selectedJob.cost_status === 'approved'}
                        />
                      </div>
                      <div>
                        <Label htmlFor="costLabor" className="text-xs">Labor Details</Label>
                        <Input
                          id="costLabor"
                          placeholder="e.g. 4 technicians x 2 days"
                          value={costLabor}
                          onChange={(e) => setCostLabor(e.target.value)}
                          className="h-9 mt-1"
                          disabled={selectedJob.cost_status === 'approved'}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="costMaterials" className="text-xs">Materials Required</Label>
                      <Input
                        id="costMaterials"
                        placeholder="e.g. 2 asphalt bags, 1 pipe clamp"
                        value={costMaterials}
                        onChange={(e) => setCostMaterials(e.target.value)}
                        className="h-9 mt-1"
                        disabled={selectedJob.cost_status === 'approved'}
                      />
                    </div>
                    {selectedJob.cost_status !== 'approved' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleSubmitEstimate}
                        disabled={submittingAction || !costAmount}
                        className="w-full text-xs"
                      >
                        Submit Estimate for Head & Admin Approval
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* STAGE 3: WORK EXECUTION & GROUND MONITORING */}
              <div className="space-y-3 border-t border-border pt-4">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <HardHat className="h-4 w-4 text-primary" />
                  Ground Work & Field Monitoring
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="laborCount" className="text-xs">Workers Deployed on Site</Label>
                    <Input
                      id="laborCount"
                      type="number"
                      placeholder="e.g. 5"
                      value={laborCount}
                      onChange={(e) => setLaborCount(e.target.value)}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contractorRemarks" className="text-xs">Progress Remarks / Observations</Label>
                    <Input
                      id="contractorRemarks"
                      placeholder="e.g. excavation completed, filling base"
                      value={contractorRemarks}
                      onChange={(e) => setContractorRemarks(e.target.value)}
                      className="h-9 mt-1"
                    />
                  </div>
                </div>

                {/* Before Photos Upload */}
                <div>
                  <Label className="text-xs flex items-center gap-1.5 mb-1">
                    <Camera className="h-3.5 w-3.5 text-primary" />
                    Upload Before Work Photos
                  </Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/*"
                    onChange={(e) => handleSelectFiles(e.target.files, setBeforeFiles)}
                    className="h-9 text-xs"
                  />
                  {beforeFiles.length > 0 && (
                    <span className="text-[11px] text-muted-foreground mt-1 block">
                      {beforeFiles.length} before photo(s) selected
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveProgress}
                  disabled={submittingAction}
                  className="w-full text-xs"
                >
                  Save Progress & Labor Notes
                </Button>
              </div>

              {/* STAGE 4: COMPLETION SUBMISSION */}
              <div className="space-y-3 border-t border-border pt-4">
                <h4 className="font-semibold text-sm flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Work for Head Verification
                </h4>

                <div>
                  <Label htmlFor="completionRemarks" className="text-xs">Completion Remarks *</Label>
                  <Textarea
                    id="completionRemarks"
                    placeholder="Describe the completed repairs and physical restoration..."
                    value={completionRemarks}
                    onChange={(e) => setCompletionRemarks(e.target.value)}
                    rows={2}
                    className="text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs flex items-center gap-1.5 mb-1">
                    <Camera className="h-3.5 w-3.5 text-emerald-600" />
                    Upload After Completion Photos *
                  </Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/*"
                    onChange={(e) => handleSelectFiles(e.target.files, setAfterFiles)}
                    className="h-9 text-xs"
                  />
                  {afterFiles.length > 0 && (
                    <span className="text-[11px] text-muted-foreground mt-1 block">
                      {afterFiles.length} completion photo(s) selected
                    </span>
                  )}
                </div>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  onClick={handleSubmitCompletion}
                  disabled={submittingAction || selectedJob.contractor_status === 'verified'}
                >
                  {submittingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Submit Work to Department Head for Official Verification
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Once submitted, the Department Head inspects ground photos and verifies the completion before citizen feedback opens.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="ghost" onClick={closeJobModal} size="sm">
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

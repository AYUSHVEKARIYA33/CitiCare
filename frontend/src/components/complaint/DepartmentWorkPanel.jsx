import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useUpdateComplaint, useContractors } from '@/hooks/useComplaints';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Wrench,
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign,
  HardHat,
  Calendar,
  FileText,
  Clock,
  History,
  ShieldCheck,
  AlertTriangle,
  Send
} from 'lucide-react';

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'Processing' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'resolved', label: 'Solved' },
  { value: 'rejected', label: 'Rejected' },
];

export function DepartmentWorkPanel({ complaint }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const updateComplaint = useUpdateComplaint();

  const isAdmin = user?.role === 'admin';
  const isDeptHead = user?.role === 'department_head';

  // Fetch contractors for this department with active workloads
  const { data: contractors = [], isLoading: loadingContractors } = useContractors(complaint.department_id);

  const [status, setStatus] = useState(complaint.status);
  const [selectedContractorId, setSelectedContractorId] = useState(complaint.assigned_contractor_id || '');
  const [contractorDeadline, setContractorDeadline] = useState(
    complaint.contractor_deadline ? complaint.contractor_deadline.substring(0, 10) : ''
  );
  const [contractorInstructions, setContractorInstructions] = useState(complaint.contractor_instructions || '');
  const [correctionRemarks, setCorrectionRemarks] = useState('');

  // 1. Accept Complaint
  const handleAccept = async () => {
    try {
      await updateComplaint.mutateAsync({
        id: complaint.id,
        oldStatus: complaint.status,
        accepted_by_department: true,
        status: 'in_progress',
      });
      toast({
        title: 'Complaint accepted',
        description: 'Status set to Processing.',
      });
    } catch (e) {
      toast({
        title: 'Failed',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // 2. Reject Complaint
  const handleReject = async () => {
    try {
      await updateComplaint.mutateAsync({
        id: complaint.id,
        oldStatus: complaint.status,
        accepted_by_department: false,
        status: 'rejected',
      });
      toast({
        title: 'Complaint rejected',
        description: 'The complaint has been rejected.',
      });
    } catch (e) {
      toast({
        title: 'Failed',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // 3. Status Update
  const handleStatusUpdate = async () => {
    try {
      await updateComplaint.mutateAsync({
        id: complaint.id,
        oldStatus: complaint.status,
        status,
      });
      toast({
        title: 'Status updated',
        description: `Status set to ${statusOptions.find((o) => o.value === status)?.label ?? status}.`,
      });
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // 4. Assign / Reassign Contractor
  const handleAssignContractor = async () => {
    if (!selectedContractorId) {
      toast({
        title: 'Select a contractor',
        description: 'Please select a qualified contractor from the list.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateComplaint.mutateAsync({
        id: complaint.id,
        assigned_contractor_id: selectedContractorId,
        contractor_deadline: contractorDeadline || undefined,
        contractor_instructions: contractorInstructions || undefined,
      });
      toast({
        title: 'Contractor Assigned',
        description: 'Primary contractor assigned. Work notification sent to contractor portal.',
      });
    } catch (e) {
      toast({
        title: 'Assignment failed',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const [showManualEstimate, setShowManualEstimate] = useState(false);
  const [manualAmount, setManualAmount] = useState(complaint.cost_estimated_amount || '');
  const [manualMaterials, setManualMaterials] = useState(complaint.cost_materials || '');
  const [manualLabor, setManualLabor] = useState(complaint.cost_labor || '');

  // 5. Budget Approval / Review / Rejection
  const handleBudgetDecision = async (decision) => {
    try {
      await updateComplaint.mutateAsync({
        id: complaint.id,
        cost_status: decision,
      });
      toast({
        title: decision === 'approved' ? 'Cost Approved' : decision === 'reviewed' ? 'Estimate Reviewed' : 'Estimate Rejected',
        description: `Estimate has been marked as ${decision}.`,
      });
    } catch (e) {
      toast({
        title: 'Action failed',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAndApproveManualEstimate = async (targetStatus = 'approved') => {
    if (!manualAmount || Number(manualAmount) <= 0) {
      toast({
        title: 'Amount required',
        description: 'Please enter a valid estimated amount.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await updateComplaint.mutateAsync({
        id: complaint.id,
        cost_estimated_amount: Number(manualAmount),
        cost_materials: manualMaterials || undefined,
        cost_labor: manualLabor || undefined,
        cost_status: targetStatus,
      });
      toast({
        title: targetStatus === 'approved' ? 'Estimate Saved & Approved' : 'Estimate Submitted',
        description: `Estimate of ₹${manualAmount} saved.`,
      });
      setShowManualEstimate(false);
    } catch (e) {
      toast({
        title: 'Failed to save estimate',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // 6. Verify Completed Work
  const handleVerifyWork = async () => {
    try {
      await updateComplaint.mutateAsync({
        id: complaint.id,
        contractor_status: 'verified',
        status: 'resolved',
      });
      toast({
        title: 'Work Verified & Marked Solved',
        description: 'Contractor work verified successfully. Complaint marked as Solved.',
      });
    } catch (e) {
      toast({
        title: 'Verification failed',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // 7. Request Corrections / Rework
  const handleRequestCorrection = async () => {
    if (!correctionRemarks.trim()) {
      toast({
        title: 'Correction notes required',
        description: 'Please specify the issues or corrections needed.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateComplaint.mutateAsync({
        id: complaint.id,
        contractor_status: 'in_progress',
        contractor_remarks: `Correction requested by Head: ${correctionRemarks.trim()}`,
      });
      toast({
        title: 'Correction Requested',
        description: 'Feedback sent back to contractor for rework.',
      });
      setCorrectionRemarks('');
    } catch (e) {
      toast({
        title: 'Request failed',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const notYetAccepted = complaint.accepted_by_department === null || complaint.accepted_by_department === undefined;
  const canAcceptReject = complaint.status === 'pending' && notYetAccepted;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Department Work & Field Contractor Management
        </h2>
        {complaint.contractor_status && complaint.contractor_status !== 'unassigned' && (
          <Badge variant="outline" className="text-xs">
            Contractor: {complaint.contractor_status.toUpperCase()}
          </Badge>
        )}
      </div>

      {/* Accept / Reject */}
      {canAcceptReject && (
        <div className="flex flex-wrap gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" size="sm">
                <CheckCircle className="mr-2 h-4 w-4" />
                Accept Complaint
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Accept complaint</AlertDialogTitle>
                <AlertDialogDescription>Accept this complaint and set status to Processing?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleAccept} disabled={updateComplaint.isPending}>
                  {updateComplaint.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Accept
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject complaint</AlertDialogTitle>
                <AlertDialogDescription>Reject this complaint? Status will be set to Rejected.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground" disabled={updateComplaint.isPending}>
                  {updateComplaint.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reject
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Status Switcher */}
      {complaint.status !== 'rejected' && complaint.accepted_by_department && (
        <div className="space-y-2">
          <Label>Overall Complaint Status</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" disabled={status === complaint.status || updateComplaint.isPending} onClick={handleStatusUpdate}>
              {updateComplaint.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Status
            </Button>
          </div>
        </div>
      )}

      {/* SECTION: CONTRACTOR ASSIGNMENT & WORKLOAD */}
      {complaint.status !== 'rejected' && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
              <HardHat className="h-4 w-4 text-primary" />
              Primary Contractor Allocation
            </h3>
            {complaint.assigned_contractor && (
              <Badge variant="secondary" className="text-xs">
                Active Primary Contractor: {complaint.assigned_contractor.full_name}
              </Badge>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Select Department Contractor (with Active Workload) *</Label>
              {loadingContractors ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading department contractors...
                </div>
              ) : contractors.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">
                  No contractors registered in this department yet. (Admin can add contractors via Users/Contractors).
                </div>
              ) : (
                <Select value={selectedContractorId} onValueChange={setSelectedContractorId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Choose contractor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} {c.contractor_company ? `(${c.contractor_company})` : ''} •{' '}
                        {c.availability === 'available' ? '🟢 Available' : c.availability === 'busy' ? '🟡 Busy' : '🔴 Off-duty'} •{' '}
                        {c.active_jobs_count} active jobs
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contractorDeadline" className="text-xs">Target Completion Deadline</Label>
              <Input
                id="contractorDeadline"
                type="date"
                value={contractorDeadline}
                onChange={(e) => setContractorDeadline(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contractorInstructions" className="text-xs">Work Instructions & Ground Directives</Label>
            <Textarea
              id="contractorInstructions"
              placeholder="e.g. Inspect pipeline pressure, replace faulty valve, clear debris within 48h..."
              value={contractorInstructions}
              onChange={(e) => setContractorInstructions(e.target.value)}
              rows={2}
              className="bg-background text-xs"
            />
          </div>

          <Button
            size="sm"
            onClick={handleAssignContractor}
            disabled={updateComplaint.isPending || !selectedContractorId}
            className="flex items-center gap-1.5"
          >
            {updateComplaint.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <HardHat className="h-4 w-4 mr-1" />}
            {complaint.assigned_contractor_id ? 'Reassign Primary Contractor' : 'Assign Contractor & Dispatch Work'}
          </Button>

          {/* Assignment History Display */}
          {complaint.assignment_history?.length > 0 && (
            <div className="pt-2 border-t border-border/60">
              <span className="text-xs font-semibold flex items-center gap-1 text-muted-foreground mb-2">
                <History className="h-3.5 w-3.5" />
                Assignment & Reassignment History:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {complaint.assignment_history.map((hist, idx) => (
                  <div key={idx} className="p-2 rounded bg-background/80 text-[11px] border border-border/50 space-y-0.5">
                    <div className="flex items-center justify-between font-medium">
                      <span>{hist.contractor_name || 'Contractor'}</span>
                      <span className="text-muted-foreground">{new Date(hist.assigned_at).toLocaleString()}</span>
                    </div>
                    {hist.instructions && <p className="text-muted-foreground italic">"{hist.instructions}"</p>}
                    {hist.deadline && <span className="text-amber-600">Deadline: {new Date(hist.deadline).toLocaleDateString()}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION: ESTIMATE REVIEW & BUDGET APPROVAL */}
      {complaint.cost_status && complaint.cost_status !== 'pending' ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Contractor Cost Estimate & Budget Status
            </h3>
            <Badge
              variant="outline"
              className={
                complaint.cost_status === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : complaint.cost_status === 'rejected'
                  ? 'bg-red-500/10 text-red-600 border-red-500/20'
                  : complaint.cost_status === 'reviewed'
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              }
            >
              {complaint.cost_status === 'reviewed' ? 'REVIEWED BY HEAD' : complaint.cost_status.toUpperCase()}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-muted/30 p-3 rounded-lg">
            <div>
              <span className="text-muted-foreground block text-[11px]">Estimated Amount</span>
              <span className="font-bold text-sm">₹{complaint.cost_estimated_amount ?? '--'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Materials Description</span>
              <span className="font-medium">{complaint.cost_materials || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Labor Allocation</span>
              <span className="font-medium">{complaint.cost_labor || 'Not specified'}</span>
            </div>
          </div>

          {/* Budget Decision Actions for Admin and Department Head */}
          {(isAdmin || isDeptHead) && (complaint.cost_status === 'submitted' || complaint.cost_status === 'reviewed') && (
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                onClick={() => handleBudgetDecision('approved')}
                disabled={updateComplaint.isPending}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                {isAdmin ? 'Approve Budget (Admin)' : 'Approve Cost Estimate (Head)'}
              </Button>
              {isDeptHead && complaint.cost_status === 'submitted' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-blue-600 border-blue-500/40 hover:bg-blue-50"
                  onClick={() => handleBudgetDecision('reviewed')}
                  disabled={updateComplaint.isPending}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Review & Recommend to Admin
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                className="text-xs"
                onClick={() => handleBudgetDecision('rejected')}
                disabled={updateComplaint.isPending}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Reject Estimate
              </Button>
            </div>
          )}

          {complaint.cost_status === 'approved' && (
            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 pt-1">
              <CheckCircle className="h-4 w-4" />
              Budget approved and allocated for field execution.
            </div>
          )}
        </div>
      ) : (
        /* When estimate is pending, allow Head / Admin to directly set and approve */
        (isAdmin || isDeptHead) && (
          <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Cost Estimate & Budget
                </h4>
                <p className="text-xs text-muted-foreground">
                  Awaiting contractor estimate submission, or set/approve directly as Department Head/Admin.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setShowManualEstimate(!showManualEstimate)}
              >
                {showManualEstimate ? 'Cancel' : '+ Set / Approve Estimate'}
              </Button>
            </div>

            {showManualEstimate && (
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Amount (₹) *</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 15000"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className="text-xs h-8 bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Materials</Label>
                    <Input
                      placeholder="e.g. Cement, pipes"
                      value={manualMaterials}
                      onChange={(e) => setManualMaterials(e.target.value)}
                      className="text-xs h-8 bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Labor</Label>
                    <Input
                      placeholder="e.g. 4 workers, 2 days"
                      value={manualLabor}
                      onChange={(e) => setManualLabor(e.target.value)}
                      className="text-xs h-8 bg-background"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    onClick={() => handleSaveAndApproveManualEstimate('approved')}
                    disabled={updateComplaint.isPending || !manualAmount}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Save & Approve Cost
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => handleSaveAndApproveManualEstimate('submitted')}
                    disabled={updateComplaint.isPending || !manualAmount}
                  >
                    Save as Estimate Only
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* SECTION: WORK VERIFICATION & QUALITY AUDIT */}
      {complaint.contractor_status === 'completed' && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <ShieldCheck className="h-5 w-5" />
              Contractor Work Completion Verification
            </h3>
            <Badge className="bg-purple-600 text-white text-xs">Awaiting Head Verification</Badge>
          </div>

          <div className="p-3 bg-background rounded-lg border border-border text-xs space-y-2">
            <div>
              <span className="font-semibold text-muted-foreground block text-[11px] uppercase">
                Contractor Completion Remarks:
              </span>
              <p className="text-foreground font-medium mt-0.5">
                {complaint.completion_remarks || 'Work completed per instructions.'}
              </p>
            </div>
            {complaint.labor_count && (
              <div className="text-[11px] text-muted-foreground">
                Labor deployed on site: <strong>{complaint.labor_count} workers</strong>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Review Action (Department Head / Administrator)</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                onClick={handleVerifyWork}
                disabled={updateComplaint.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Verify & Mark Solved
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 space-y-2">
            <Label htmlFor="correctionRemarks" className="text-xs text-muted-foreground">
              Request Corrections / Incomplete Work:
            </Label>
            <div className="flex gap-2">
              <Input
                id="correctionRemarks"
                placeholder="Specify what needs correction or rework..."
                value={correctionRemarks}
                onChange={(e) => setCorrectionRemarks(e.target.value)}
                className="text-xs h-9 bg-background"
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-xs text-amber-600 border-amber-500/40"
                onClick={handleRequestCorrection}
                disabled={updateComplaint.isPending || !correctionRemarks.trim()}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Request Rework
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

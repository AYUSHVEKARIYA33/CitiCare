import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, resolveAssetUrl } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

function normalizeComplaintImages(complaint) {
  if (!complaint.complaint_images?.length) return complaint;
  return {
    ...complaint,
    complaint_images: complaint.complaint_images
      .filter((img) => !img.complaint_id || img.complaint_id === complaint.id)
      .map((img) => ({
        ...img,
        url: resolveAssetUrl(img.url),
      })),
  };
}

export function useComplaints(sortBy) {
  const { user, session } = useAuth();

  return useQuery({
    queryKey: ['complaints', user?.id, sortBy],
    queryFn: async () => {
      const params = sortBy ? { sort: sortBy } : {};
      const { data } = await api.get('/complaints', { params });
      return data.map(normalizeComplaintImages);
    },
    enabled: !!session,
  });
}

export function useComplaint(id) {
  return useQuery({
    queryKey: ['complaint', id],
    queryFn: async () => {
      const { data } = await api.get(`/complaints/${id}`);
      return data ? normalizeComplaintImages(data) : null;
    },
    enabled: !!id,
  });
}

export function useCreateComplaint() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (data) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('category', data.category);
      formData.append('address', data.address || '');
      if (data.zone_id) formData.append('zone_id', data.zone_id);
      if (data.ward_id) formData.append('ward_id', data.ward_id);
      if (data.area_id) formData.append('area_id', data.area_id);
      if (data.department_id) formData.append('department_id', data.department_id);
      if (data.latitude !== undefined && data.latitude !== null) {
        formData.append('latitude', String(data.latitude));
      }
      if (data.longitude !== undefined && data.longitude !== null) {
        formData.append('longitude', String(data.longitude));
      }
      if (data.images?.length) {
        data.images.forEach((f) => formData.append('images', f));
      }

      const { data: complaint } = await api.post('/complaints', formData, {
        timeout: 60000,
      });
      return normalizeComplaintImages(complaint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
  });
}

export function useToggleUpvote() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (complaintId) => {
      const { data } = await api.post(`/complaints/${complaintId}/upvote`);
      return data;
    },
    onMutate: async (complaintId) => {
      await qc.cancelQueries({ queryKey: ['complaints'] });
      await qc.cancelQueries({ queryKey: ['complaint', complaintId] });
      await qc.cancelQueries({ queryKey: ['nearby-ward'] });
      await qc.cancelQueries({ queryKey: ['by-ward'] });
      await qc.cancelQueries({ queryKey: ['nearby-by-ward'] });
      const previousList = qc.getQueryData(['complaints']);
      const previousItem = qc.getQueryData(['complaint', complaintId]);
      const previousNearby = qc.getQueriesData({ queryKey: ['nearby-ward'] });
      const previousByWard = qc.getQueriesData({ queryKey: ['by-ward'] });
      const previousNearbyByWard = qc.getQueriesData({ queryKey: ['nearby-by-ward'] });

      // optimistic updates
      qc.setQueryData(['complaint', complaintId], (old) => {
        const wasUpvoted = !!old?.upvoted_by_user;
        const upvotes = (old?.upvotes ?? 0) + (wasUpvoted ? -1 : 1);
        return { ...(old || {}), upvotes, upvoted_by_user: !wasUpvoted };
      });
      qc.setQueryData(['complaints'], (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === complaintId ? { ...c, upvotes: (c.upvotes ?? 0) + (c.upvoted_by_user ? -1 : 1), upvoted_by_user: !c.upvoted_by_user } : c));
      });
      
      // update all nearby-ward queries (for nearby page)
      qc.getQueriesData({ queryKey: ['nearby-ward'] }).forEach(([queryKey, oldData]) => {
        if (Array.isArray(oldData)) {
          qc.setQueryData(queryKey, oldData.map((c) => 
            c.id === complaintId 
              ? { ...c, upvotes: (c.upvotes ?? 0) + (c.upvoted_by_user ? -1 : 1), upvoted_by_user: !c.upvoted_by_user } 
              : c
          ));
        }
      });

      // update all by-ward queries (for manually selected ward)
      qc.getQueriesData({ queryKey: ['by-ward'] }).forEach(([queryKey, oldData]) => {
        if (Array.isArray(oldData)) {
          qc.setQueryData(queryKey, oldData.map((c) => 
            c.id === complaintId 
              ? { ...c, upvotes: (c.upvotes ?? 0) + (c.upvoted_by_user ? -1 : 1), upvoted_by_user: !c.upvoted_by_user } 
              : c
          ));
        }
      });

      // update nearby-by-ward queries (new nearby page key)
      qc.getQueriesData({ queryKey: ['nearby-by-ward'] }).forEach(([queryKey, oldData]) => {
        if (Array.isArray(oldData)) {
          qc.setQueryData(queryKey, oldData.map((c) =>
            c.id === complaintId
              ? { ...c, upvotes: (c.upvotes ?? 0) + (c.upvoted_by_user ? -1 : 1), upvoted_by_user: !c.upvoted_by_user }
              : c
          ));
        }
      });

      return { previousList, previousItem, previousNearby, previousByWard, previousNearbyByWard };
    },
    onError: (err, complaintId, context) => {
      // rollback
      if (context?.previousList) qc.setQueryData(['complaints'], context.previousList);
      if (context?.previousItem) qc.setQueryData(['complaint', complaintId], context.previousItem);
      if (context?.previousNearby) {
        context.previousNearby.forEach(([queryKey, data]) => {
          qc.setQueryData(queryKey, data);
        });
      }
      if (context?.previousByWard) {
        context.previousByWard.forEach(([queryKey, data]) => {
          qc.setQueryData(queryKey, data);
        });
      }
      if (context?.previousNearbyByWard) {
        context.previousNearbyByWard.forEach(([queryKey, data]) => {
          qc.setQueryData(queryKey, data);
        });
      }
      toast({ title: 'Upvote failed', description: err?.response?.data?.error || err?.message || 'Please try again' });
    },
    onSettled: (_data, _err, complaintId) => {
      qc.invalidateQueries({ queryKey: ['complaints'] });
      qc.invalidateQueries({ queryKey: ['complaint', complaintId] });
      qc.invalidateQueries({ queryKey: ['nearby-ward'] });
      qc.invalidateQueries({ queryKey: ['by-ward'] });
      qc.invalidateQueries({ queryKey: ['nearby-by-ward'] });
    },
  });
}

export function useComplaintStats() {
  const { user, session } = useAuth();

  return useQuery({
    queryKey: ['complaint-stats', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/complaints/stats');
      return data;
    },
    enabled: !!session,
  });
}

export function useMonthlyComplaintStats() {
  const { user, session } = useAuth();

  return useQuery({
    queryKey: ['monthly-complaint-stats', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/complaints/monthly');
      return data;
    },
    enabled: !!session,
  });
}

export function useComplaintComments(complaintId) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['complaint-comments', complaintId],
    queryFn: async () => {
      const { data } = await api.get(`/complaints/${complaintId}/comments`);
      return data;
    },
    enabled: !!complaintId && !!session,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ complaintId, content }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const { data } = await api.post(`/complaints/${complaintId}/comments`, { content });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaint-comments', variables.complaintId] });
    },
  });
}

export function useSubmitComplaintFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ complaintId, rating, comment }) => {
      const { data } = await api.post(`/complaints/${complaintId}/feedback`, { rating, comment });
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaint', variables.complaintId] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
    },
  });
}

export function useUpdateComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, oldStatus, ...data }) => {
      const { data: result } = await api.patch(`/complaints/${id}`, data);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint', data.id] });
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
    },
  });
}

export function useDeleteComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/complaints/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
    },
  });
}

export function useUploadComplaintImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ complaintId, images, type }) => {
      const formData = new FormData();
      images.forEach((f) => formData.append('images', f));
      formData.append('type', type);
      const { data } = await api.post(`/complaints/${complaintId}/images`, formData);
      return normalizeComplaintImages(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint', data.id] });
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get('/complaints/meta/departments');
      return data;
    },
  });
}

export function useOfficers(departmentId) {
  return useQuery({
    queryKey: ['officers', departmentId],
    queryFn: async () => {
      const params = departmentId ? { departmentId } : {};
      const { data } = await api.get('/complaints/meta/officers', { params });
      return data;
    },
  });
}

export function useContractors(departmentId) {
  return useQuery({
    queryKey: ['contractors', departmentId],
    queryFn: async () => {
      const params = departmentId ? { departmentId } : {};
      const { data } = await api.get('/contractors', { params });
      return data;
    },
  });
}

export function useContractorStats() {
  return useQuery({
    queryKey: ['contractor-stats'],
    queryFn: async () => {
      const { data } = await api.get('/contractors/stats');
      return data;
    },
  });
}

export function useUpdateContractor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.patch(`/contractors/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      queryClient.invalidateQueries({ queryKey: ['contractor-stats'] });
    },
  });
}

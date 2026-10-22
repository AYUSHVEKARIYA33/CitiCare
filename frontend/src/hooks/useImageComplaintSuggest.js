import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useImageComplaintSuggest() {
  return useMutation({
    mutationFn: async (input) => {
      const formData = new FormData();
      formData.append('image', input.image);
      if (input.title) formData.append('title', input.title);
      if (input.description) formData.append('description', input.description);
      if (input.address) formData.append('address', input.address);

      const { data } = await api.post('/ai/image-suggest', formData, {
        timeout: 15000,
      });
      return data;
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import type { ProjectCategory } from '@portfolio-matis/content';
import { api } from '../api/client.ts';
import { PROJECT_CATEGORIES_QUERY } from '../app/queries.ts';

export const useProjectCategories = () =>
  useQuery({ queryKey: PROJECT_CATEGORIES_QUERY, queryFn: () => api.get<ProjectCategory[]>('/admin/project-categories') });

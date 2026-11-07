import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Project } from '@portfolio-matis/content';
import { api } from '../api/client.ts';
import { PROJECTS_QUERY } from '../app/queries.ts';
import { EntityList } from '../components/EntityList.tsx';
import { useProjectCategories } from '../hooks/useProjectCategories.ts';
import { ProjectCategoriesDialog } from './ProjectCategoriesDialog.tsx';

/** Le filtre des projets dont la catégorie n'existe pas : le tiret bas n'est jamais dans un identifiant. */
const NO_CATEGORY = '_aucune';
const PARAM = 'categorie';

export const ProjectsPage = () => {
  const [params, setParams] = useSearchParams();
  const [managing, setManaging] = useState(false);
  const categoriesQuery = useProjectCategories();
  const projectsQuery = useQuery({ queryKey: PROJECTS_QUERY, queryFn: () => api.get<Project[]>('/admin/projects') });
  const categories = categoriesQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  // Les nombres ne s'affichent qu'une fois connus : pas de « (0) » pendant le chargement.
  const loaded = categoriesQuery.data !== undefined && projectsQuery.data !== undefined;

  const known = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const project of projects) result.set(project.categoryId, (result.get(project.categoryId) ?? 0) + 1);
    return result;
  }, [projects]);
  const orphans = projects.filter((project) => !known.has(project.categoryId)).length;

  // Un filtre sur une catégorie disparue revient à tout afficher.
  const requested = params.get(PARAM);
  const active = requested !== null && (known.has(requested) || (requested === NO_CATEGORY && orphans > 0)) ? requested : null;
  const select = (id: string | null) => setParams(id ? { [PARAM]: id } : {}, { replace: true });

  const categoryTitle = (id: string) => categories.find((category) => category.id === id)?.title ?? 'Sans catégorie';
  const chip = (id: string | null, label: string, count: number) => (
    <button key={id ?? 'toutes'} type="button" className="btn small chip" aria-pressed={active === id} onClick={() => select(id)}>
      {label} ({count})
    </button>
  );

  return (
    <div className="form-col">
      <EntityList<Project>
        title="Projets"
        path="projects"
        basePath="/projets"
        primary={(row) => row.title}
        meta={(row) => `${categoryTitle(row.categoryId)} · ${row.summary}`}
        flag={(row) => (row.hidden ? 'Masqué' : null)}
        {...(active ? { filter: (row: Project) => (active === NO_CATEGORY ? !known.has(row.categoryId) : row.categoryId === active) } : {})}
        filteredEmptyText="Aucun projet dans cette catégorie."
        {...(active && active !== NO_CATEGORY ? { addTo: `/projets/nouveau?${PARAM}=${encodeURIComponent(active)}` } : {})}
        toolbar={<button type="button" className="btn" onClick={() => setManaging(true)}>Gérer les catégories</button>}
        filters={
          loaded && (
          <div className="chips" role="group" aria-label="Filtrer par catégorie">
            {chip(null, 'Toutes', projects.length)}
            {categories.map((category) => chip(category.id, category.title, counts.get(category.id) ?? 0))}
            {orphans > 0 && chip(NO_CATEGORY, 'Sans catégorie', orphans)}
          </div>
          )
        }
      />
      {managing && <ProjectCategoriesDialog counts={counts} onClose={() => setManaging(false)} />}
    </div>
  );
};

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { DraftState, Project } from '@portfolio-matis/content';
import { api, mediaUrl } from '../api/client.ts';
import { DRAFT_QUERY } from '../app/queries.ts';
import { QueryState } from '../components/QueryState.tsx';

const Text = ({ label, value }: { label: string; value: string | null | undefined }) =>
  value ? (
    <div>
      <strong>{label}</strong>
      <p>{value}</p>
    </div>
  ) : null;

const Bullets = ({ label, items }: { label?: string; items: string[] }) =>
  items.length > 0 ? (
    <div>
      {label && <strong>{label}</strong>}
      <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </div>
  ) : null;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h2>{title}</h2>
    {children}
  </section>
);

const period = (start: string, end: string | null): string => `${start} à ${end ?? 'aujourd’hui'}`;

const ProjectCard = ({ project }: { project: Project }) => (
  <article>
    <h3>
      {project.title} {project.hidden && <span className="flag">Masqué</span>}
    </h3>
    <p>{project.summary}</p>
    <Text label="Le contexte" value={project.context} />
    <Text label="Ce que j’ai fait" value={project.work} />
    <Text label="Le résultat" value={project.result} />
    <Bullets label="Technos" items={project.techs} />
    <Bullets label="Liens" items={project.links.map((link) => `${link.label} : ${link.href}`)} />
    {project.captures.map((capture) => (
      <img key={capture.file} src={mediaUrl(capture.file)} alt={capture.alt} />
    ))}
  </article>
);

const Preview = ({ draft }: { draft: DraftState }) => {
  const { profile, contact } = draft;
  return (
    <div className="preview">
      <p className="notice">Une relecture de ce que vous avez rédigé : elle ne reproduit pas l’apparence des sites.</p>

      {profile ? (
        <Section title="Présentation">
          <h3>{profile.name}</h3>
          <p>{profile.role} · {profile.city}</p>
          <Text label="À propos" value={profile.about} />
          <p>
            <strong>Recherche : </strong>
            {profile.search.contractType}, {profile.search.duration}, dès {profile.search.start}, {profile.search.location}
          </p>
          <Bullets label="Objectifs" items={profile.goals} />
          <Bullets label="Motivations" items={profile.motivations} />
          <Bullets label="Frustrations" items={profile.frustrations} />
          <Bullets label="Façons de travailler" items={profile.workStyle.map((item) => `${item.quality} : ${item.proof}`)} />
          <Bullets label="Savoir-être" items={profile.softSkills} />
          <Bullets label="Loisirs" items={profile.hobbies.map((hobby) => hobby.label)} />
        </Section>
      ) : (
        <p className="notice">La présentation n’est pas encore remplie.</p>
      )}

      {draft.experiences.length > 0 && (
        <Section title="Expériences">
          {draft.experiences.map((experience) => (
            <article key={experience.id}>
              <h3>{experience.title} · {experience.company}</h3>
              <p>{period(experience.start, experience.end)}</p>
              {experience.summary && <p>{experience.summary}</p>}
              <Bullets items={experience.missions} />
              <Bullets label="Technos" items={experience.techs} />
            </article>
          ))}
        </Section>
      )}

      {draft.educations.length > 0 && (
        <Section title="Formations">
          {draft.educations.map((education) => (
            <article key={education.id}>
              <h3>{education.degree} · {education.school}</h3>
              <p>{period(education.start, education.end)}</p>
              <Bullets items={education.details} />
            </article>
          ))}
        </Section>
      )}

      {draft.projects.length > 0 && (
        <Section title="Projets">
          {draft.projectCategories.map((category) => {
            const projects = draft.projects.filter((project) => project.categoryId === category.id);
            if (projects.length === 0) return null;
            return (
              <div key={category.id}>
                <h3>{category.title}</h3>
                {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
              </div>
            );
          })}
        </Section>
      )}

      {draft.skillCategories.length > 0 && (
        <Section title="Compétences">
          {draft.skillCategories.map((category) => (
            <article key={category.id}>
              <h3>{category.title}</h3>
              {category.skills.length > 0 && <p>{category.skills.join(', ')}</p>}
            </article>
          ))}
        </Section>
      )}

      {contact && (
        <Section title="Contact">
          <p>{contact.email}</p>
          <p>{contact.phone}</p>
          <Bullets items={contact.links.map((link) => `${link.label} : ${link.href}`)} />
        </Section>
      )}
    </div>
  );
};

export const PreviewPage = () => {
  const query = useQuery({ queryKey: DRAFT_QUERY, queryFn: () => api.get<DraftState>('/admin/draft') });
  return <QueryState query={query}>{(draft) => <Preview draft={draft} />}</QueryState>;
};

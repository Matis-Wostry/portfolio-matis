import type { Education, Experience, Project, ProjectCategory, PublicSnapshot } from '@portfolio-matis/content';

/** Les sections du site remplies par le contenu, dans l'ordre où elles apparaissent dans index.html. */
export const SECTIONS = [
  'meta-description',
  'hero',
  'about',
  'goals',
  'experiences',
  'projects',
  'skills',
  'soft-skills',
  'education',
  'availability',
  'interests',
  'contact-links',
] as const;

export type SectionId = (typeof SECTIONS)[number];
export type Sections = Record<SectionId, string>;

/** Les émojis des loisirs relèvent de la présentation : ils restent dans le site, rattachés par identifiant. */
const HOBBY_EMOJIS: Record<string, string> = { basket: '🏀', 'jeux-video': '🎮', mangas: '🎬', echecs: '♟️' };

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Échappe un texte pour le HTML, dans le contenu comme dans un attribut. */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
const esc = escapeHtml;

type Lines = string[];
const INDENT = '    ';
const nest = (lines: Lines): Lines => lines.map((line) => (line ? `${INDENT}${line}` : line));
const block = (open: string, inner: Lines, close: string): Lines => [open, ...nest(inner), close];
const list = (className: string | null, items: string[], itemClass: string | null = null): Lines =>
  block(className ? `<ul class="${className}">` : '<ul>', items.map((item) => `${itemClass ? `<li class="${itemClass}">` : '<li>'}${esc(item)}</li>`), '</ul>');
const badges = (items: string[]): Lines => (items.length > 0 ? block('<div class="tech-badges">', list(null, items, 'badge'), '</div>') : []);
const paragraphs = (text: string, className: string | null = null): Lines =>
  text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${className ? `<p class="${className}">` : '<p>'}${esc(part).replace(/\n/g, '<br>')}</p>`);
const externalLink = (href: string, label: string): string => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
const join = (lines: Lines): string => lines.join('\n');

const lowerFirst = (text: string): string => text.charAt(0).toLocaleLowerCase('fr') + text.slice(1);

const formatDate = (period: string): string => {
  const [year, month] = period.split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : (year as string);
};

/** « 2024 », « août 2024 - septembre 2025 », « 2024 - Aujourd’hui ». */
export const formatPeriod = (start: string, end: string | null): string => {
  if (end === null) return `${formatDate(start)} - Aujourd’hui`;
  if (end === start) return formatDate(start);
  return `${formatDate(start)} - ${formatDate(end)}`;
};

type Content = PublicSnapshot['content'];
type Search = Content['profile']['search'];

/** « En recherche d’alternance à Genève » : élision devant une voyelle. */
const searchSentence = ({ contractType, location }: Search): string => {
  const contract = lowerFirst(contractType);
  const article = /^[aeiouyhàâéèêëîïôûù]/i.test(contract) ? 'd’' : 'de ';
  return `En recherche ${article}${contract} à ${location}`;
};
const searchDetails = ({ duration, start }: Search): string => `(${duration}, dès ${lowerFirst(start)})`;

const renderHero = ({ profile }: Content): Lines => {
  const parts = profile.name.trim().split(/\s+/);
  const last = parts.pop() ?? '';
  const title = parts.length > 0 ? `${esc(last.toLocaleUpperCase('fr'))} <span class="accent">${esc(parts.join(' '))}</span>` : esc(last.toLocaleUpperCase('fr'));
  return [
    `<h1>${title}</h1>`,
    `<p class="subtitle">${esc(profile.role)}</p>`,
    `<p class="baseline">${esc(searchSentence(profile.search))}<br>${esc(searchDetails(profile.search))}</p>`,
  ];
};

const renderGoals = ({ profile }: Content): Lines => {
  const cards = [
    ['Objectifs', profile.goals],
    ['Motivations', profile.motivations],
    ['Frustrations', profile.frustrations],
  ] as const;
  const filled = cards.filter(([, items]) => items.length > 0);
  if (filled.length === 0) return [];
  return block(
    '<section id="goals">',
    [
      '<h2>Objectifs & motivations</h2>',
      ...block(
        '<div class="skills-grid goals-grid">',
        filled.flatMap(([title, items]) => block('<div class="skill-category">', [`<h3>${title}</h3>`, ...list('skill-list', [...items])], '</div>')),
        '</div>',
      ),
    ],
    '</section>',
  );
};

const renderExperience = (experience: Experience): Lines => {
  const description = [
    ...(experience.summary ? paragraphs(experience.summary) : []),
    ...(experience.missions.length > 0 ? list(null, experience.missions) : []),
  ];
  return block(
    '<div class="timeline-item">',
    [
      ...block(
        '<div class="timeline-header">',
        [
          ...block('<div>', [`<p class="timeline-title">${esc(experience.title)}</p>`, `<p class="timeline-company">${esc(experience.company)}</p>`], '</div>'),
          `<p class="timeline-date">${esc(formatPeriod(experience.start, experience.end))}</p>`,
        ],
        '</div>',
      ),
      ...(description.length > 0 ? block('<div class="timeline-description">', description, '</div>') : []),
      ...badges(experience.techs),
    ],
    '</div>',
  );
};

const DETAILS = [
  ['context', 'Le contexte'],
  ['work', 'Ce que j’ai fait'],
  ['result', 'Le résultat'],
] as const;

const renderProject = (project: Project): Lines => {
  const texts = DETAILS.flatMap(([key, label]) => {
    const text = project[key];
    return text ? [`<p class="project-detail-label">${label}</p>`, ...paragraphs(text)] : [];
  });
  const captures =
    project.captures.length > 0
      ? block(
          '<div class="project-captures">',
          project.captures.map((capture) => `<figure><img src="assets/media/${esc(capture.file)}" alt="${esc(capture.alt)}" loading="lazy"></figure>`),
          '</div>',
        )
      : [];
  const details = texts.length + captures.length > 0 ? block('<details class="project-details">', ['<summary>En savoir plus</summary>', ...texts, ...captures], '</details>') : [];
  const links =
    project.links.length > 0 ? block('<div class="project-links">', project.links.map((link) => externalLink(link.href, `→ ${link.label}`)), '</div>') : [];
  return block(
    '<article class="project-item">',
    [`<h4 class="project-title">${esc(project.title)}</h4>`, `<p class="project-description">${esc(project.summary)}</p>`, ...details, ...links, ...badges(project.techs)],
    '</article>',
  );
};

const tabId = (category: ProjectCategory): string => `onglet-${category.id}`;
const panelId = (category: ProjectCategory): string => `projets-${category.id}`;

const renderCategory = (category: ProjectCategory, projects: Project[]): Lines =>
  block(
    `<div class="project-category" role="tabpanel" id="${panelId(category)}" aria-labelledby="${tabId(category)}">`,
    [
      `<h3 class="project-category-title">${esc(category.title)}</h3>`,
      `<p class="project-category-description">${esc(category.description)}</p>`,
      ...block('<div class="projects-list">', projects.flatMap(renderProject), '</div>'),
    ],
    '</div>',
  );

/**
 * Un onglet par catégorie, puis les catégories en panneaux. Tout est dans le HTML : sans script, les catégories
 * restent les unes sous les autres ; le script du site affiche les onglets et une seule catégorie à la fois.
 */
const renderProjects = ({ projectCategories, projects }: Content): Lines => {
  const groups = projectCategories
    .map((category) => ({ category, projects: projects.filter((project) => project.categoryId === category.id) }))
    .filter((group) => group.projects.length > 0);
  if (groups.length === 0) return [];
  return block(
    '<div class="project-browser" data-project-tabs>',
    [
      ...block(
        '<div class="project-tabs" role="tablist" aria-label="Catégories de projets">',
        groups.map(
          ({ category, projects: inCategory }) =>
            `<button type="button" class="project-tab" role="tab" id="${tabId(category)}" aria-controls="${panelId(category)}">${esc(category.title)} <span class="project-tab-count">${inCategory.length}</span></button>`,
        ),
        '</div>',
      ),
      ...block('<div class="project-panels">', groups.flatMap((group) => renderCategory(group.category, group.projects)), '</div>'),
    ],
    '</div>',
  );
};

const renderSoftSkills = ({ profile }: Content): Lines => [
  ...(profile.softSkills.length > 0 ? block('<div class="soft-skills">', list(null, profile.softSkills, 'soft-skill'), '</div>') : []),
  ...(profile.workStyle.length > 0
    ? block(
        '<div class="work-styles">',
        profile.workStyle.flatMap((style) =>
          block('<div class="work-style">', [`<p class="work-style-quality">${esc(style.quality)}</p>`, `<p class="work-style-proof">${esc(style.proof)}</p>`], '</div>'),
        ),
        '</div>',
      )
    : []),
];

const renderEducation = (education: Education): Lines =>
  block(
    '<div class="education-item">',
    [
      ...block(
        '<div class="education-header">',
        [
          ...block('<div>', [`<p class="education-degree">${esc(education.degree)}</p>`, `<p class="education-school">${esc(education.school)}</p>`], '</div>'),
          `<p class="education-date">${esc(formatPeriod(education.start, education.end))}</p>`,
        ],
        '</div>',
      ),
      ...(education.details.length > 0 ? list('education-details', education.details) : []),
    ],
    '</div>',
  );

const renderAvailability = ({ profile }: Content): Lines => {
  const item = (label: string, value: string) => block('<div class="availability-item">', [`<p><strong>${label}</strong></p>`, `<p>${esc(value)}</p>`], '</div>');
  return [
    `<h3>${esc(profile.search.contractType)} – ${esc(profile.role)}</h3>`,
    ...block(
      '<div class="availability-info">',
      [
        ...item('Type de contrat', `${profile.search.contractType} ${profile.search.duration}`),
        ...item('Localisation', profile.search.location),
        ...item('Disponibilité', profile.search.start),
      ],
      '</div>',
    ),
  ];
};

const renderContactLinks = ({ contact }: Content): Lines => [
  ...block('<li>', [`<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>`], '</li>'),
  ...block('<li>', [`<a href="tel:${esc(contact.phone.replace(/[^\d+]/g, ''))}">${esc(contact.phone)}</a>`], '</li>'),
  ...contact.links.flatMap((link) =>
    block('<li>', [/^https?:/i.test(link.href) ? externalLink(link.href, link.label) : `<a href="${esc(link.href)}">${esc(link.label)}</a>`], '</li>'),
  ),
];

/** Le HTML de chaque section, à placer entre ses marqueurs. Un champ vide n'affiche rien. */
export const renderSections = ({ content }: PublicSnapshot): Sections => ({
  'meta-description': `<meta property="og:description" content="${esc(`${searchSentence(content.profile.search)} ${searchDetails(content.profile.search)}`)}">`,
  hero: join(renderHero(content)),
  about: content.profile.about ? join(paragraphs(content.profile.about)) : '',
  goals: join(renderGoals(content)),
  experiences: join(content.experiences.flatMap(renderExperience)),
  projects: join(renderProjects(content)),
  skills: join(content.skillCategories.flatMap((category) => block('<div class="skill-category">', [`<h3>${esc(category.title)}</h3>`, ...badges(category.skills)], '</div>'))),
  'soft-skills': join(renderSoftSkills(content)),
  education: join(content.educations.flatMap(renderEducation)),
  availability: join(renderAvailability(content)),
  interests: join(content.profile.hobbies.map((hobby) => `<li>${HOBBY_EMOJIS[hobby.id] ? `${HOBBY_EMOJIS[hobby.id]} ` : ''}${esc(hobby.label)}</li>`)),
  'contact-links': join(renderContactLinks(content)),
});

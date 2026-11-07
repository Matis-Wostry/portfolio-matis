import { describe, expect, test } from 'vitest';
import { formatPeriod, renderSections } from '../src/render.ts';
import { content, project, snapshot } from './fixture.ts';

const render = (over: Parameters<typeof snapshot>[0] = {}) => renderSections(snapshot(over));
const profile = content().profile;

describe('textes', () => {
  test('le texte est échappé', () => {
    const sections = render({ profile: { ...profile, about: '<script>alert(1)</script> & co' } });
    expect(sections.about).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; co');
    expect(sections.about).not.toContain('<script>');
  });

  test('un attribut ne peut pas être refermé par le contenu', () => {
    const sections = render({ contact: { ...content().contact, links: [{ label: 'X', href: 'https://exemple.com/?a="><script>' }] } });
    expect(sections['contact-links']).toContain('href="https://exemple.com/?a=&quot;&gt;&lt;script&gt;"');
  });

  test('« À propos » garde ses paragraphes', () => {
    expect(render().about).toBe('<p>Premier paragraphe.</p>\n<p>Second paragraphe.</p>');
  });
});

describe('dates', () => {
  test.each([
    ['2024', null, '2024 - Aujourd’hui'],
    ['2024', '2024', '2024'],
    ['2024-08', '2025-09', 'août 2024 - septembre 2025'],
    ['2022', '2025', '2022 - 2025'],
  ])('%s à %s donne « %s »', (start, end, expected) => {
    expect(formatPeriod(start, end)).toBe(expected);
  });
});

describe('recherche', () => {
  test('le hero, og:description et #availability disent la même chose', () => {
    const sections = render();
    expect(sections['meta-description']).toBe('<meta property="og:description" content="En recherche d’alternance à Genève (1 an, dès septembre 2027)">');
    expect(sections.hero).toContain('<p class="baseline">En recherche d’alternance à Genève<br>(1 an, dès septembre 2027)</p>');
    expect(sections.availability).toContain('<p>Alternance 1 an</p>');
    expect(sections.availability).toContain('<p>Genève</p>');
    expect(sections.availability).toContain('<p>Septembre 2027</p>');
  });

  test('un contrat qui commence par une consonne prend « de »', () => {
    const sections = render({ profile: { ...profile, search: { ...profile.search, contractType: 'Stage' } } });
    expect(sections.hero).toContain('En recherche de stage à Genève');
  });

  test('le nom s’affiche comme aujourd’hui : NOM en capitales, prénom en couleur', () => {
    expect(render().hero).toContain('<h1>WOSTRY <span class="accent">Matis</span></h1>');
    expect(render().hero).toContain('<p class="subtitle">Développeur full-stack junior</p>');
  });
});

describe('expériences', () => {
  test('titre, entreprise, dates, résumé, missions et technos', () => {
    const html = render().experiences;
    expect(html).toContain('<p class="timeline-title">Développeur</p>');
    expect(html).toContain('<p class="timeline-company">Octoplus Solutions</p>');
    expect(html).toContain('<p class="timeline-date">septembre 2026 - Aujourd’hui</p>');
    expect(html).toContain('<p>Alternance</p>');
    expect(html).toContain('<li>Développer</li>');
    expect(html).toContain('<li class="badge">React</li>');
  });

  test('une expérience sans résumé, missions ni technos n’a ni description ni badges vides', () => {
    const html = render({ experiences: [content().experiences[1]!] }).experiences;
    expect(html).not.toContain('timeline-description');
    expect(html).not.toContain('tech-badges');
  });
});

describe('projets', () => {
  const many = () =>
    render({
      projects: [
        project({ id: 'a', title: 'Alpha', categoryId: 'perso', position: 0 }),
        project({ id: 'b', title: 'Bêta', categoryId: 'pro', position: 1 }),
        project({ id: 'c', title: 'Gamma', categoryId: 'perso', position: 2 }),
      ],
    }).projects;

  test('groupés par catégorie, dans l’ordre des catégories puis des projets', () => {
    const html = many();
    const order = [...html.matchAll(/project-category-title">([^<]+)|project-title">([^<]+)/g)].map((m) => m[1] ?? m[2]);
    expect(order).toEqual(['Projets pro', 'Bêta', 'Projets perso', 'Alpha', 'Gamma']);
  });

  test('une catégorie sans projet n’apparaît pas', () => {
    expect(many()).not.toContain('Projets école');
  });

  test('un onglet par catégorie, avec son nombre de projets, dans l’ordre des catégories', () => {
    const html = many();
    expect(html).toContain('<div class="project-tabs" role="tablist" aria-label="Catégories de projets">');
    const tabs = [...html.matchAll(/<button type="button" class="project-tab" role="tab" id="([^"]+)" aria-controls="([^"]+)">([^<]+)<span class="project-tab-count">(\d+)<\/span><\/button>/g)];
    expect(tabs.map((tab) => [tab[1], tab[2], tab[3]?.trim(), tab[4]])).toEqual([
      ['onglet-pro', 'projets-pro', 'Projets pro', '1'],
      ['onglet-perso', 'projets-perso', 'Projets perso', '2'],
    ]);
  });

  test('chaque catégorie est le panneau de son onglet', () => {
    const html = many();
    expect(html).toContain('<div class="project-category" role="tabpanel" id="projets-pro" aria-labelledby="onglet-pro">');
    expect(html).toContain('<div class="project-category" role="tabpanel" id="projets-perso" aria-labelledby="onglet-perso">');
  });

  test('onglets et panneaux sont dans un même bloc que le script du site reconnaît', () => {
    expect(many()).toMatch(/^<div class="project-browser" data-project-tabs>/);
  });

  test('sans projet, ni onglets ni bloc vide', () => {
    expect(render({ projects: [] }).projects).toBe('');
  });

  test('un champ vide n’affiche rien : ni <details>, ni libellé orphelin', () => {
    const html = render().projects;
    expect(html).not.toContain('<details');
    expect(html).not.toContain('Le contexte');
    expect(html).not.toContain('project-links');
    expect(html).not.toContain('tech-badges');
  });

  test('un projet détaillé affiche contexte, travail réalisé, résultat et captures avec alt', () => {
    const html = render({
      projects: [
        project({
          context: 'Pour un client',
          work: 'Le back-end',
          result: 'En ligne',
          captures: [{ file: '0f8fad5b-d9cb-469f-a165-70867728950e.png', alt: 'Accueil' }],
          links: [{ label: 'Code', href: 'https://github.com/Matis-Wostry/Pokedex' }],
          techs: ['React'],
        }),
      ],
    }).projects;
    expect(html).toContain('<details class="project-details">');
    expect(html).toContain('<p class="project-detail-label">Le contexte</p>');
    expect(html).toContain('<p>Pour un client</p>');
    expect(html).toContain('<p class="project-detail-label">Ce que j’ai fait</p>');
    expect(html).toContain('<p class="project-detail-label">Le résultat</p>');
    expect(html).toContain('<img src="assets/media/0f8fad5b-d9cb-469f-a165-70867728950e.png" alt="Accueil" loading="lazy">');
    expect(html).toContain('<a href="https://github.com/Matis-Wostry/Pokedex" target="_blank" rel="noopener">→ Code</a>');
    expect(html).toContain('<li class="badge">React</li>');
  });
});

describe('autres sections', () => {
  test('goals rend objectifs, motivations et frustrations', () => {
    const html = render().goals;
    expect(html).toContain('<section id="goals">');
    for (const text of ['Objectifs', 'Décrocher une alternance', 'Motivations', 'Apprendre en construisant', 'Frustrations', 'Les tâches répétitives']) {
      expect(html).toContain(text);
    }
  });

  test('sans objectifs, motivations ni frustrations, la section n’existe pas', () => {
    expect(render({ profile: { ...profile, goals: [], motivations: [], frustrations: [] } }).goals).toBe('');
  });

  test('une liste vide parmi les trois ne laisse pas de carte vide', () => {
    expect(render({ profile: { ...profile, frustrations: [] } }).goals).not.toContain('Frustrations');
  });

  test('soft-skills rend savoir-être et façons de travailler', () => {
    const html = render()['soft-skills'];
    expect(html).toContain('<li class="soft-skill">Patient</li>');
    expect(html).toContain('<p class="work-style-quality">Autonome</p>');
    expect(html).toContain('<p class="work-style-proof">En freelance.</p>');
  });

  test('compétences : une carte par catégorie, avec son titre, son nombre et ses mots-clés', () => {
    const html = render().skills;
    expect(html).toContain('<div class="skill-card">');
    expect(html).toContain('<h3 class="skill-card-title">Langages</h3>');
    expect(html).toContain('<span class="skill-card-count">2</span>');
    expect(html).toContain('<ul class="skill-tags">');
    expect(html).toContain('<li class="skill-tag">HTML</li>');
  });

  test('une catégorie de compétences vide n’a pas de carte', () => {
    const html = render({ skillCategories: [{ id: 'vide', title: 'Vide', skills: [], position: 0 }] }).skills;
    expect(html).toBe('');
  });

  test('formations avec leur détail', () => {
    const html = render().education;
    expect(html).toContain('<p class="education-degree">Bachelor</p>');
    expect(html).toContain('<p class="education-date">2025 - 2028</p>');
    expect(html).toContain('<li>Programmation</li>');
  });

  test('loisirs avec leur émoji connu, sans émoji sinon', () => {
    const html = render().interests;
    expect(html).toContain('<li>🏀 Basket</li>');
    expect(html).toContain('<li>Lecture</li>');
  });

  test('contact : email, téléphone et liens', () => {
    const html = render()['contact-links'];
    expect(html).toContain('<a href="mailto:matis@example.com">matis@example.com</a>');
    expect(html).toContain('<a href="tel:+33600000000">+33 6 00 00 00 00</a>');
    expect(html).toContain('<a href="https://github.com/Matis-Wostry" target="_blank" rel="noopener">GitHub</a>');
  });
});

import { parse, type HTMLElement } from 'node-html-parser';

export type ClassiqueFacts = {
  about: string;
  email: string;
  github: string;
  availability: string[];
  experiences: { title: string; company: string; period: string; summary: string; missions: string[]; techs: string[] }[];
  projects: { title: string; summary: string; hrefs: string[] }[];
  educations: { degree: string; school: string; period: string; details: string[] }[];
  skillLines: string[];
  softSkills: string[];
};

const clean = (text: string | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();
const textOf = (root: HTMLElement, selector: string): string => clean(root.querySelector(selector)?.text);
const textsOf = (root: HTMLElement, selector: string): string[] => root.querySelectorAll(selector).map((el) => clean(el.text));

/** Relève ce que le site classique affiche aujourd'hui, pour le comparer au jeu. */
export const readClassique = (html: string): ClassiqueFacts => {
  const root = parse(html);
  const contactHrefs = root.querySelectorAll('.contact-links a').map((a) => a.getAttribute('href') ?? '');
  return {
    about: textOf(root, '#about p'),
    email: contactHrefs.find((href) => href.startsWith('mailto:'))?.replace('mailto:', '') ?? '',
    github: contactHrefs.find((href) => href.includes('github.com')) ?? '',
    availability: root.querySelectorAll('.availability-item').map((item) => clean(item.querySelectorAll('p').at(-1)?.text)),
    experiences: root.querySelectorAll('.timeline-item').map((item) => {
      const paragraphs = textsOf(item, '.timeline-description p');
      const items = textsOf(item, '.timeline-description li');
      // Une liste de missions suit parfois un résumé ; sans liste, chaque paragraphe est une mission.
      const missionsInParagraphs = items.length === 0 && paragraphs.length > 1;
      return {
        title: textOf(item, '.timeline-title'),
        company: textOf(item, '.timeline-company'),
        period: textOf(item, '.timeline-date'),
        summary: missionsInParagraphs ? '' : paragraphs.join(' '),
        missions: missionsInParagraphs ? paragraphs : items,
        techs: textsOf(item, '.badge'),
      };
    }),
    projects: root.querySelectorAll('.project-item').map((item) => ({
      title: textOf(item, '.project-title'),
      summary: textOf(item, '.project-description'),
      hrefs: item.querySelectorAll('.project-links a').map((a) => a.getAttribute('href') ?? ''),
    })),
    educations: root.querySelectorAll('.education-item').map((item) => ({
      degree: textOf(item, '.education-degree'),
      school: textOf(item, '.education-school'),
      period: textOf(item, '.education-date'),
      details: textsOf(item, '.education-details li'),
    })),
    skillLines: textsOf(root, '.skill-list li'),
    softSkills: textsOf(root, '.soft-skill'),
  };
};

import { describe, expect, test } from 'vitest';
import { applySections } from '../src/markers.ts';
import { renderSections, SECTIONS, type Sections } from '../src/render.ts';
import { snapshot, template } from './fixture.ts';

const sections = () => renderSections(snapshot());

describe('marqueurs', () => {
  test('chaque section remplace le contenu entre ses marqueurs, qui restent en place', () => {
    const html = applySections(template(), sections());
    expect(html).not.toContain('<p>ancien</p>');
    expect(html).toContain('<!-- content:about -->\n    <p>Premier paragraphe.</p>\n    <p>Second paragraphe.</p>\n    <!-- /content:about -->');
    for (const id of SECTIONS) {
      expect(html).toContain(`<!-- content:${id} -->`);
      expect(html).toContain(`<!-- /content:${id} -->`);
    }
  });

  test('une section sur la même ligne que ses marqueurs reste sur une ligne', () => {
    expect(applySections(template(), sections())).toContain(
      '<!-- content:meta-description --><meta property="og:description" content="En recherche d’alternance à Genève (1 an, dès septembre 2027)"><!-- /content:meta-description -->',
    );
  });

  test('les motifs de remplacement restent du texte', () => {
    const html = applySections(template(), { ...sections(), about: '<p>gain de $& et $1 et $$</p>' });
    expect(html).toContain('<p>gain de $& et $1 et $$</p>');
  });

  test('applySections est idempotent', () => {
    const once = applySections(template(), sections());
    expect(applySections(once, sections())).toBe(once);
  });

  test('ce qui est hors marqueurs ne change pas au caractère près', () => {
    const outside = (html: string) => html.replace(/<!-- content:([\w-]+) -->[\s\S]*?<!-- \/content:\1 -->/g, '[$1]');
    expect(outside(applySections(template(), sections()))).toBe(outside(template()));
  });

  test('un marqueur absent lève une erreur nommant la section', () => {
    const html = template().replace('<!-- content:skills -->', '');
    expect(() => applySections(html, sections())).toThrow(/skills/);
  });

  test('un marqueur en double lève une erreur nommant la section', () => {
    const html = template().replace('<!-- /content:interests -->', '<!-- /content:interests --><!-- content:interests --><!-- /content:interests -->');
    expect(() => applySections(html, sections())).toThrow(/interests/);
  });

  test('une section vide laisse les marqueurs seuls', () => {
    const empty = Object.fromEntries(SECTIONS.map((id) => [id, ''])) as Sections;
    expect(applySections(template(), empty)).toContain('<!-- content:goals -->\n    <!-- /content:goals -->');
  });
});

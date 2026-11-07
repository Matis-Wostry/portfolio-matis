export const PORTFOLIO = {
  projets: {
    categories: [
      { id: 'pro', title: 'Projets pro', description: 'En entreprise et en freelance.' },
      { id: 'ecole', title: 'Projets école', description: 'Réalisés pendant mes études.' },
      { id: 'perso', title: 'Projets perso', description: 'Pour apprendre et expérimenter.' },
    ],
    cards: [
      {
        id: 'pokedex', category: 'ecole', title: 'Pokédex',
        description: 'Une API REST et une interface React.', tags: ['React', 'Express'],
        links: [{ label: 'Code', href: 'https://github.com/Matis-Wostry/Pokedex' }],
      },
      {
        id: 'chambre-du-dev', category: 'perso', title: 'La Chambre du Dev',
        description: 'Ce portfolio : une chambre en pixel art.', tags: ['Phaser'],
        links: [{ label: 'Code', href: 'https://github.com/Matis-Wostry/portfolio-pixel' }],
      },
    ],
  },
  skills: {
    board: [
      { title: 'Langages', color: '#97345f', tags: ['HTML', 'Python'] },
      { title: 'Données & API', color: '#3d8fa3', tags: ['SQL', 'MongoDB'] },
    ],
  },
  about: {
    persona: {
      name: 'Matis Wostry',
      role: 'Développeur full-stack junior',
      facts: [
        { label: 'Base', value: 'Genève' },
        { label: 'Statut', value: 'Cherche une alternance d’un an dès sept. 2027' },
      ],
      goals: ['Décrocher une alternance'],
      motivations: ['Apprendre en construisant'],
      frustrations: ['Les tâches répétitives'],
      workStyle: [{ quality: 'Autonome', proof: 'En freelance.' }],
      timeline: [
        { period: '2022–2025', kind: 'etudes', title: 'BUT MMI', place: 'IUT Dijon-Auxerre' },
        { period: '2024–2025', kind: 'pro', title: 'Alternance · Le MieuxDisant', place: 'Intégrateur web' },
        { period: '2025–2027', kind: 'pro', title: 'Freelance', place: 'Développeur et SEO' },
      ],
      hobbies: [
        { label: 'Échecs', icon: 'icones/echecs.png' },
        { label: 'Jeux vidéo', icon: 'hobbies/jeux-video.png' },
      ],
    },
  },
  contact: {
    links: [
      { label: 'Email', href: 'mailto:matis.wostry@crea-inseec.com' },
      { label: '+33 6 34 89 62 32', href: 'tel:+33634896232' },
      { label: 'GitHub', href: 'https://github.com/Matis-Wostry' },
    ],
  },
};

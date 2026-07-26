import type { CSSProperties } from 'react'

// Demo-data voor de discovery-front-end. Vervangt de hardcoded prototype-data
// 1-op-1. Zodra er een publiek events-datamodel is afgesproken (staat niet in
// PLAN), komen deze lijsten uit server functions zoals `src/server/events.ts`.

function stripeBg(a: string, b: string): CSSProperties {
  return {
    backgroundImage: `repeating-linear-gradient(45deg,${a},${a} 10px,${b} 10px,${b} 20px)`,
  }
}

export type Category = { name: string; sub: string; pattern: CSSProperties }

export const categories: Array<Category> = [
  { name: 'Muziek', sub: 'Concerten & Festivals', pattern: stripeBg('#FFF7ED', '#FFEDD5') },
  { name: 'Tech', sub: 'Summits', pattern: stripeBg('#EFF6FF', '#DBEAFE') },
  { name: 'Business', sub: 'Netwerken', pattern: stripeBg('#F0FDF4', '#DCFCE7') },
  { name: 'Kunst & Design', sub: 'Galerijen & Shows', pattern: stripeBg('#FDF4FF', '#FAE8FF') },
  { name: 'Gezondheid', sub: 'Wellness & Yoga', pattern: stripeBg('#FEF2F2', '#FEE2E2') },
  { name: 'Sport', sub: 'Toernooien', pattern: stripeBg('#F0FDFA', '#CCFBF1') },
]

export type EventCard = {
  id: string
  category: string
  title: string
  dateLine: string
  location: string
  price: string
  participants: string
  pattern: CSSProperties
}

export const featuredEvents: Array<EventCard> = [
  {
    id: 'ai-big-data-expo-2026',
    category: 'Technology',
    title: 'Global AI & Big Data Expo 2026',
    dateLine: 'Za, 12 Feb · 09.00',
    location: 'ICE, BSD City',
    price: 'SRD 500 / $14',
    participants: '500',
    pattern: stripeBg('#EFF6FF', '#DBEAFE'),
  },
  {
    id: 'neon-night-festival',
    category: 'Muziek',
    title: 'Neon Night Festival',
    dateLine: 'Vr, 18 Feb · 19.00',
    location: 'Paramaribo',
    price: 'SRD 260 / $7',
    participants: '1.2k',
    pattern: stripeBg('#FFF7ED', '#FFEDD5'),
  },
  {
    id: 'future-of-work-forum',
    category: 'Business',
    title: 'Future of Work Leadership Forum',
    dateLine: 'Ma, 14 Feb · 10.00',
    location: 'Torarica Hotel',
    price: 'SRD 650 / $18',
    participants: '400',
    pattern: stripeBg('#F0FDF4', '#DCFCE7'),
  },
]

export const upcomingEvents: Array<EventCard> = [
  {
    id: 'indie-rock-night',
    category: 'Muziek',
    title: 'Indie Rock Night at The Van Buren',
    dateLine: 'Vr, 18 Feb · 19.00',
    location: 'Malang',
    participants: '500',
    price: 'SRD 150 / $4',
    pattern: stripeBg('#FFF7ED', '#FFEDD5'),
  },
  {
    id: 'abstract-painting-workshop',
    category: 'Kunst & Design',
    title: 'Creative Abstract Painting Workshop',
    dateLine: 'Za, 19 Feb · 08.00',
    location: 'Surabaya',
    participants: '200',
    price: 'SRD 350 / $9',
    pattern: stripeBg('#FDF4FF', '#FAE8FF'),
  },
  {
    id: 'city-charity-marathon',
    category: 'Gezondheid',
    title: 'City Charity Marathon 2026',
    dateLine: 'Zo, 20 Feb · 07.30',
    location: 'Semarang',
    participants: '1.7k',
    price: 'SRD 250 / $7',
    pattern: stripeBg('#FEF2F2', '#FEE2E2'),
  },
]

// Lijst voor de overzichts-/zoekpagina.
export const allEvents: Array<EventCard> = [
  {
    id: 'ai-big-data-expo-2026',
    category: 'Technology',
    title: 'Global AI & Big Data Expo 2026',
    dateLine: 'Za, 12 Feb · 09.00',
    location: 'JCC Senayan',
    price: 'SRD 500 / $14',
    participants: '500',
    pattern: stripeBg('#EFF6FF', '#DBEAFE'),
  },
  {
    id: 'startup-founder-meetup',
    category: 'Technology',
    title: 'Tech Startups Founder Meetup',
    dateLine: 'Zo, 13 Feb · 10.00',
    location: 'BSD City',
    price: 'SRD 150 / $4',
    participants: '400',
    pattern: stripeBg('#EFF6FF', '#DBEAFE'),
  },
  {
    id: 'fintech-blockchain-summit',
    category: 'Business',
    title: 'Future of FinTech & Blockchain Summit',
    dateLine: 'Ma, 14 Feb · 08.30',
    location: 'SCBD Jakarta',
    price: 'SRD 750 / $21',
    participants: '1.7k',
    pattern: stripeBg('#F0FDF4', '#DCFCE7'),
  },
  {
    id: 'cyber-security-world',
    category: 'Technology',
    title: 'Cyber Security World Conference',
    dateLine: 'Di, 15 Feb · 09.00',
    location: 'Bandung',
    price: 'SRD 450 / $12',
    participants: '800',
    pattern: stripeBg('#EFF6FF', '#DBEAFE'),
  },
  {
    id: 'fullstack-bootcamp',
    category: 'Technology',
    title: 'Full Stack Developer Bootcamp 2026',
    dateLine: 'Wo, 16 Feb · 13.00',
    location: 'Surabaya',
    price: 'SRD 300 / $8',
    participants: '200',
    pattern: stripeBg('#EFF6FF', '#DBEAFE'),
  },
  {
    id: 'pm-ux-festival',
    category: 'Business',
    title: 'Product Management & UX Festival',
    dateLine: 'Do, 17 Feb · 10.00',
    location: 'Bali',
    price: 'SRD 250 / $7',
    participants: '1.5k',
    pattern: stripeBg('#F0FDF4', '#DCFCE7'),
  },
  {
    id: 'indie-rock-night',
    category: 'Muziek',
    title: 'Indie Rock Night at The Van Buren',
    dateLine: 'Vr, 18 Feb · 19.00',
    location: 'Malang',
    price: 'SRD 150 / $4',
    participants: '500',
    pattern: stripeBg('#FFF7ED', '#FFEDD5'),
  },
  {
    id: 'abstract-painting-workshop',
    category: 'Art & Design',
    title: 'Creative Abstract Painting Workshop',
    dateLine: 'Za, 19 Feb · 08.00',
    location: 'Surabaya',
    price: 'SRD 350 / $9',
    participants: '200',
    pattern: stripeBg('#FDF4FF', '#FAE8FF'),
  },
  {
    id: 'city-charity-marathon',
    category: 'Health',
    title: 'City Charity Marathon 2026',
    dateLine: 'Zo, 20 Feb · 07.30',
    location: 'Semarang',
    price: 'SRD 250 / $7',
    participants: '1.7k',
    pattern: stripeBg('#FEF2F2', '#FEE2E2'),
  },
]

export const overviewCategoryFilters = [
  'Muziek',
  'Technology',
  'Business',
  'Food & Drink',
  'Health',
  'Art & Design',
  'Sports',
]

export const dateFilters = ['Elke datum', 'Vandaag', 'Dit weekend', 'Kies datum...']

// ── Detailpagina-data ───────────────────────────────────────────────────────

export type Speaker = { name: string; role: string; pattern: CSSProperties }
export type AgendaItem = {
  time: string
  title: string
  sub: string
  desc?: string
  accent: string
  dotBg: string
}
export type Faq = { q: string; a?: string }

export type EventDetail = {
  id: string
  title: string
  dateLocationLine: string
  dateLong: string
  timeRange: string
  location: string
  priceFrom: string
  organizer: string
  paragraphs: Array<string>
  highlights: Array<string>
  speakers: Array<Speaker>
  agenda: Array<AgendaItem>
  faqs: Array<Faq>
}

const speakerPattern = stripeBg('#F1F5F9', '#E2E8F0')

// Eén uitgewerkt detailvoorbeeld (zoals in het ontwerp). Onbekende id's vallen
// hierop terug, met de titel uit de lijst als die bekend is.
export const demoEventDetail: EventDetail = {
  id: 'ai-big-data-expo-2026',
  title: 'Global AI & Big Data Expo 2026',
  dateLocationLine: 'Za, 12 Feb · ICE, BSD City, Tangerang',
  dateLong: 'Zaterdag, 12 februari 2026',
  timeRange: '09.00 – 12.00',
  location: 'Indonesia Convention Exhibition (ICE), BSD City',
  priceFrom: 'SRD 500 / $14',
  organizer: 'TechFuture Inc.',
  paragraphs: [
    'Ontdek de transformerende kracht van Artificial Intelligence. De Global AI & Big Data Expo 2026 is de toonaangevende conferentie om te ontdekken hoe AI en Big Data industrieën ontwrichten, van gezondheidszorg tot productie.',
    'We duiken diep in predictive analytics, neurale netwerken en automatiseringsstrategieën. Doe praktische kennis op over het benutten van data voor bedrijfsgroei en operationele efficiëntie.',
  ],
  highlights: [
    'Inzichten van leiders bij Google, OpenAI en Microsoft',
    'Praktijksessies: schaalbare AI-oplossingen bouwen',
    'Connect met 5.000+ techliefhebbers en innovators',
  ],
  speakers: [
    { name: 'Elena Fisher', role: 'Head of AI at Google', pattern: speakerPattern },
    { name: 'David Chen', role: 'Data Scientist', pattern: speakerPattern },
    { name: 'Michael Tan', role: 'Robotics Engineer', pattern: speakerPattern },
    { name: 'Sarah Connor', role: 'CEO of TechMedia', pattern: speakerPattern },
  ],
  agenda: [
    {
      time: '09.00',
      title: 'Keynote: The Rise of Generative AI',
      sub: 'Hoofdzaal · Elena Fisher',
      desc: 'Een diepgaande blik op de huidige markttrends en voorspellingen voor het volgende decennium van AI en automatisering.',
      accent: '#2563EB',
      dotBg: '#DBEAFE',
    },
    {
      time: '10.30',
      title: 'Breakout: Building LLM Apps',
      sub: 'Zaal 204 · David Chen',
      accent: '#F59E0B',
      dotBg: '#FEF3C7',
    },
    {
      time: '12.00',
      title: 'Netwerklunch',
      sub: 'Eetruimte',
      accent: '#22C55E',
      dotBg: '#DCFCE7',
    },
  ],
  faqs: [
    { q: 'Moet ik een laptop meenemen?' },
    {
      q: 'Is lunch inbegrepen?',
      a: 'Ja, een gratis buffetlunch wordt aangeboden aan alle deelnemers, met vegetarische, veganistische en halal opties.',
    },
  ],
}

// Titel opzoeken uit de bekende lijsten (voor de hero op de detailpagina).
export function findEventTitle(id: string): string | undefined {
  return allEvents.find((e) => e.id === id)?.title ?? featuredEvents.find((e) => e.id === id)?.title
}

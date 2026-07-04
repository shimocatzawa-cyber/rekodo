export interface CardDefinition {
  id:     string;
  number: number;
  name:   string;
  image:  string;
}

export const CARD_DEFINITIONS: CardDefinition[] = [
  { id: "beginner",            number: 1,  name: "The Beginner",           image: "/cards/RK-001.png" },
  { id: "curator",             number: 2,  name: "The Curator",            image: "/cards/RK-002.png" },
  { id: "explorer",            number: 3,  name: "The Explorer",           image: "/cards/RK-003.png" },
  { id: "completionist",       number: 4,  name: "The Completionist",      image: "/cards/RK-004.png" },
  { id: "historian",           number: 5,  name: "The Historian",          image: "/cards/RK-005.png" },
  { id: "romantic",            number: 6,  name: "The Romantic",           image: "/cards/RK-006.png" },
  { id: "seeker",              number: 7,  name: "The Seeker",             image: "/cards/RK-007.png" },
  { id: "purist",              number: 8,  name: "The Purist",             image: "/cards/RK-008.png" },
  { id: "alchemist",           number: 9,  name: "The Alchemist",          image: "/cards/RK-009.png" },
  { id: "wanderer",            number: 10, name: "The Wanderer",           image: "/cards/RK-010.png" },
  { id: "listener",            number: 11, name: "The Listener",           image: "/cards/RK-011.png" },
  { id: "keeper",              number: 12, name: "The Keeper",             image: "/cards/RK-012.png" },
  { id: "transformer",         number: 13, name: "The Transformer",        image: "/cards/RK-013.png" },
  { id: "oracle",              number: 14, name: "The Oracle",             image: "/cards/RK-014.png" },
  { id: "obsessive",           number: 15, name: "The Obsessive",          image: "/cards/RK-015.png" },
  { id: "hunter",              number: 16, name: "The Hunter",             image: "/cards/RK-016.png" },
  { id: "sonic-archaeologist", number: 17, name: "The Sonic Archaeologist", image: "/cards/RK-017.png" },
  { id: "dreamer",             number: 18, name: "The Dreamer",            image: "/cards/RK-018.png" },
  { id: "constellation",       number: 19, name: "The Constellation",      image: "/cards/RK-019.png" },
  { id: "librarian",           number: 20, name: "The Librarian",          image: "/cards/RK-020.png" },
  { id: "collector",           number: 21, name: "The Collector",          image: "/cards/RK-021.png" },
  { id: "myth",                number: 22, name: "The Myth",               image: "/cards/RK-022.png" },
];

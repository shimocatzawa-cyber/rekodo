export interface CardDefinition {
  id:          string;
  number:      number;
  name:        string;
  image:       string;
  hint:        string;        // shown on the locked card back + panel
  description: string;        // flavour copy shown in the detail panel
}

export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    id: "beginner", number: 1, name: "The Beginner",
    image: "/cards/RK-001.png",
    hint: "Already yours.",
    description: "Every collection starts with a single record. Welcome to the fold.",
  },
  {
    id: "curator", number: 2, name: "The Curator",
    image: "/cards/RK-002.png",
    hint: "Connect your Discogs account.",
    description: "Your taste doesn't live in a silo. You've mapped the catalogue.",
  },
  {
    id: "explorer", number: 3, name: "The Explorer",
    image: "/cards/RK-003.png",
    hint: "Collect records from 8 or more different genres.",
    description: "Eight genres and counting. Your collection refuses to be categorised.",
  },
  {
    id: "completionist", number: 4, name: "The Completionist",
    image: "/cards/RK-004.png",
    hint: "Tag every record with a feeling and an essential rating.",
    description: "Not a single record left untagged. You know exactly what you own.",
  },
  {
    id: "historian", number: 5, name: "The Historian",
    image: "/cards/RK-005.png",
    hint: "Log a memory for one of your records.",
    description: "A record without a story is just an object. You gave yours a life.",
  },
  {
    id: "romantic", number: 6, name: "The Romantic",
    image: "/cards/RK-006.png",
    hint: "Play the same record 10 or more times.",
    description: "You found the one. The record that gets better with every listen.",
  },
  {
    id: "seeker", number: 7, name: "The Seeker",
    image: "/cards/RK-007.png",
    hint: "Add 10 or more records to your wantlist.",
    description: "The wanting is part of the collecting. You live in the gap between found and not yet.",
  },
  {
    id: "purist", number: 8, name: "The Purist",
    image: "/cards/RK-008.png",
    hint: "Mark 90% of your offer-tracked records as not open to offers.",
    description: "Not everything is for sale. Some records are simply yours.",
  },
  {
    id: "alchemist", number: 9, name: "The Alchemist",
    image: "/cards/RK-009.png",
    hint: "Create a playlist using the Dig feature.",
    description: "You turned a collection into a soundtrack. The alchemy is real.",
  },
  {
    id: "wanderer", number: 10, name: "The Wanderer",
    image: "/cards/RK-010.png",
    hint: "Explore 10 or more records in the discovery feed.",
    description: "Every rabbit hole leads somewhere. You've followed more than most.",
  },
  {
    id: "listener", number: 11, name: "The Listener",
    image: "/cards/RK-011.png",
    hint: "Log your first listening session.",
    description: "You don't just own the music. You actually listen.",
  },
  {
    id: "keeper", number: 12, name: "The Keeper",
    image: "/cards/RK-012.png",
    hint: "Become a rekōdo supporter.",
    description: "You believe in this. So do we.",
  },
  {
    id: "transformer", number: 13, name: "The Transformer",
    image: "/cards/RK-013.png",
    hint: "Coming soon.",
    description: "Something is shifting. The card is waiting.",
  },
  {
    id: "oracle", number: 14, name: "The Oracle",
    image: "/cards/RK-014.png",
    hint: "Coming soon.",
    description: "The deeper patterns of your taste, laid bare.",
  },
  {
    id: "obsessive", number: 15, name: "The Obsessive",
    image: "/cards/RK-015.png",
    hint: "Add 250 or more records to your collection.",
    description: "250 records. There's no casual collector at this depth.",
  },
  {
    id: "hunter", number: 16, name: "The Hunter",
    image: "/cards/RK-016.png",
    hint: "Use the Dig feature on 7 or more different days.",
    description: "Seven sessions in the crates. The hunt is its own reward.",
  },
  {
    id: "sonic-archaeologist", number: 17, name: "The Sonic Archaeologist",
    image: "/cards/RK-017.png",
    hint: "Own 10 or more records with producer or matrix data.",
    description: "You read the grooves, the matrix, the credits. You dig into the surfaces.",
  },
  {
    id: "dreamer", number: 18, name: "The Dreamer",
    image: "/cards/RK-018.png",
    hint: "Add 25 or more records to your wantlist.",
    description: "A wantlist of 25 is a manifesto for what the collection could become.",
  },
  {
    id: "constellation", number: 19, name: "The Constellation",
    image: "/cards/RK-019.png",
    hint: "Share one of your rekōdo cards.",
    description: "A card shared is a connection made. The constellation grows.",
  },
  {
    id: "librarian", number: 20, name: "The Librarian",
    image: "/cards/RK-020.png",
    hint: "Create 3 or more lists.",
    description: "Three lists means you've started to organise the chaos. Deliberately.",
  },
  {
    id: "collector", number: 21, name: "The Collector",
    image: "/cards/RK-021.png",
    hint: "Unlock 15 or more other cards.",
    description: "Fifteen cards. The shape of a collecting life, mapped.",
  },
  {
    id: "myth", number: 22, name: "The Myth",
    image: "/cards/RK-022.png",
    hint: "Unlock every other card.",
    description: "All of them. You did all of them.",
  },
];

export interface ArchetypeDefinition {
  id: string
  name: string
  japanese: string
  jungianRoot: string
  color: string
  sentence: string
  shortDescription: string
  shadowOf: string
  imagePath: string
}

export const ARCHETYPES: Record<string, ArchetypeDefinition> = {
  keeper: {
    id: 'keeper',
    name: 'The Keeper',
    japanese: '保管者',
    jungianRoot: 'The Sage · The Caregiver',
    color: '#185FA5',
    sentence: 'You don\'t just own these records. You are keeping them.',
    shortDescription: 'Feels responsible for what they own. The collection is a trust held on behalf of the music itself.',
    shadowOf: 'jester',
    imagePath: '/archetypes/keeper.png',
  },
  seeker: {
    id: 'seeker',
    name: 'The Seeker',
    japanese: '探求者',
    jungianRoot: 'The Explorer',
    color: '#0F6E56',
    sentence: 'The wantlist is never empty because that\'s not the point.',
    shortDescription: 'In permanent motion, following threads only they can see. Discovery is the experience — arrival is the beginning of the next search.',
    shadowOf: 'keeper',
    imagePath: '/archetypes/seeker.png',
  },
  scholar: {
    id: 'scholar',
    name: 'The Scholar',
    japanese: '学者',
    jungianRoot: 'The Sage · Logos',
    color: '#533AB7',
    sentence: 'Every record is a primary source.',
    shortDescription: 'The collection as evidence. Every record is data in an ongoing inquiry. Styles and geography are a precision taxonomy.',
    shadowOf: 'lover',
    imagePath: '/archetypes/scholar.png',
  },
  ritualist: {
    id: 'ritualist',
    name: 'The Ritualist',
    japanese: '儀式者',
    jungianRoot: 'The Innocent · The Child',
    color: '#854F0B',
    sentence: 'You know these fifty records better than most collectors know their five hundred.',
    shortDescription: 'The collection exists to be listened to, deliberately and completely. Depth over breadth. Returns to the same records the way one returns to a practice.',
    shadowOf: 'seeker',
    imagePath: '/archetypes/ritualist.png',
  },
  hunter: {
    id: 'hunter',
    name: 'The Hunter',
    japanese: '狩人',
    jungianRoot: 'The Hero',
    color: '#9A1F1F',
    sentence: 'Three years on the wantlist. Found in Osaka on a Tuesday. That\'s the point.',
    shortDescription: 'The chase is the experience. Pressing matters for scarcity, not stewardship. The acquisition is the achievement.',
    shadowOf: 'ritualist',
    imagePath: '/archetypes/hunter.png',
  },
  lover: {
    id: 'lover',
    name: 'The Lover',
    japanese: '愛好者',
    jungianRoot: 'The Lover · Anima/Animus',
    color: '#CC5500',
    sentence: 'You couldn\'t explain some of these records to anyone. That\'s not a problem.',
    shortDescription: 'The collection is a diary. Records mark emotional events, relationships, periods of life.',
    shadowOf: 'scholar',
    imagePath: '/archetypes/lover.png',
  },
  alchemist: {
    id: 'alchemist',
    name: 'The Alchemist',
    japanese: '錬金術師',
    jungianRoot: 'The Magician · The Creator',
    color: '#3B6D11',
    sentence: 'The collection is what you work with. The lists are what you make.',
    shortDescription: 'Music is material. Transforms what they collect into something else — a set, a mix, an experience for an audience.',
    shadowOf: 'ritualist',
    imagePath: '/archetypes/alchemist.png',
  },
  pilgrim: {
    id: 'pilgrim',
    name: 'The Pilgrim',
    japanese: '巡礼者',
    jungianRoot: 'The Hero · The Self',
    color: '#2C6B7A',
    sentence: 'The reissue is a translation. You want the original language.',
    shortDescription: 'Follows music to its source. Wants the pressing made in the country where the music was created.',
    shadowOf: 'caregiver',
    imagePath: '/archetypes/pilgrim.png',
  },
  ruler: {
    id: 'ruler',
    name: 'The Ruler',
    japanese: '支配者',
    jungianRoot: 'The Ruler · The Sovereign',
    color: '#2C2820',
    sentence: 'This is what this music is. These are the records that matter.',
    shortDescription: 'Defines and dominates a canon. Not content to collect within a field — wants to own the field\'s definition.',
    shadowOf: 'seeker',
    imagePath: '/archetypes/ruler.png',
  },
  outlaw: {
    id: 'outlaw',
    name: 'The Outlaw',
    japanese: '無法者',
    jungianRoot: 'The Outlaw · The Revolutionary',
    color: '#6B1F6B',
    sentence: 'A desirability tag would ruin it.',
    shortDescription: 'Collects against the grain deliberately. Anti-canonical by intention. The wantlist is full of things no one else wants.',
    shadowOf: 'ruler',
    imagePath: '/archetypes/outlaw.png',
  },
  caregiver: {
    id: 'caregiver',
    name: 'The Caregiver',
    japanese: '養育者',
    jungianRoot: 'The Caregiver · The Nurturer',
    color: '#1F5C3A',
    sentence: 'The list is for someone specific. You already know who.',
    shortDescription: 'The collection exists partly to give away. Makes lists as gifts. Introduces people to music the way one introduces friends to each other.',
    shadowOf: 'scholar',
    imagePath: '/archetypes/caregiver.png',
  },
}

// Core desire for each primary Jungian archetype (shown in italic under Jung label)
export const JUNG_CORE_DESIRES: Record<string, string> = {
  "The Explorer":  "Freedom to discover who you are through exploration of the unknown",
  "The Sage":      "To use knowledge and intelligence to understand the world and share that truth",
  "The Innocent":  "To be happy, safe, and experience the world without complication",
  "The Hero":      "To prove your worth through courageous acts and the mastery of difficulty",
  "The Lover":     "To be in a relationship with the people, work, and surroundings you love",
  "The Magician":  "To understand the fundamental laws of the universe and use them to transform",
  "The Creator":   "To create things of enduring value and give them lasting form",
  "The Caregiver": "To protect and care for others, placing their needs at the centre",
  "The Ruler":     "To have power and resources — and use them to build a lasting order",
  "The Outlaw":    "Revolution — to overturn what isn't working and imagine what comes next",
  "The Child":     "To experience wonder and joy without the weight of expectation",
  "The Self":      "Wholeness — to integrate all parts of yourself into a coherent whole",
  "Logos":         "To structure the world through reason and bring order to complexity",
}

export const NAMED_PAIRINGS: Record<string, string> = {
  'keeper+scholar': 'The Conservator',
  'keeper+pilgrim': 'The Purist',
  'keeper+ruler': 'The Custodian',
  'seeker+scholar': 'The Etymologist',
  'seeker+outlaw': 'The Dissident',
  'seeker+pilgrim': 'The Anthropologist',
  'scholar+pilgrim': 'The Archaeologist',
  'scholar+ruler': 'The Taxonomist',
  'scholar+outlaw': 'The Revisionist',
  'ritualist+lover': 'The Devotee',
  'ritualist+keeper': 'The Monk',
  'ritualist+scholar': 'The Contemplative',
  'ritualist+outlaw': 'The Heretic',
  'outlaw+ritualist': 'The Heretic',
  'hunter+ruler': 'The Sovereign',
  'hunter+scholar': 'The Authenticator',
  'hunter+pilgrim': 'The Expeditionist',
  'lover+ritualist': 'The Devotee',
  'lover+caregiver': 'The Empath',
  'lover+alchemist': 'The Poet',
  'alchemist+scholar': 'The Critic',
  'alchemist+caregiver': 'The Teacher',
  'alchemist+outlaw': 'The Provocateur',
  'pilgrim+seeker': 'The Anthropologist',
  'pilgrim+outlaw': 'The Exile',
  'ruler+hunter': 'The Sovereign',
  'ruler+keeper': 'The Custodian',
  'outlaw+seeker': 'The Dissident',
  'outlaw+alchemist': 'The Provocateur',
  'caregiver+alchemist': 'The Teacher',
  'caregiver+lover': 'The Empath',
  'caregiver+scholar': 'The Guide',
}

export function getNamedPairing(primary: string, secondary: string): string | null {
  return NAMED_PAIRINGS[`${primary}+${secondary}`]
    || NAMED_PAIRINGS[`${secondary}+${primary}`]
    || null
}

export const SHADOW_PROMPTS: Record<string, string> = {
  keeper: 'Your collection has almost nothing surprising in it. You are keeping music beautifully. You are not being surprised by it.',
  seeker: 'Your collection is growing in all directions. Nothing is being tended.',
  scholar: 'You understand this music with extraordinary precision. You haven\'t let it surprise you emotionally in some time.',
  ritualist: 'You know what you have with extraordinary depth. There are whole worlds of music you haven\'t let in yet.',
  hunter: 'You find extraordinary records. Some of them you\'ve played twice.',
  lover: 'You feel this music with great intensity. You\'ve never really studied what it is or where it came from.',
  alchemist: 'You create beautifully for others. When did you last just sit and listen for yourself?',
  pilgrim: 'You\'ve gone deep into the source. The music you\'ve found deserves to be shared. Almost no one knows it exists.',
  ruler: 'You\'ve defined the territory with extraordinary authority. You stopped exploring it years ago.',
  outlaw: 'You\'ve refused every canon that was offered to you. You haven\'t built one of your own yet.',
  caregiver: 'You share music with great generosity. You rarely go somewhere others can\'t follow.',
  jester: 'Your collection has almost no surprises in it — not even for you.',
}

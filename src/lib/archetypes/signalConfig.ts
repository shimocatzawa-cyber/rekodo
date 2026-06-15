export interface SignalDefinition {
  id: string
  label: string
  japaneseLabel: string
  description: string
  dataSource: string
}

export const SIGNALS: SignalDefinition[] = [
  {
    id: 'labelLoyalty',
    label: 'Label Loyalty',
    japaneseLabel: 'レーベルへの忠誠',
    description: 'How concentrated your collection is around your top labels',
    dataSource: 'records.label',
  },
  {
    id: 'conditionStandard',
    label: 'Condition Standard',
    japaneseLabel: 'コンディション基準',
    description: 'The grade threshold you consistently buy at',
    dataSource: 'user_records.media_condition',
  },
  {
    id: 'formatFidelity',
    label: 'Format Fidelity',
    japaneseLabel: 'フォーマットへの忠実',
    description: 'LP dominance in your collection',
    dataSource: 'records.format',
  },
  {
    id: 'sonicCoherence',
    label: 'Sonic Coherence',
    japaneseLabel: '音楽的一貫性',
    description: 'How well your collection holds together as a single world',
    dataSource: 'records.genre + year + country',
  },
  {
    id: 'geographicRange',
    label: 'Geographic Range',
    japaneseLabel: '地理的多様性',
    description: 'Spread and counter-canonical weight of pressing countries',
    dataSource: 'records.country',
  },
  {
    id: 'pressingOriginDiversity',
    label: 'Pressing Origin',
    japaneseLabel: 'プレス原産地',
    description: 'Diversity of pressing origins weighted by counter-canonical score',
    dataSource: 'records.country',
  },
  {
    id: 'trophyRatio',
    label: 'Trophy Ratio',
    japaneseLabel: 'レアリティ指数',
    description: 'Concentration of high-desirability records',
    dataSource: 'records.community_want / community_have',
  },
  {
    id: 'historicalDepth',
    label: 'Historical Depth',
    japaneseLabel: '歴史的深度',
    description: 'Weight toward pre-1975 recordings',
    dataSource: 'records.year',
  },
  {
    id: 'acquisitionRhythm',
    label: 'Acquisition Rhythm',
    japaneseLabel: '収集のリズム',
    description: 'Consistency and tempo of your buying pattern',
    dataSource: 'user_records.created_at',
  },
  {
    id: 'styleRange',
    label: 'Style Range',
    japaneseLabel: 'スタイルの多様性',
    description: 'Breadth of style tags across your collection',
    dataSource: 'records.styles[]',
  },
  {
    id: 'transgressiveIndex',
    label: 'Transgressive Index',
    japaneseLabel: '逸脱指数',
    description: 'Concentration of experimental and marginal style tags',
    dataSource: 'records.styles[]',
  },
  {
    id: 'aspirationRatio',
    label: 'Aspiration Pattern',
    japaneseLabel: '願望のパターン',
    description: 'Wantlist size relative to owned collection',
    dataSource: 'wantlist vs records count',
  },
  {
    id: 'curatorialReach',
    label: 'Curatorial Reach',
    japaneseLabel: 'キュレーションの幅',
    description: 'How adventurously your lists reach beyond your collection\'s centre',
    dataSource: 'lists + list_items + records.genre',
  },
  {
    id: 'digitalDivergence',
    label: 'Digital Divergence',
    japaneseLabel: 'デジタルの乖離',
    description: 'How different your Bandcamp taste is from your vinyl',
    dataSource: 'digital_imports vs records',
  },
]

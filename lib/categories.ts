export type CategoryColor =
  | 'green'
  | 'blue'
  | 'red'
  | 'amber'
  | 'cyan'
  | 'purple'
  | 'orange'
  | 'gray'
  | 'rose'
  | 'pink'
  | 'emerald'
  | 'teal'
  | 'indigo'

export type CategoryConfig = {
  id?: string
  name: string
  color: CategoryColor
  keywords: string[]
  position: number
}

export const CATEGORY_SWATCHES: Record<CategoryColor, {
  label: string
  bg: string
  text: string
  border: string
}> = {
  green: { label: 'Green', bg: 'bg-green-400', text: 'text-green-600', border: '#4ade80' },
  blue: { label: 'Blue', bg: 'bg-blue-400', text: 'text-blue-600', border: '#60a5fa' },
  red: { label: 'Red', bg: 'bg-red-400', text: 'text-red-600', border: '#f87171' },
  amber: { label: 'Amber', bg: 'bg-amber-400', text: 'text-amber-600', border: '#fbbf24' },
  cyan: { label: 'Cyan', bg: 'bg-cyan-400', text: 'text-cyan-600', border: '#22d3ee' },
  purple: { label: 'Purple', bg: 'bg-purple-400', text: 'text-purple-600', border: '#c084fc' },
  orange: { label: 'Orange', bg: 'bg-orange-400', text: 'text-orange-600', border: '#fb923c' },
  gray: { label: 'Gray', bg: 'bg-gray-400', text: 'text-gray-600', border: '#9ca3af' },
  rose: { label: 'Rose', bg: 'bg-rose-400', text: 'text-rose-600', border: '#fb7185' },
  pink: { label: 'Pink', bg: 'bg-pink-400', text: 'text-pink-600', border: '#f472b6' },
  emerald: { label: 'Emerald', bg: 'bg-emerald-400', text: 'text-emerald-600', border: '#34d399' },
  teal: { label: 'Teal', bg: 'bg-teal-400', text: 'text-teal-600', border: '#2dd4bf' },
  indigo: { label: 'Indigo', bg: 'bg-indigo-400', text: 'text-indigo-600', border: '#818cf8' },
}

export const CATEGORY_COLOR_OPTIONS = Object.keys(CATEGORY_SWATCHES) as CategoryColor[]

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  {
    name: 'Produce',
    color: 'green',
    position: 0,
    keywords: [
      'apple', 'banana', 'grape', 'berry', 'mango', 'watermelon', 'strawberry',
      'pineapple', 'lemon', 'lime', 'orange', 'fruit', 'carrot', 'onion',
      'tomato', 'lettuce', 'spinach', 'kale', 'broccoli', 'cucumber', 'pepper',
      'cilantro', 'mint', 'ginger', 'garlic', 'veggie', 'vegetable', 'potato',
      'celery', 'zucchini', 'avocado', 'peach', 'plum', 'cherry', 'blueberry',
      'pesalu', 'green chili', 'mushroom',
    ],
  },
  {
    name: 'Dairy',
    color: 'blue',
    position: 1,
    keywords: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'paneer', 'ghee', 'curd', 'mozzarella', 'parmesan'],
  },
  {
    name: 'Meat & Fish',
    color: 'red',
    position: 2,
    keywords: ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'lamb', 'turkey', 'meat', 'salmon', 'tuna', 'crab', 'prawn', 'sausage'],
  },
  {
    name: 'Bakery & Grains',
    color: 'amber',
    position: 3,
    keywords: ['bread', 'cake', 'cupcake', 'muffin', 'bagel', 'tortilla', 'pasta', 'rice', 'cereal', 'flour', 'oat', 'grain', 'roti', 'naan', 'bun', 'roll', 'crouton'],
  },
  {
    name: 'Frozen',
    color: 'cyan',
    position: 4,
    keywords: ['frozen', 'ice cream'],
  },
  {
    name: 'Drinks',
    color: 'purple',
    position: 5,
    keywords: ['beer', 'wine', 'juice', 'soda', 'water', 'coffee', 'tea', 'drink', 'beverage', 'kombucha', 'lemonade'],
  },
  {
    name: 'Snacks',
    color: 'orange',
    position: 6,
    keywords: ['candy', 'chocolate', 'cookie', 'chip', 'snack', 'nut', 'peanut', 'cracker', 'pretzel', 'popcorn', 'toblerone', 'coconut', 'stevia', 'sugar'],
  },
  {
    name: 'Household',
    color: 'gray',
    position: 7,
    keywords: ['soap', 'shampoo', 'detergent', 'cleaning', 'tissue', 'paper', 'wipe', 'pad', 'tampon', 'toothpaste', 'body wash', 'aveeno', 'bengay', 'mulch', 'soil', 'salt', 'bleach', 'sponge', 'trash', 'bag', 'foil', 'wrap', 'plate', 'cup', 'fork', 'spoon', 'napkin', 'box', 'gift'],
  },
  {
    name: 'Other',
    color: 'gray',
    position: 8,
    keywords: [],
  },
]

export const CATEGORIES = DEFAULT_CATEGORIES.map(category => category.name)

export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map(category => [category.name, CATEGORY_SWATCHES[category.color].bg])
)

export const CATEGORY_TEXT: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map(category => [category.name, CATEGORY_SWATCHES[category.color].text])
)

export function parseKeywords(value: string) {
  return value
    .split(',')
    .map(keyword => keyword.trim().toLowerCase())
    .filter(Boolean)
}

export function formatKeywords(keywords: string[]) {
  return keywords.join(', ')
}

export function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function keywordMatches(itemName: string, keyword: string) {
  if (!keyword) return false
  return itemName.includes(keyword.toLowerCase())
}

export function inferCategory(name: string, categories: CategoryConfig[] = DEFAULT_CATEGORIES): string {
  const itemName = name.toLowerCase()
  const match = categories.find(category =>
    category.name !== 'Other' &&
    category.keywords.some(keyword => keywordMatches(itemName, keyword))
  )
  return match?.name ?? 'Other'
}

export function getCategoryConfig(name: string, categories: CategoryConfig[] = DEFAULT_CATEGORIES) {
  return categories.find(category => category.name === name) ?? DEFAULT_CATEGORIES.find(category => category.name === 'Other')!
}

export function getCategoryBg(name: string, categories: CategoryConfig[] = DEFAULT_CATEGORIES) {
  const config = getCategoryConfig(name, categories)
  return CATEGORY_SWATCHES[config.color]?.bg ?? CATEGORY_SWATCHES.gray.bg
}

export function getCategoryText(name: string, categories: CategoryConfig[] = DEFAULT_CATEGORIES) {
  const config = getCategoryConfig(name, categories)
  return CATEGORY_SWATCHES[config.color]?.text ?? CATEGORY_SWATCHES.gray.text
}

export function getCategoryBorder(name: string, categories: CategoryConfig[] = DEFAULT_CATEGORIES) {
  const config = getCategoryConfig(name, categories)
  return CATEGORY_SWATCHES[config.color]?.border ?? CATEGORY_SWATCHES.gray.border
}

export function withItemCategories(categories: CategoryConfig[], itemCategories: string[]) {
  const known = new Set(categories.map(category => category.name))
  const extras = itemCategories
    .filter(category => category && !known.has(category))
    .filter((category, index, all) => all.indexOf(category) === index)
    .map((name, index): CategoryConfig => ({
      name,
      color: 'gray',
      keywords: [],
      position: categories.length + index,
    }))

  return [...categories, ...extras].sort((a, b) => a.position - b.position)
}

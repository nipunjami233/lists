export const CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Fish',
  'Bakery & Grains',
  'Frozen',
  'Drinks',
  'Snacks',
  'Household',
  'Other',
] as const

export type Category = typeof CATEGORIES[number]

export const CATEGORY_COLORS: Record<string, string> = {
  'Produce':       'bg-green-400',
  'Dairy':         'bg-blue-400',
  'Meat & Fish':   'bg-red-400',
  'Bakery & Grains': 'bg-amber-400',
  'Frozen':        'bg-cyan-400',
  'Drinks':        'bg-purple-400',
  'Snacks':        'bg-orange-400',
  'Household':     'bg-gray-400',
  'Other':         'bg-gray-300',
}

export const CATEGORY_TEXT: Record<string, string> = {
  'Produce':       'text-green-600',
  'Dairy':         'text-blue-600',
  'Meat & Fish':   'text-red-600',
  'Bakery & Grains': 'text-amber-600',
  'Frozen':        'text-cyan-600',
  'Drinks':        'text-purple-600',
  'Snacks':        'text-orange-600',
  'Household':     'text-gray-600',
  'Other':         'text-gray-400',
}

export function inferCategory(name: string): string {
  const n = name.toLowerCase()
  if (/milk|cheese|yogurt|butter|cream|egg|paneer|ghee|curd|mozzarella|parmesan/.test(n)) return 'Dairy'
  if (/chicken|beef|pork|fish|shrimp|lamb|turkey|meat|salmon|tuna|crab|prawn|sausage/.test(n)) return 'Meat & Fish'
  if (/frozen|ice cream/.test(n)) return 'Frozen'
  if (/bread|cake|cupcake|muffin|bagel|tortilla|pasta|rice|cereal|flour|oat|grain|roti|naan|bun|roll|crouton/.test(n)) return 'Bakery & Grains'
  if (/beer|wine|juice|soda|water|coffee|tea|drink|beverage|kombucha|lemonade/.test(n)) return 'Drinks'
  if (/candy|chocolate|cookie|chip|snack|nut|peanut|cracker|pretzel|popcorn|toblerone|coconut|stevia|sugar/.test(n)) return 'Snacks'
  if (/soap|shampoo|detergent|cleaning|tissue|paper|wipe|pad|tampon|toothpaste|body wash|aveeno|bengay|mulch|soil|salt|bleach|sponge|trash|bag|foil|wrap|plate|cup|fork|spoon|napkin|box|gift/.test(n)) return 'Household'
  if (/apple|banana|grape|berry|mango|watermelon|strawberry|pineapple|lemon|lime|orange|fruit|carrot|onion|tomato|lettuce|spinach|kale|broccoli|cucumber|pepper|cilantro|mint|ginger|garlic|veggie|vegetable|potato|celery|zucchini|avocado|peach|plum|cherry|blueberry|pesalu|green chili|mushroom/.test(n)) return 'Produce'
  return 'Other'
}

/**
 * Professional color palette for tag prefixes.
 * Maps tag prefix to Tailwind CSS classes.
 */
const TAG_COLOR_MAP: Record<string, string> = {
  domain: 'bg-emerald-500 text-white',
  type: 'bg-violet-500 text-white',
  shared: 'bg-cyan-500 text-white',
  feature: 'bg-rose-500 text-white',
  scope: 'bg-amber-500 text-white',
  layer: 'bg-indigo-500 text-white',
  core: 'bg-purple-600 text-white',
  util: 'bg-teal-500 text-white',
  api: 'bg-blue-500 text-white',
  ui: 'bg-pink-500 text-white',
  data: 'bg-orange-500 text-white',
  test: 'bg-slate-500 text-white',
  lib: 'bg-fuchsia-500 text-white',
  app: 'bg-sky-500 text-white',
  config: 'bg-lime-600 text-white',
  root: 'bg-zinc-700 text-white',
  noTag: 'bg-gray-400 text-white',
};

/**
 * Color palette for generating consistent colors from unknown prefixes.
 */
const HASH_COLORS = [
  'bg-violet-600 text-white',
  'bg-purple-500 text-white',
  'bg-indigo-600 text-white',
  'bg-blue-600 text-white',
  'bg-cyan-600 text-white',
  'bg-teal-600 text-white',
  'bg-emerald-600 text-white',
  'bg-green-600 text-white',
  'bg-lime-600 text-white',
  'bg-amber-600 text-white',
  'bg-orange-600 text-white',
  'bg-red-600 text-white',
  'bg-rose-600 text-white',
  'bg-pink-600 text-white',
  'bg-fuchsia-600 text-white',
];

/**
 * Generates a consistent color for unknown prefixes based on string hash.
 */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return HASH_COLORS[Math.abs(hash) % HASH_COLORS.length];
}

/**
 * Returns the appropriate Tailwind CSS classes for a tag badge.
 * Uses predefined colors for known prefixes, generates consistent colors for unknown ones.
 *
 * @param tag - The tag string (e.g., "domain:users", "type:feature")
 * @returns Tailwind CSS classes for the badge
 */
export function tagBadgeClass(tag: string): string {
  const idx = tag.indexOf(':');
  const prefix = idx > 0 ? tag.substring(0, idx) : tag;

  // Check if we have a predefined color for this prefix
  if (TAG_COLOR_MAP[prefix]) {
    return TAG_COLOR_MAP[prefix];
  }

  // For unknown prefixes with colon, generate a consistent color
  if (idx > 0) {
    return hashColor(prefix);
  }

  // For tags without colon, use neutral
  return 'bg-neutral text-neutral-content';
}

import Link from 'next/link';
import type { ReactNode } from 'react';

import { COMPETITIONS } from '@/lib/football/competitions';

/**
 * Entity type for entity linking system
 */
export interface Entity {
  name: string;
  aliases: string[];
  href: string;
  type: 'competition' | 'team' | 'model';
}

/**
 * Build entity dictionary from competitions config, teams, and models.
 * Entities are sorted by name length descending to match longer names first
 * (e.g., "Champions League" before "League").
 *
 * @param teams - Array of team names to include
 * @param models - Array of model objects with id and displayName
 * @returns Sorted array of Entity objects
 */
export function buildEntityDictionary(
  teams: string[] = [],
  models: Array<{ id: string; displayName: string }> = []
): Entity[] {
  const entities: Entity[] = [];

  // Add competitions from config
  COMPETITIONS.forEach((comp) => {
    entities.push({
      name: comp.name,
      aliases: comp.aliases || [],
      href: `/leagues/${comp.id}`,
      type: 'competition',
    });
  });

  // Add teams (unique only)
  const uniqueTeams = [...new Set(teams)];
  uniqueTeams.forEach((team) => {
    entities.push({
      name: team,
      aliases: [],
      href: `/matches?team=${encodeURIComponent(team)}`,
      type: 'team',
    });
  });

  // Add models
  models.forEach((model) => {
    entities.push({
      name: model.displayName,
      aliases: [],
      href: `/models/${model.id}`,
      type: 'model',
    });
  });

  // Sort by name length descending (match longer names first to avoid partial matches)
  return entities.sort((a, b) => b.name.length - a.name.length);
}

/**
 * Convert text to React nodes with entity links.
 * Each entity is linked only once per text block.
 * Word boundary matching prevents false positives.
 *
 * @param text - The text to process
 * @param entities - Array of entities to link
 * @param maxLinks - Maximum number of links to insert (default: 5)
 * @returns Array of React nodes (strings and Link components)
 */
export function linkEntitiesInText(
  text: string,
  entities: Entity[],
  maxLinks: number = 5
): ReactNode[] {
  if (!text || entities.length === 0) {
    return [text];
  }

  // Build combined list of all searchable names (entity names + aliases)
  const allNames = entities.flatMap((e) => [e.name, ...e.aliases]);
  if (allNames.length === 0) return [text];

  // Escape special regex characters and sort by length descending
  const escapedNames = allNames
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);

  // Build regex with word boundaries for accurate matching
  const pattern = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'gi');

  let linkedCount = 0;
  const linkedEntities = new Set<string>();
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (linkedCount >= maxLinks) break;

    const matchedName = match[0];
    const matchLower = matchedName.toLowerCase();

    // Find the entity that matches this name or alias
    const entity = entities.find(
      (e) =>
        e.name.toLowerCase() === matchLower ||
        e.aliases.some((a) => a.toLowerCase() === matchLower)
    );

    // Only link if entity found and not already linked
    if (entity && !linkedEntities.has(entity.name.toLowerCase())) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }

      // Add linked entity (preserve original casing from text)
      result.push(
        <Link
          key={`${entity.name}-${match.index}`}
          href={entity.href}
          className="text-primary hover:underline"
        >
          {matchedName}
        </Link>
      );

      linkedEntities.add(entity.name.toLowerCase());
      linkedCount++;
      lastIndex = match.index + matchedName.length;
    }
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}

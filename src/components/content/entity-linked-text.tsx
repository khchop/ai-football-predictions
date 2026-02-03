import {
  buildEntityDictionary,
  linkEntitiesInText,
} from '@/lib/content/entity-linking';

interface EntityLinkedTextProps {
  /** The text content to process for entity linking */
  text: string;
  /** Team names to link (from match data) */
  teams?: string[];
  /** Models to link (from getActiveModels or similar) */
  models?: Array<{ id: string; displayName: string }>;
  /** Maximum number of entity links (default: 5) */
  maxLinks?: number;
  /** Optional wrapper className */
  className?: string;
}

/**
 * Server component that renders text with entity links.
 * Automatically converts team names, competition names, and model names
 * into clickable links to their respective pages.
 *
 * Usage:
 * ```tsx
 * <EntityLinkedText
 *   text={matchContent.preview}
 *   teams={[match.homeTeam, match.awayTeam]}
 *   models={activeModels.map(m => ({ id: m.id, displayName: m.displayName }))}
 *   maxLinks={5}
 * />
 * ```
 */
export function EntityLinkedText({
  text,
  teams = [],
  models = [],
  maxLinks = 5,
  className,
}: EntityLinkedTextProps) {
  if (!text) return null;

  const entities = buildEntityDictionary(teams, models);
  const linkedContent = linkEntitiesInText(text, entities, maxLinks);

  if (className) {
    return <span className={className}>{linkedContent}</span>;
  }

  return <>{linkedContent}</>;
}

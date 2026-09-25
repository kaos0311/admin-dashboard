/**
 * Token-budget helpers for context assembly.
 * Previously an empty scaffold. Keeps sampled context within a budget so a
 * large sample never silently truncates mid-record and misleads the model.
 */

export const DEFAULT_CONTEXT_BUDGET = 24_000;

/**
 * Greedy-fit a list of text blocks into a budget, preserving order and
 * marking anything dropped so omissions are explicit, not silent.
 */
export function fitBlocksToBudget(
  blocks: string[],
  charBudget: number = DEFAULT_CONTEXT_BUDGET
): { included: string[]; omittedCount: number } {
  const separatorCost = 2; // "\n\n"
  const included: string[] = [];
  let used = 0;
  let omittedCount = 0;

  for (const block of blocks) {
    const cost = block.length + (included.length > 0 ? separatorCost : 0);
    if (used + cost > charBudget) {
      omittedCount += 1;
      continue;
    }
    used += cost;
    included.push(block);
  }

  return { included, omittedCount };
}
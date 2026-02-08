import type { AuctionResult } from '../auction/auction.js';

export interface EquipSelection {
  readonly managerId: string;
  readonly toolIds: string[];
  readonly hazardIds: string[];
}

export interface EquipValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Validate equip selections against auction results and constraints.
 * Only tools won in auction can be equipped.
 */
export function validateEquipSelection(
  selection: EquipSelection,
  auctionResults: readonly AuctionResult[],
  availableToolIds: readonly string[],
  availableHazardIds: readonly string[],
  maxToolsPerRound: number = 3,
): EquipValidationResult {
  const errors: string[] = [];

  // Check manager participated in auction
  const managerAuction = auctionResults.find((r) => r.managerId === selection.managerId);
  if (!managerAuction) {
    errors.push(`Manager ${selection.managerId} did not participate in auction`);
    return { valid: false, errors };
  }

  // Check tool count limit
  if (selection.toolIds.length > maxToolsPerRound) {
    errors.push(`Too many tools selected: ${selection.toolIds.length} > max ${maxToolsPerRound}`);
  }

  // Check all selected tools are available
  for (const toolId of selection.toolIds) {
    if (!availableToolIds.includes(toolId)) {
      errors.push(`Tool '${toolId}' is not available`);
    }
  }

  // Check no duplicate tools
  const uniqueTools = new Set(selection.toolIds);
  if (uniqueTools.size !== selection.toolIds.length) {
    errors.push('Duplicate tool selections not allowed');
  }

  // Check all hazards are valid
  for (const hazardId of selection.hazardIds) {
    if (!availableHazardIds.includes(hazardId)) {
      errors.push(`Hazard '${hazardId}' is not recognized`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Apply default equip selection (empty) when manager doesn't submit.
 */
export function getDefaultEquipSelection(managerId: string): EquipSelection {
  return { managerId, toolIds: [], hazardIds: [] };
}

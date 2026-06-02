// Utility functions for the category tree (categories form a parent/child hierarchy).

import { Category } from './types'

export type TreeNode = {
  category: Category
  children: TreeNode[]
}

export function buildCategoryTree(categories: Category[], parentId: string | null = null): TreeNode[] {
  return categories
    .filter(c => c.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .map(c => ({ category: c, children: buildCategoryTree(categories, c.id) }))
}

export function getSubtreeIds(rootId: string, categories: Category[]): string[] {
  const result = [rootId]
  for (const c of categories) {
    if (c.parentId === rootId) result.push(...getSubtreeIds(c.id, categories))
  }
  return result
}

export function countDescendants(rootId: string, categories: Category[]): number {
  return getSubtreeIds(rootId, categories).length - 1
}

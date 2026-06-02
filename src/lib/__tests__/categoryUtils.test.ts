import { describe, it, expect } from 'vitest'
import { buildCategoryTree, getSubtreeIds, countDescendants } from '../categoryUtils'
import { Category } from '../types'

// ── helpers ────────────────────────────────────────────────────────────────

function cat(id: string, parentId: string | null = null, order = 0): Category {
  return { id, name: id, parentId, order }
}

// ── buildCategoryTree ──────────────────────────────────────────────────────

describe('buildCategoryTree', () => {
  it('returns [] for empty input', () => {
    expect(buildCategoryTree([])).toEqual([])
  })

  it('returns one root node with no children', () => {
    const tree = buildCategoryTree([cat('root')])
    expect(tree).toHaveLength(1)
    expect(tree[0].category.id).toBe('root')
    expect(tree[0].children).toEqual([])
  })

  it('attaches children to parent', () => {
    const cats = [cat('parent'), cat('child', 'parent')]
    const tree = buildCategoryTree(cats)
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].category.id).toBe('child')
  })

  it('builds a 3-level hierarchy', () => {
    const cats = [cat('a'), cat('b', 'a'), cat('c', 'b')]
    const tree = buildCategoryTree(cats)
    expect(tree[0].children[0].children[0].category.id).toBe('c')
  })

  it('sorts root nodes by order', () => {
    const cats = [cat('z', null, 2), cat('a', null, 0), cat('m', null, 1)]
    const tree = buildCategoryTree(cats)
    expect(tree.map(n => n.category.id)).toEqual(['a', 'm', 'z'])
  })

  it('sorts children by order', () => {
    const cats = [cat('root'), cat('c2', 'root', 2), cat('c0', 'root', 0), cat('c1', 'root', 1)]
    const tree = buildCategoryTree(cats)
    expect(tree[0].children.map(n => n.category.id)).toEqual(['c0', 'c1', 'c2'])
  })

  it('handles multiple root nodes', () => {
    const cats = [cat('a'), cat('b'), cat('c')]
    expect(buildCategoryTree(cats)).toHaveLength(3)
  })
})

// ── getSubtreeIds ──────────────────────────────────────────────────────────

describe('getSubtreeIds', () => {
  it('returns [id] for a leaf with no children', () => {
    expect(getSubtreeIds('leaf', [cat('leaf')])).toEqual(['leaf'])
  })

  it('returns root + direct children', () => {
    const cats = [cat('root'), cat('child1', 'root'), cat('child2', 'root')]
    const ids = getSubtreeIds('root', cats)
    expect(ids.sort()).toEqual(['child1', 'child2', 'root'])
  })

  it('returns entire subtree for 3-level hierarchy', () => {
    const cats = [cat('a'), cat('b', 'a'), cat('c', 'b'), cat('d', 'b')]
    const ids = getSubtreeIds('a', cats)
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not include siblings', () => {
    const cats = [cat('root'), cat('branch1', 'root'), cat('branch2', 'root'), cat('leaf', 'branch1')]
    const ids = getSubtreeIds('branch1', cats)
    expect(ids).not.toContain('branch2')
    expect(ids).not.toContain('root')
    expect(ids.sort()).toEqual(['branch1', 'leaf'])
  })

  it('returns [id] for unknown id (no children found)', () => {
    expect(getSubtreeIds('phantom', [cat('other')])).toEqual(['phantom'])
  })
})

// ── countDescendants ────────────────────────────────────────────────────────

describe('countDescendants', () => {
  it('returns 0 for a leaf', () => {
    expect(countDescendants('leaf', [cat('leaf')])).toBe(0)
  })

  it('returns 1 for single child', () => {
    expect(countDescendants('root', [cat('root'), cat('child', 'root')])).toBe(1)
  })

  it('returns 2 for two direct children', () => {
    const cats = [cat('root'), cat('c1', 'root'), cat('c2', 'root')]
    expect(countDescendants('root', cats)).toBe(2)
  })

  it('counts grandchildren', () => {
    const cats = [cat('root'), cat('mid', 'root'), cat('leaf', 'mid')]
    expect(countDescendants('root', cats)).toBe(2)
  })

  it('counts full subtree of 4 descendants', () => {
    const cats = [cat('a'), cat('b', 'a'), cat('c', 'a'), cat('d', 'b'), cat('e', 'b')]
    expect(countDescendants('a', cats)).toBe(4)
  })
})

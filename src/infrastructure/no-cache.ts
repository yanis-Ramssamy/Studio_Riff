import type { PlanningCache } from '#/application/ports.ts'

export const noCache: PlanningCache = {
  getOrLoad: (_roomId, _range, load) => load(),
  invalidate: async () => {},
}

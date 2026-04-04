import { db, type Dao, type Selectable } from '@proposalsapp/db';

export async function loadEnabledDaos(
  enabledDaoSlugs: string[]
): Promise<Array<Selectable<Dao>>> {
  if (enabledDaoSlugs.length === 0) {
    return [];
  }

  return db
    .selectFrom('dao')
    .selectAll()
    .where('slug', 'in', enabledDaoSlugs)
    .orderBy('slug', 'asc')
    .execute();
}

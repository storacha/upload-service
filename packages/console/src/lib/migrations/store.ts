import * as dagJSON from '@ipld/dag-json'
import { Migration, MigrationConfiguration, MigrationID } from './api'

export class MigrationsStorage {
  load () {
    if (typeof localStorage === 'undefined') { // in dev there is SSR
      return []
    }
    const ids: string[] = dagJSON.parse(localStorage.getItem('migrations') ?? '[]')
    const migrations: Migration[] = []
    for (const id of ids) {
      try {
        const migration: Migration = dagJSON.parse(localStorage.getItem(`migration.${id}`) ?? '')
        migrations.push(migration)
      } catch (err) {
        console.error(`failed to load migration: ${id}`, err)
      }
    }
    return migrations
  }

  create (config: MigrationConfiguration) {
    const migration: Migration = { id: crypto.randomUUID(), ...config }
    const ids: string[] = dagJSON.parse(localStorage.getItem('migrations') ?? '[]')
    localStorage.setItem(`migration.${migration.id}`, dagJSON.stringify(migration))
    localStorage.setItem('migrations', dagJSON.stringify([...ids, migration.id]))
    return { id: migration.id }
  }

  read (id: MigrationID) {
    const raw = localStorage.getItem(`migration.${id}`) ?? ''
    if (!raw) throw new Error('migration not found')
    return dagJSON.parse<Migration>(raw)
  }

  update (migration: Migration) {
    localStorage.setItem(`migration.${migration.id}`, dagJSON.stringify(migration))
  }

  delete (id: MigrationID) {
    const ids: string[] = dagJSON.parse(localStorage.getItem('migrations') ?? '[]')
    localStorage.setItem('migrations', dagJSON.stringify(ids.filter(i => i !== id)))
    localStorage.removeItem(`migration.${id}`)
  }
}

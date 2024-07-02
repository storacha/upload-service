'use client'

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { Migration, MigrationConfiguration, MigrationID, MigrationProgress, MigrationSource, UploadsSource } from '@/lib/migrations/api'
import { useW3 } from '@w3ui/react'
import * as Migrations from '@/lib/migrations'
import { MigrationsStorage } from '@/lib/migrations/store'
import { serviceConnection } from './services'

const MAX_LOG_LINES = 1000

export interface ContextState {
  migrations: Migration[]
  logs: Record<MigrationID, string[]>
}

export interface ContextActions {
  createMigration: (config: MigrationConfiguration) => ({ id: MigrationID })
  removeMigration: (id: MigrationID) => void
  startMigration: (id: MigrationID) => void
  stopMigration: (id: MigrationID) => void
}

export type ContextValue = [
  state: ContextState,
  actions: ContextActions
]

export const MigrationContextDefaultValue: ContextValue = [
  {
    migrations: [],
    logs: {}
  },
  {
    createMigration: () => { throw new Error('missing provider') },
    removeMigration: () => { throw new Error('missing provider') },
    startMigration: () => { throw new Error('missing provider') },
    stopMigration: () => { throw new Error('missing provider') }
  }
]

export const Context = createContext<ContextValue>(
  MigrationContextDefaultValue
)

export interface ProviderProps {
  children?: ReactNode
}

const runningMigrations: Record<string, AbortController> = {}
const migrationsStore = new MigrationsStorage()

export function Provider ({ children }: ProviderProps): ReactNode {
  const [{ client }] = useW3()
  const [migrations, setMigrations] = useState(migrationsStore.load())
  const [logs, setLogs] = useState<Record<MigrationID, string[]>>({})
  const log = (id: MigrationID, msg: string) => {
    setLogs(logs => ({ ...logs, [id]: [...(logs[id] ?? []), msg].slice(-MAX_LOG_LINES) }))
  }

  const createMigration = (config: MigrationConfiguration) => {
    const { id } = migrationsStore.create(config)
    log(id, 'created migration')
    setMigrations(() => migrationsStore.load())
    return { id }
  }
  const removeMigration = (id: MigrationID) => {
    log(id, 'removing migration')
    stopMigration(id)
    migrationsStore.delete(id)
    setMigrations(() => migrationsStore.load())
  }
  const startMigration = (id: MigrationID) => {    
    const migration = migrationsStore.read(id)
    if (runningMigrations[id]) return console.warn(`already started: ${id}`)
    if (!client) return console.warn('missing client')

    log(id, 'starting migration...')

    const controller = new AbortController()
    runningMigrations[id] = controller

    const uploads = Migrations.create(migration.source, {
      token: migration.token,
      cursor: migration.progress?.cursor
    })
    const initProgress = async () => ({
      pending: await uploads.count(),
      succeeded: 0,
      failed: []
    }) as MigrationProgress

    Migrations.migrate({
      signal: controller.signal,
      uploads,
      issuer: client.agent.issuer,
      space: migration.space,
      proofs: client.proofs([
        { can: 'store/add', with: migration.space },
        { can: 'upload/add', with: migration.space }
      ]) ?? [],
      // @ts-expect-error
      connection: serviceConnection,
      onStoreAdd: async (upload, shard) => {
        log(id, `stored shard: ${shard.link}`)
        const migration = migrationsStore.read(id)
        migration.progress = migration.progress ?? await initProgress()
        migration.progress = {
          ...migration.progress,
          current: upload.root
        }
        migrationsStore.update(migration)
        setMigrations(() => migrationsStore.load())
      },
      onUploadAdd: async (upload) => {
        log(id, `upload migrated: ${upload.root}`)
        const migration = migrationsStore.read(id)
        migration.progress = migration.progress ?? await initProgress()
        migration.progress = {
          ...migration.progress,
          cursor: upload.root.toString(),
          pending: migration.progress.pending - 1,
          succeeded: migration.progress.succeeded + 1
        }
        migrationsStore.update(migration)
        setMigrations(() => migrationsStore.load())
      },
      onError: async (err, upload, shard) => {
        console.error(err)
        log(id, `migration failed ${upload.root}${shard ? ` (shard: ${shard.link})` : ''}: ${err.stack}`)
        const migration = migrationsStore.read(id)
        migration.progress = migration.progress ?? await initProgress()
        migration.progress.failed.push(upload.root)
        migration.progress = {
          ...migration.progress,
          cursor: upload.root.toString(),
          pending: migration.progress.pending - 1
        }
        migrationsStore.update(migration)
        setMigrations(() => migrationsStore.load())
      }
    })
  }
  const stopMigration = (id: MigrationID) => {
    log(id, 'stopping migration')
    if (!runningMigrations[id]) throw new Error('missing migration controller')
    runningMigrations[id].abort()
    delete runningMigrations[id]
  }

  // resume existing migrations
  useEffect(() => {
    if (!client) return
    for (const migration of migrations) {
      startMigration(migration.id)
    }
  }, [client])

  return (
    <Context.Provider value={[{ migrations, logs }, { createMigration, removeMigration, startMigration, stopMigration }]}>
      {children}
    </Context.Provider>
  )
}

export function useMigrations (): ContextValue {
  return useContext(Context)
}

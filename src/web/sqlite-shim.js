// better-sqlite3-compatible wrapper over sql.js (SQLite compiled to WebAssembly), used only by the website build.
let SQL = null
let initialBytes = null
export function setSqlJs(sqlJs, bytes) { SQL = sqlJs; initialBytes = bytes }

const NAMED = /[@:$][A-Za-z_][A-Za-z0-9_]*/g
const normalize = value => (value === undefined ? null : typeof value === 'boolean' ? Number(value) : value)

class Statement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.names = [...new Set(sql.replace(/'(?:[^']|'')*'/g, '').match(NAMED) || [])]
  }
  bind(args) {
    const first = args[0]
    if (args.length === 1 && first && typeof first === 'object' && !Array.isArray(first) && !(first instanceof Uint8Array)) {
      return Object.fromEntries(this.names.map(name => [name, normalize(first[name.slice(1)])]))
    }
    return args.flat().map(normalize)
  }
  open(args) {
    const stmt = this.db.raw.prepare(this.sql)
    const params = this.bind(args)
    if (Array.isArray(params) ? params.length : Object.keys(params).length) stmt.bind(params)
    return stmt
  }
  run(...args) {
    const stmt = this.open(args)
    try { stmt.step() } finally { stmt.free() }
    const changes = this.db.raw.getRowsModified()
    const lastInsertRowid = this.db.raw.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0
    return { changes, lastInsertRowid }
  }
  get(...args) {
    const stmt = this.open(args)
    try { return stmt.step() ? stmt.getAsObject() : undefined } finally { stmt.free() }
  }
  all(...args) {
    const stmt = this.open(args)
    const rows = []
    try { while (stmt.step()) rows.push(stmt.getAsObject()) } finally { stmt.free() }
    return rows
  }
}

export default class Database {
  constructor() {
    this.raw = new SQL.Database(initialBytes || undefined)
    this.depth = 0
  }
  prepare(sql) { return new Statement(this, sql) }
  exec(sql) { this.raw.exec(sql); return this }
  pragma(source, { simple = false } = {}) {
    if (/^journal_mode/i.test(source)) return simple ? 'memory' : [{ journal_mode: 'memory' }]
    const rows = this.prepare(`PRAGMA ${source}`).all()
    return simple ? (rows[0] ? Object.values(rows[0])[0] : undefined) : rows
  }
  transaction(fn) {
    const db = this
    const wrapped = function (...args) {
      const nested = db.depth > 0
      const name = `sp${db.depth}`
      db.raw.exec(nested ? `SAVEPOINT ${name}` : 'BEGIN')
      db.depth++
      try {
        const result = fn.apply(this, args)
        db.depth--
        db.raw.exec(nested ? `RELEASE ${name}` : 'COMMIT')
        return result
      } catch (error) {
        db.depth--
        db.raw.exec(nested ? `ROLLBACK TO ${name}; RELEASE ${name}` : 'ROLLBACK')
        throw error
      }
    }
    wrapped.deferred = wrapped.immediate = wrapped.exclusive = wrapped
    return wrapped
  }
  export() {
    const bytes = this.raw.export()
    this.raw.exec('PRAGMA foreign_keys = ON')
    return bytes
  }
  close() {}
}

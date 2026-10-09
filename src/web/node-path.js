export const join = (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/')
export const resolve = (...parts) => join(...parts)
export const dirname = file => file.split('/').slice(0, -1).join('/') || '/'
export const basename = file => file.split('/').pop()
export const sep = '/'
export default { join, resolve, dirname, basename, sep }

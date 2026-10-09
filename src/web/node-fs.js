export const existsSync = () => false
export const mkdirSync = () => {}
export const readFileSync = () => { throw new Error('File access is not available in the browser.') }
export default { existsSync, mkdirSync, readFileSync }
